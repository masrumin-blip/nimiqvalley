/** League helpers. Server only. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { PAYOUT_SHARES, type PayoutKind } from "./verification-info";

export type LeagueRow = {
  id: string;
  game_slug: string;
  creator_wallet: string;
  title: string;
  starts_at: string;
  ends_at: string;
  payout: string;
  token: string;
  pool: number;
  status: string;
  created_at: string;
};

export async function getLeagueRow(id: string): Promise<LeagueRow | null> {
  const { data } = await supabaseAdmin.from("leagues").select("*").eq("id", id).maybeSingle();
  return (data as LeagueRow | null) ?? null;
}

/** Throws unless the league is funded, running now, and for this game. */
export async function assertLeaguePlayable(id: string, slug: string) {
  const l = await getLeagueRow(id);
  const now = Date.now();
  if (!l || l.status !== "active" || l.game_slug !== slug) throw new Error("This league is not available.");
  if (now < new Date(l.starts_at).getTime()) throw new Error("This league has not started yet.");
  if (now >= new Date(l.ends_at).getTime()) throw new Error("This league has ended.");
}

/** Records a verified score for a league if the whole round happened inside the league window. */
export async function recordLeagueScore(leagueId: string, wallet: string, slug: string, score: number, issuedAtMs: number) {
  const l = await getLeagueRow(leagueId);
  if (!l || l.status !== "active" || l.game_slug !== slug) return;
  const now = Date.now();
  if (issuedAtMs < new Date(l.starts_at).getTime() || now > new Date(l.ends_at).getTime()) return;
  const { data: existing } = await supabaseAdmin
    .from("league_scores")
    .select("best")
    .eq("league_id", leagueId)
    .eq("wallet", wallet)
    .maybeSingle();
  if (existing && score <= Number(existing.best)) return;
  await supabaseAdmin
    .from("league_scores")
    .upsert({ league_id: leagueId, wallet, best: score, updated_at: new Date().toISOString() }, { onConflict: "league_id,wallet" });
}

/** Final standings and each wallet's share. Unfilled places go back to the creator. */
export async function computePayouts(l: LeagueRow) {
  const { data } = await supabaseAdmin
    .from("league_scores")
    .select("wallet, best, updated_at")
    .eq("league_id", l.id)
    .order("best", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(3);
  const shares = PAYOUT_SHARES[(l.payout as PayoutKind) in PAYOUT_SHARES ? (l.payout as PayoutKind) : "winner"];
  const pool = Number(l.pool);
  const out = new Map<string, { amount: number; ranks: number[] }>();
  shares.forEach((share, i) => {
    const winner = data?.[i]?.wallet ?? l.creator_wallet;
    const e = out.get(winner) ?? { amount: 0, ranks: [] };
    e.amount += Math.floor(pool * share * 100_000) / 100_000;
    if (data?.[i]) e.ranks.push(i + 1);
    out.set(winner, e);
  });
  return out;
}

const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

const POLYGON_WRITE_RPCS = [
  "https://polygon.drpc.org",
  "https://polygon.gateway.tenderly.co",
  "https://polygon-bor-rpc.publicnode.com",
];

/** Converts payout failures into safe, useful messages for the private admin page. */
export function usdtPayoutErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/treasury signing key/i.test(message)) return "The Polygon treasury signing key is not configured.";
  if (/insufficient funds|exceeds the balance/i.test(message)) {
    return "The treasury does not have enough USDT or POL for this payment.";
  }
  if (/nonce|replacement transaction|already known/i.test(message)) {
    return "A treasury transaction may already be pending. Wait a moment, then try again.";
  }
  if (/http request failed|timeout|timed out|network|fetch failed|api key disabled/i.test(message)) {
    return "The Polygon network service is unavailable. The claim is still safe; please try again shortly.";
  }
  return "The USDT transfer could not be sent. The claim is still safe and can be retried.";
}

/** Sends USDT on Polygon from the league treasury through redundant RPC services. */
export async function sendTreasuryUsdt(to: string, amount: number): Promise<string> {
  const key = process.env["LEAGUE_TREASURY_POLYGON_KEY"];
  if (!key) throw new Error("Treasury signing key is not configured.");
  const { createWalletClient, fallback, http } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { polygon } = await import("viem/chains");
  const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`);
  const transport = fallback(
    POLYGON_WRITE_RPCS.map((url) => http(url, { timeout: 10_000, retryCount: 1 })),
    { retryCount: 1 },
  );
  const client = createWalletClient({ account, chain: polygon, transport });
  return client.writeContract({
    address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to as `0x${string}`, BigInt(Math.round(amount * 1_000_000))],
  });
}
