/** Games that have a global leaderboard, with how their score is measured. */
export type LeaderboardGame = {
  slug: string;
  name: string;
  /** Label shown above the score column. */
  metric: string;
  /** "desc" = higher is better, "asc" = lower is better (lap times). */
  order: "desc" | "asc";
  /** Format a stored numeric value for display. */
  format: (value: number) => string;
  /** Lowest value the server accepts for this game. */
  minValue: number;
  /** Highest value the server accepts — anything above is rejected as impossible. */
  maxValue: number;
};

const plain = (value: number) => String(Math.round(value));

const time = (value: number) => {
  const total = Math.max(0, value);
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return minutes > 0
    ? `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`
    : `${seconds.toFixed(2)}s`;
};

/**
 * The limits below are deliberately generous headroom over the best human
 * results, not tight caps: they only exist so a forged request cannot post an
 * absurd number and destroy the board.
 */
export const LEADERBOARD_GAMES: LeaderboardGame[] = [
  { slug: "jump", name: "Jump for Nimiq", metric: "Score", order: "desc", format: plain, minValue: 0, maxValue: 100_000 }, // prettier-ignore
  { slug: "race", name: "Nimiq Car Race", metric: "Best lap", order: "asc", format: time, minValue: 8, maxValue: 600 }, // prettier-ignore
  { slug: "hexaman", name: "Nimiq the Hexaman", metric: "Score", order: "desc", format: plain, minValue: 0, maxValue: 100_000 }, // prettier-ignore
  { slug: "mininja", name: "Nimiq Mininja", metric: "Score", order: "desc", format: plain, minValue: 0, maxValue: 100_000 }, // prettier-ignore
  { slug: "rooftop", name: "Nimiq Rooftop", metric: "Coins", order: "desc", format: plain, minValue: 0, maxValue: 50_000 }, // prettier-ignore
  { slug: "slide", name: "Nimiq Slide", metric: "Score", order: "desc", format: plain, minValue: 0, maxValue: 100_000 }, // prettier-ignore
  { slug: "soccer", name: "Nimiq Soccer", metric: "Wins", order: "desc", format: plain, minValue: 0, maxValue: 10_000 }, // prettier-ignore
  { slug: "tappy", name: "Nimiq Tappy", metric: "Score", order: "desc", format: plain, minValue: 0, maxValue: 10_000 }, // prettier-ignore
  { slug: "shooter", name: "CosNimiq Shooter", metric: "Score", order: "desc", format: plain, minValue: 0, maxValue: 200_000 }, // prettier-ignore
  { slug: "ship", name: "Nimiq Spaceship", metric: "Score", order: "desc", format: plain, minValue: 0, maxValue: 200_000 }, // prettier-ignore
  { slug: "crossing", name: "Crossing for Nimiq", metric: "Coins", order: "desc", format: plain, minValue: 0, maxValue: 50_000 }, // prettier-ignore
];

export const LEADERBOARD_SLUGS = LEADERBOARD_GAMES.map((g) => g.slug);

export function getLeaderboardGame(slug: string): LeaderboardGame | undefined {
  return LEADERBOARD_GAMES.find((g) => g.slug === slug);
}

/** Short display for a wallet address. */
export function shortWallet(address: string): string {
  const clean = address.replace(/\s+/g, "");
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-4)}`;
}
