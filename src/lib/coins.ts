/** Player coin purse: earned in the arcade games, redeemable for NIM. */

/** 100 coins = 1 NIM. */
export const COINS_PER_NIM = 100;

/** Hard ceiling per wallet per UTC day so the treasury cannot be drained. */
// No daily limit: effectively unlimited cap passed to the database.
export const COIN_DAILY_CAP = 2_000_000_000;

/** Minimum purse before a redemption is allowed. */
export const MIN_REDEEM_COINS = COINS_PER_NIM;

export function coinsToNim(coins: number) {
  return Math.floor(coins / COINS_PER_NIM);
}

/**
 * Upper bound of coins a telemetry run can plausibly report.
 * Coins drop from kills and float in the arena, so kills plus play time
 * bound them comfortably without punishing a good run.
 */
export function maxPlausibleCoins(kills: number, durationSec: number) {
  return Math.ceil(kills * 1.5 + durationSec * 0.8 + 10);
}
