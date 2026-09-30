/** Coin purse writes. Server only — the client never sets a coin balance. */
import { COIN_DAILY_CAP } from "./coins";

/**
 * Adds coins to a wallet, capped per UTC day inside the database function so
 * concurrent runs can never award more than the cap.
 * Returns how many coins were actually granted.
 */
export async function awardCoins(wallet: string, coins: number): Promise<number> {
  const amount = Math.floor(coins);
  if (!wallet || !Number.isFinite(amount) || amount <= 0) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("add_player_coins", {
    p_wallet: wallet,
    p_coins: amount,
    p_daily_cap: COIN_DAILY_CAP,
  });
  if (error) {
    console.warn("coin award failed", wallet, error.message);
    return 0;
  }
  return Number(data ?? 0);
}
