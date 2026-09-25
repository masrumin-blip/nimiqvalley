import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { LEAGUE_SLUGS } from "./verification-info";

export type LeagueDTO = {
  id: string;
  gameSlug: string;
  creatorWallet: string;
  title: string;
  startsAt: string;
  endsAt: string;
  payout: "winner" | "top3";
  token: "nim" | "usdt";
  pool: number;
  status: string;
  creatorName?: string | null;
};

function toDTO(r: import("./leagues.server").LeagueRow): LeagueDTO {
  return {
    id: r.id,
    gameSlug: r.game_slug,
    creatorWallet: r.creator_wallet,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    payout: r.payout as LeagueDTO["payout"],
    token: r.token as LeagueDTO["token"],
    pool: Number(r.pool),
    status: r.status,
  };
}

async function withCreatorNames(list: LeagueDTO[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const wallets = [...new Set(list.map((l) => l.creatorWallet))];
  if (!wallets.length) return list;
  const { data } = await supabaseAdmin.from("profiles").select("wallet, display_name").in("wallet", wallets);
  const names = new Map((data ?? []).map((p) => [p.wallet, p.display_name]));
  return list.map((l) => ({ ...l, creatorName: names.get(l.creatorWallet) ?? null }));
}

async function requireWallet() {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) throw new Error("Connect your wallet first.");
  return wallet;
}

/** Treasury addresses that receive prize pool deposits. */
export const getTreasury = createServerFn({ method: "GET" }).handler(async () => {
  const { treasuryNim } = await import("./admin.server");
  return {
    nim: treasuryNim(),
    polygon: process.env["LEAGUE_TREASURY_POLYGON"] ?? null,
  };
});

export const listLeagues = createServerFn({ method: "GET" }).handler(async (): Promise<LeagueDTO[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  const { data } = await supabaseAdmin.from("leagues").select("*").order("ends_at", { ascending: false }).limit(200);
  return withCreatorNames(
    (data ?? [])
      .filter((r) => r.status !== "draft" || (wallet && r.creator_wallet === wallet))
      .map((r) => toDTO(r as never)),
  );
});

export const getLeague = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getLeagueRow, computePayouts } = await import("./leagues.server");
    const { currentWallet } = await import("./session.server");
    const wallet = await currentWallet();
    const row = await getLeagueRow(data.id);
    if (!row || (row.status === "draft" && row.creator_wallet !== wallet)) return null;
    const dep = await import("./league-deposits.server");
    const { confirmed } = await dep.processPending(row.id).catch(() => ({ confirmed: 0 }));
    const league = confirmed ? ((await getLeagueRow(data.id)) ?? row) : row;
    const { data: pend } = wallet
      ? await supabaseAdmin
          .from("league_pending_deposits")
          .select("amount, status, created_at")
          .eq("league_id", row.id)
          .eq("wallet", wallet)
          .in("status", ["pending", "failed"])
          .gte("created_at", new Date(Date.now() - 48 * 3_600_000).toISOString())
          .order("created_at", { ascending: false })
          .limit(5)
      : { data: [] as { amount: number; status: string; created_at: string }[] };
    const myPending = (pend ?? []).map((p) => ({ amount: Number(p.amount), status: p.status, createdAt: p.created_at }));

    const { data: scores } = await supabaseAdmin
      .from("league_scores")
      .select("wallet, best, updated_at")
      .eq("league_id", data.id)
      .order("best", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(100);
    const wallets = (scores ?? []).map((s) => s.wallet);
    const { data: profiles } = wallets.length
      ? await supabaseAdmin.from("profiles").select("wallet, display_name").in("wallet", wallets)
      : { data: [] as { wallet: string; display_name: string | null }[] };
    const names = new Map((profiles ?? []).map((p) => [p.wallet, p.display_name]));

    const ended = Date.now() >= new Date(row.ends_at).getTime();
    let myShare: { amount: number; ranks: number[] } | null = null;
    let myClaim: { status: string; txHash: string | null; amount: number } | null = null;
    if (wallet && ended && row.status === "active") {
      myShare = (await computePayouts(row)).get(wallet) ?? null;
      const { data: c } = await supabaseAdmin
        .from("league_payouts")
        .select("status, tx_hash, amount")
        .eq("league_id", row.id)
        .eq("wallet", wallet)
        .maybeSingle();
      if (c) myClaim = { status: c.status, txHash: c.tx_hash, amount: Number(c.amount) };
    }

    return {
      league: (await withCreatorNames([toDTO(league)]))[0]!,
      myPending,
      rows: (scores ?? []).map((s, i) => ({
        rank: i + 1,
        wallet: s.wallet,
        displayName: names.get(s.wallet) ?? null,
        best: Number(s.best),
      })),
      me: wallet,
      myShare,
      myClaim,
    };
  });

