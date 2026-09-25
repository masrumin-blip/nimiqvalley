import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AdminPayout = {
  id: string;
  leagueId: string;
  leagueTitle: string;
  token: string;
  wallet: string;
  ranks: number[];
  amount: number;
  toAddress: string;
  status: string;
  txHash: string | null;
  claimedAt: string;
};

export const getAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { adminWallet } = await import("./admin.server");
  return { isAdmin: Boolean(await adminWallet()) };
});

export const adminOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, treasuryNim } = await import("./admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: leagues }, { data: payouts }] = await Promise.all([
    supabaseAdmin.from("leagues").select("id, title, token, pool, status, ends_at"),
    supabaseAdmin.from("league_payouts").select("*").order("claimed_at", { ascending: false }).limit(300),
  ]);
  const byId = new Map((leagues ?? []).map((l) => [l.id, l]));
  const now = Date.now();
  const active = (leagues ?? []).filter((l) => l.status === "active" && new Date(l.ends_at).getTime() > now);
  const sum = (t: string) => active.filter((l) => l.token === t).reduce((a, l) => a + Number(l.pool), 0);
  const rows: AdminPayout[] = (payouts ?? []).map((p) => {
    const l = byId.get(p.league_id);
    return {
      id: p.id,
      leagueId: p.league_id,
      leagueTitle: l?.title ?? "—",
      token: l?.token ?? "nim",
      wallet: p.wallet,
      ranks: p.ranks ?? [],
      amount: Number(p.amount),
      toAddress: p.to_address,
      status: p.status,
      txHash: p.tx_hash,
      claimedAt: p.claimed_at,
    };
  });
  return {
    activeLeagues: active.length,
    poolNim: sum("nim"),
    poolUsdt: sum("usdt"),
    pending: rows.filter((r) => r.status === "pending"),
    paid: rows.filter((r) => r.status === "paid"),
    treasuryNim: treasuryNim(),
  };
});

async function loadPending(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin.from("league_payouts").select("*").eq("id", id).maybeSingle();
  if (!p || p.status !== "pending") throw new Error("This claim is not waiting for payment.");
  const { data: l } = await supabaseAdmin.from("leagues").select("token").eq("id", p.league_id).maybeSingle();
  return { p, token: l?.token ?? "nim", supabaseAdmin };
}

/** Marks a NIM claim paid only after finding the treasury transfer on-chain. */
export const markNimPayoutPaid = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, treasuryNim } = await import("./admin.server");
    await requireAdmin();
    const { p, token, supabaseAdmin } = await loadPending(data.id);
    if (token !== "nim") throw new Error("Not a NIM claim.");
    const treasury = treasuryNim();
    if (!treasury) throw new Error("Treasury wallet is not set.");
    const used = async (h: string) => {
      const checks = await Promise.all([
        supabaseAdmin.from("league_payouts").select("id").eq("tx_hash", h).maybeSingle(),
        supabaseAdmin.from("league_deposits").select("id").eq("tx_hash", h).maybeSingle(),
        supabaseAdmin.from("village_letters").select("id").eq("tx_hash", h).maybeSingle(),
      ]);
      return checks.some((c) => Boolean(c.data));
    };
    const { findNimTransfer } = await import("./letters.server");
    const hash = await findNimTransfer(treasury, p.to_address, Number(p.amount), used);
    if (!hash) throw new Error("Payment not found on-chain yet. Make sure it was sent from the treasury wallet, then try again.");
    const { data: upd } = await supabaseAdmin
      .from("league_payouts")
      .update({ status: "paid", tx_hash: hash })
      .eq("id", p.id)
      .eq("status", "pending")
      .select("id");
    if (!upd?.length) throw new Error("Already marked paid.");
    return { txHash: hash };
  });

export const retryUsdtPayout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { p, token, supabaseAdmin } = await loadPending(data.id);
    if (token !== "usdt") throw new Error("Not a USDT claim.");
    // Lock first so two clicks can't send twice.
    const { data: lock } = await supabaseAdmin
      .from("league_payouts")
      .update({ status: "sending" })
      .eq("id", p.id)
      .eq("status", "pending")
      .select("id");
    if (!lock?.length) throw new Error("Already being paid.");
    const { sendTreasuryUsdt, usdtPayoutErrorMessage } = await import("./leagues.server");
    let hash: string | null = null;
    let failure: unknown = null;
    try {
      hash = await sendTreasuryUsdt(p.to_address, Number(p.amount));
    } catch (e) {
      failure = e;
      console.error("admin usdt retry failed", p.id, e);
    }
    await supabaseAdmin
      .from("league_payouts")
      .update(hash ? { status: "paid", tx_hash: hash } : { status: "pending" })
      .eq("id", p.id);
    if (!hash) throw new Error(usdtPayoutErrorMessage(failure));
    return { txHash: hash };
  });
