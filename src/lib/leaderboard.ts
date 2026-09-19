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

export const LEADERBOARD_GAMES: LeaderboardGame[] = [
  { slug: "jump", name: "Jump for Nimiq", metric: "Score", order: "desc", format: plain },
  { slug: "race", name: "Nimiq Car Race", metric: "Best lap", order: "asc", format: time },
  { slug: "hexaman", name: "Nimiq the Hexaman", metric: "Score", order: "desc", format: plain },
  { slug: "mininja", name: "Nimiq Mininja", metric: "Score", order: "desc", format: plain },
  { slug: "rooftop", name: "Nimiq Rooftop", metric: "Coins", order: "desc", format: plain },
  { slug: "slide", name: "Nimiq Slide", metric: "Score", order: "desc", format: plain },
  { slug: "soccer", name: "Nimiq Soccer", metric: "Wins", order: "desc", format: plain },
  { slug: "tappy", name: "Nimiq Tappy", metric: "Score", order: "desc", format: plain },
  { slug: "shooter", name: "CosNimiq Shooter", metric: "Score", order: "desc", format: plain },
  { slug: "ship", name: "Nimiq Spaceship", metric: "Score", order: "desc", format: plain },
  { slug: "crossing", name: "Crossing for Nimiq", metric: "Coins", order: "desc", format: plain },
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
