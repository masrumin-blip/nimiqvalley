/** Typed RPC for the player coin purse and NIM redemptions. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { COINS_PER_NIM, MIN_REDEEM_COINS, coinsToNim } from "./coins";

async function requireWallet() {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) throw new Error("Connect your wallet first.");
  return wallet;
}

export type CoinPurse = {
  coins: number;
  nimValue: number;
  pending: { id: string; coins: number; nim: number; status: string; createdAt: string }[];
};

export const fetchCoins = createServerFn({ method: "GET" }).handler(async (): Promise<CoinPurse | null> => {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row } = await supabaseAdmin
    .from("wallet_credits")
    .select("coins")
    .eq("wallet", wallet)
    .maybeSingle();
  const coins = Number(row?.coins ?? 0);

  const { data: rows } = await supabaseAdmin
    .from("coin_redemptions")
    .select("id, coins, nim_amount, status, created_at")
    .eq("wallet", wallet)
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    coins,
    nimValue: coinsToNim(coins),
    pending: (rows ?? []).map((r) => ({
      id: r.id,
      coins: Number(r.coins),
      nim: Number(r.nim_amount),
      status: r.status,
      createdAt: r.created_at,
    })),
  };
});

/**
 * Spends coins and files a NIM payout request. The database function does the
 * deduction and the insert in one statement, so a double tap cannot overdraw.
 */
export const redeemCoins = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ coins: z.number().int().min(MIN_REDEEM_COINS) }).parse(input))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    if (data.coins % COINS_PER_NIM !== 0) {
      throw new Error(`Redeem in steps of ${COINS_PER_NIM} coins.`);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("redeem_player_coins", {
      p_wallet: wallet,
      p_coins: data.coins,
      p_rate: COINS_PER_NIM,
    });
    if (error) throw new Error("Could not start the redemption. Try again.");
    if (!id) throw new Error("You do not have that many coins.");
    return { id: String(id), nim: coinsToNim(data.coins) };
  });
