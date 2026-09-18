import { submitScore } from "./leaderboard.functions";

/**
 * Sends a finished round's result to the global leaderboard.
 * Safe to call from anywhere (game loops included); failures are ignored.
 */
export function reportScore(slug: string, value: number) {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(value) || value < 0) return;
  void submitScore({ data: { slug, value: Math.floor(value * 100) / 100 } }).catch(() => {
    /* leaderboard is best-effort */
  });
}
