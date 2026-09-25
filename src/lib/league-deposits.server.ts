/** Pending league deposits: recorded first, confirmed later (even after the user leaves). */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { treasuryNim } from "./admin.server";
import { verifyNimTx, verifyUsdtTx } from "./letters.server";

const FAIL_AFTER_MS = 24 * 3_600_000;

type Pending = { id: string; league_id: string; wallet: string; amount: number; token: string; tx_hash: string; created_at: string; attempts: number };

export async function hashAlreadyUsed(h: string, exceptPendingId?: string) {
  const { data: d } = await supabaseAdmin.from("league_deposits").select("id").eq("tx_hash", h).maybeSingle();
  const { data: v } = await supabaseAdmin.from("village_letters").select("id").eq("tx_hash", h).maybeSingle();
  let q = supabaseAdmin.from("league_pending_deposits").select("id").eq("tx_hash", h);
  if (exceptPendingId) q = q.neq("id", exceptPendingId);
  const { data: p } = await q.maybeSingle();
  const { data: n } = await supabaseAdmin.from("nim_payments").select("id").eq("tx_hash", h).maybeSingle();
  const { data: o } = await supabaseAdmin.from("league_payouts").select("id").eq("tx_hash", h).maybeSingle();
  const { data: c } = await supabaseAdmin.from("credit_purchases").select("id").eq("tx_hash", h).maybeSingle();
  return Boolean(d || v || p || n || o || c);
}

/** Credits a confirmed deposit to the pool exactly once. */
export async function creditDeposit(p: { id: string; league_id: string; wallet: string; amount: number; tx_hash: string }) {
  const { data: pool, error } = await supabaseAdmin.rpc("confirm_league_deposit", {
    p_pending: p.id,
  });
  if (error) throw new Error("Could not record the payment.");
  return Number(pool);
}

/** Checks one pending deposit against the network. */
export async function checkPending(p: Pending): Promise<"confirmed" | "pending" | "failed"> {
  const nimTo = treasuryNim();
  const polygonTo = process.env["LEAGUE_TREASURY_POLYGON"];
  const r = p.token === "nim"
    ? nimTo
      ? await verifyNimTx(p.tx_hash, p.wallet, nimTo, Number(p.amount), `NimiqValley league ${p.league_id.slice(0, 8)}`)
      : "unknown"
    : p.token === "usdt" && polygonTo
      ? await verifyUsdtTx(p.tx_hash, polygonTo, Number(p.amount))
      : "unknown";
  if (r === "ok") {
    await creditDeposit(p);
    return "confirmed";
  }
  const old = Date.now() - new Date(p.created_at).getTime() > FAIL_AFTER_MS;
  if (r === "bad" || old) {
    await supabaseAdmin
      .from("league_pending_deposits")
      .update({ status: "failed", attempts: p.attempts + 1, updated_at: new Date().toISOString() })
      .eq("id", p.id)
      .eq("status", "pending");
    return "failed";
  }
  await supabaseAdmin
    .from("league_pending_deposits")
    .update({ attempts: p.attempts + 1, updated_at: new Date().toISOString() })
    .eq("id", p.id);
  return "pending";
}

/** Re-checks pending deposits (for one league, or all when leagueId is omitted). */
export async function processPending(leagueId?: string) {
  let q = supabaseAdmin.from("league_pending_deposits").select("*").eq("status", "pending").order("created_at").limit(25);
  if (leagueId) q = q.eq("league_id", leagueId);
  const { data } = await q;
  let confirmed = 0;
  for (const p of (data ?? []) as Pending[]) {
    try {
      if ((await checkPending(p)) === "confirmed") confirmed++;
    } catch (e) {
      console.error("pending deposit check failed", p.id, e);
    }
  }
  return { checked: data?.length ?? 0, confirmed };
}
