/**
 * Plausibility rules for games that can't be replayed deterministically.
 * The client reports its score plus a run summary; the server rejects any
 * combination that the game's own scoring rules could not have produced.
 */

export const TELEMETRY_GAMES = ["ship", "shooter"] as const;
export type TelemetrySlug = (typeof TELEMETRY_GAMES)[number];

export interface TelemetryRun {
  score: number;
  /** In-game active play time in seconds. */
  durationSec: number;
  wave: number;
  /** Kill counts keyed by enemy kind. */
  kills: Record<string, number>;
  /** Highest combo reached (shooter only). */
  maxCombo?: number | undefined;
}

/** Nimiq Spaceship — mirrors SCORES in src/games/ship/game/engine.ts. */
const SHIP_SCORES: Record<string, number> = {
  chaser: 35, shooter: 60, brute: 120, darter: 45, bomber: 70, sniper: 80, boss: 1500,
};

/** CosNimiq Shooter — mirrors `sc` values in public/games/shooter/index.html. */
const SHOOTER_SCORES: Record<string, number> = {
  grunt: 100, zig: 180, shooter: 280, dasher: 320, tank: 600, orbiter: 450, boss: 7000,
};
const SHOOTER_WAVE_LEN = 18;

function totalKills(kills: Record<string, number>) {
  return Object.values(kills).reduce((a, b) => a + b, 0);
}

/** Returns null when plausible, otherwise a short reason. */
export function checkTelemetry(slug: TelemetrySlug, run: TelemetryRun, serverElapsedSec: number): string | null {
  const { score, durationSec, wave, kills } = run;
  if (durationSec < 1) return "too-short";
  // In-game time can never exceed real time since the server issued the ticket.
  if (durationSec > serverElapsedSec + 5) return "duration-mismatch";

  const table = slug === "ship" ? SHIP_SCORES : SHOOTER_SCORES;
  for (const k of Object.keys(kills)) if (!(k in table)) return "unknown-enemy";

  const n = totalKills(kills);
  if (n / durationSec > 8) return "kill-rate";
  const bosses = kills["boss"] ?? 0;

  if (slug === "ship") {
    // Waves are kill-driven with breaks; allow at most one per 4s.
    if (wave > durationSec / 4 + 1) return "wave-rate";
    if (bosses > Math.floor(wave / 3)) return "boss-count";
    // Score is exactly the sum of kill values.
    let expected = 0;
    for (const [k, c] of Object.entries(kills)) expected += (table[k] ?? 0) * c;
    if (Math.round(score) !== expected) return "score-mismatch";
    return null;
  }

  // shooter: waves are strictly timed (slow-motion only makes them longer).
  if (wave > durationSec / SHOOTER_WAVE_LEN + 1.5) return "wave-rate";
  if (bosses > Math.floor(wave / 3)) return "boss-count";
  const maxCombo = Math.min(run.maxCombo ?? 0, n);
  const mult = 1 + Math.floor(maxCombo / 5) * 0.5;
  let killMax = 0;
  for (const [k, c] of Object.entries(kills)) killMax += (table[k] ?? 0) * c * mult;
  let waveBonus = 0;
  for (let w = 2; w <= wave; w++) waveBonus += 250 * w;
  const healBonus = 300 * (durationSec / 5 + 1);
  const survival = (0.1 + (wave + 1) * 0.05) * durationSec * 60;
  if (score > killMax + waveBonus + healBonus + survival + 50) return "score-too-high";
  return null;
}