const HOUR = 3_600_000;

export const createLeague = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        gameSlug: z.enum(LEAGUE_SLUGS),
        title: z.string().trim().min(3).max(60),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        payout: z.enum(["winner", "top3"]),
        token: z.enum(["nim", "usdt"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const start = new Date(data.startsAt).getTime();
    const end = new Date(data.endsAt).getTime();
    if (start < Date.now() - 5 * 60_000) throw new Error("Start time must be in the future.");
    if (end - start < HOUR) throw new Error("A league must last at least 1 hour.");
    if (end - start > 30 * 24 * HOUR) throw new Error("A league can last at most 30 days.");
    const { containsProfanity } = await import("./chat/moderation.server");
    if (containsProfanity(data.title)) throw new Error("Please choose a different name.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("leagues")
      .insert({
        game_slug: data.gameSlug,
        creator_wallet: wallet,
        title: data.title,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        payout: data.payout,
        token: data.token,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not create the league.");
    return { id: row.id };
  });

/** Creator can delete a league only while it is still an unfunded draft. */
export const deleteLeague = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { getLeagueRow } = await import("./leagues.server");
    const l = await getLeagueRow(data.id);
    if (!l) throw new Error("League not found.");
    if (l.creator_wallet !== wallet) throw new Error("Only the creator can delete this league.");
    if (l.status !== "draft" || Number(l.pool) > 0) throw new Error("A funded league cannot be deleted.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("league_pending_deposits").delete().eq("league_id", l.id);
    const { error } = await supabaseAdmin.from("leagues").delete().eq("id", l.id).eq("status", "draft");
    if (error) throw new Error("Could not delete the league.");
    return { ok: true };
  });

/** Adds to the prize pool after confirming the transfer on-chain. Anyone signed in can add. */
export const fundLeague = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        amount: z.number().positive().max(10_000_000),
        txHash: z.string().trim().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { getLeagueRow } = await import("./leagues.server");
    const l = await getLeagueRow(data.id);
    if (!l) throw new Error("League not found.");
    if (Date.now() >= new Date(l.ends_at).getTime()) throw new Error("This league has ended.");
    if (l.status === "draft" && l.creator_wallet !== wallet) throw new Error("Only the creator can open this league.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const used = async (h: string) => {
      const { data: d } = await supabaseAdmin.from("league_deposits").select("id").eq("tx_hash", h).maybeSingle();
      const { data: v } = await supabaseAdmin.from("village_letters").select("id").eq("tx_hash", h).maybeSingle();
      return Boolean(d || v);
    };
    if (l.token === "nim") {
      const { treasuryNim } = await import("./admin.server");
      if (!treasuryNim()) throw new Error("League deposits are not open yet.");
      if (!data.txHash) throw new Error("Payment code missing. Use \"I already paid, check again\".");
      const hash = data.txHash.toLowerCase();
      const dep = await import("./league-deposits.server");
      if (await dep.hashAlreadyUsed(hash)) throw new Error("This payment was already used.");
      // Record first so the payment is never lost, even if the user leaves.
      const { data: p, error: insErr } = await supabaseAdmin
        .from("league_pending_deposits")
        .insert({ league_id: l.id, wallet, amount: data.amount, token: "nim", tx_hash: hash })
        .select("*")
        .single();
      if (insErr || !p) throw new Error("Could not record the payment.");
      for (let i = 0; i < 4; i++) {
        const r = await dep.checkPending(p);
        if (r === "confirmed") {
          const fresh = await getLeagueRow(l.id);
          return { status: "confirmed" as const, pool: Number(fresh?.pool ?? 0) };
        }
        if (r === "failed") throw new Error("This payment does not match the league deposit.");
        await new Promise((res) => setTimeout(res, 3_000));
      }
      return { status: "pending" as const, pool: Number(l.pool) };
    }

    if (!process.env["LEAGUE_TREASURY_POLYGON"]) throw new Error("League deposits are not open yet.");
    if (!data.txHash) throw new Error("USDT payment is missing.");
    const hash = data.txHash.toLowerCase();
    if (await used(hash)) throw new Error("This payment was already used.");
    const dep = await import("./league-deposits.server");
    const { data: p, error } = await supabaseAdmin
      .from("league_pending_deposits")
      .insert({ league_id: l.id, wallet, amount: data.amount, token: "usdt", tx_hash: hash })
      .select("*")
      .single();
    if (error || !p) throw new Error("Could not record the payment.");
    for (let i = 0; i < 4; i++) {
      const result = await dep.checkPending(p);
      if (result === "confirmed") {
        const fresh = await getLeagueRow(l.id);
        return { status: "confirmed" as const, pool: Number(fresh?.pool ?? 0) };
      }
      if (result === "failed") throw new Error("This payment does not match the league deposit.");
      await new Promise((res) => setTimeout(res, 3_000));
    }
    return { status: "pending" as const, pool: Number(l.pool) };
  });

/** Recovery for a transfer already sent without a recorded pending row. */
export const recheckLeagueDeposit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      amount: z.number().positive().max(10_000_000),
      txHash: z.string().trim().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { getLeagueRow } = await import("./leagues.server");
    const l = await getLeagueRow(data.id);
    if (!l) throw new Error("League not found.");
    if (l.status === "draft" && l.creator_wallet !== wallet) throw new Error("Only the creator can open this league.");
    const dep = await import("./league-deposits.server");
    let hash: string | null = data.txHash?.toLowerCase() ?? null;
    if (l.token === "nim") {
      const { treasuryNim } = await import("./admin.server");
      const to = treasuryNim();
      if (!to) throw new Error("League deposits are not open yet.");
      const { findNimTransfer } = await import("./letters.server");
      const opts = { maxAgeMs: 24 * 3_600_000, timeoutMs: 10_000 };
      const used = (h: string) => dep.hashAlreadyUsed(h);
      // Only payments carrying this league's note count — never any other transfer to the treasury.
      hash = await findNimTransfer(wallet, to, data.amount, used, { ...opts, memo: `NimiqValley league ${l.id.slice(0, 8)}` });
      if (!hash) throw new Error("No new payment for this league found. Already-counted payments are not added twice.");
    } else if (!hash) {
      throw new Error("Enter the Polygon transaction hash from your wallet history.");
    }
    if (await dep.hashAlreadyUsed(hash)) throw new Error("This payment was already recorded.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin
      .from("league_pending_deposits")
      .insert({ league_id: l.id, wallet, amount: data.amount, token: l.token, tx_hash: hash })
      .select("*")
      .single();
    if (error || !p) throw new Error("Could not record the payment.");
    const result = await dep.checkPending(p);
    const fresh = await getLeagueRow(l.id);
    return { status: result, pool: Number(fresh?.pool ?? l.pool) };
  });

/** Winner (or creator, for unfilled places) claims their share once the league has ended. */
export const claimPrize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), polygonAddress: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { getLeagueRow, computePayouts, sendTreasuryUsdt } = await import("./leagues.server");
    const l = await getLeagueRow(data.id);
    if (!l || l.status !== "active") throw new Error("League not found.");
    if (Date.now() < new Date(l.ends_at).getTime()) throw new Error("The league has not ended yet.");
    const share = (await computePayouts(l)).get(wallet);
    if (!share || share.amount <= 0) throw new Error("There is no prize for you in this league.");
    const to = l.token === "usdt" ? data.polygonAddress : wallet;
    if (!to) throw new Error("Enter your Polygon address to receive USDT.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The unique (league_id, wallet) row makes a second claim impossible.
    const { data: row, error } = await supabaseAdmin
      .from("league_payouts")
      .insert({ league_id: l.id, wallet, ranks: share.ranks, amount: share.amount, to_address: to })
      .select("id")
      .single();
    if (error || !row) throw new Error("This prize was already claimed.");

    let txHash: string | null = null;
    if (l.token === "usdt") {
      try {
        txHash = await sendTreasuryUsdt(to, share.amount);
      } catch (e) {
        console.error("league usdt payout failed", l.id, e);
      }
    }
    if (txHash) await supabaseAdmin.from("league_payouts").update({ status: "paid", tx_hash: txHash }).eq("id", row.id);
    return { amount: share.amount, status: txHash ? "paid" : "pending", txHash };
  });
