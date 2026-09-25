/** Client-safe descriptions of how each league-eligible game verifies scores. */

export type VerifyMethod = "replay" | "telemetry";

export const VERIFY_METHODS: Record<VerifyMethod, { name: string; protection: string; steps: string[] }> = {
  replay: {
    name: "Full Replay",
    protection: "Highest protection — the server plays your round again by itself.",
    steps: [
      "When you start, the server picks the level layout (a secret seed). You can't choose your own.",
      "While you play, the game only records which buttons you pressed and when.",
      "When the round ends, the server replays those button presses on the same level and calculates the score itself.",
      "The score you claim is ignored — only the server's result counts. Each round ticket can be used once.",
    ],
  },
  telemetry: {
    name: "Telemetry Check",
    protection: "Strong protection — every score must match what the game could really produce.",
    steps: [
      "When you start, the server gives a one-time round ticket and notes the time.",
      "When the round ends, the game sends the score plus a summary: play time, wave reached, and enemies defeated by type.",
      "The server checks that play time matches the real clock, waves weren't cleared too fast, and the score fits the enemies defeated.",
      "Any impossible number rejects the score. Each ticket can be used once.",
    ],
  },
};

export const LEAGUE_GAMES = [
  { slug: "tappy", name: "Nimiq Tappy", path: "/games/tappy", method: "replay" },
  { slug: "crossing", name: "Crossing for Nimiq", path: "/games/crossing", method: "replay" },
  { slug: "mininja", name: "Nimiq Mininja", path: "/games/mininja", method: "replay" },
  { slug: "jump", name: "Jump for Nimiq", path: "/games/jump", method: "replay" },
  { slug: "ship", name: "Nimiq Spaceship", path: "/games/ship", method: "telemetry" },
  { slug: "shooter", name: "CosNimiq Shooter", path: "/games/shooter", method: "telemetry" },
] as const satisfies ReadonlyArray<{ slug: string; name: string; path: string; method: VerifyMethod }>;

export type LeagueSlug = (typeof LEAGUE_GAMES)[number]["slug"];
export const LEAGUE_SLUGS = LEAGUE_GAMES.map((g) => g.slug) as [LeagueSlug, ...LeagueSlug[]];

export const PAYOUT_SHARES = { winner: [1], top3: [0.5, 0.3, 0.2] } as const;
export type PayoutKind = keyof typeof PAYOUT_SHARES;

/** League id from the current page URL (?league=...), used when a game requests a round ticket. */
export function currentLeagueId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get("league");
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined;
}

export function leaguePhase(l: { status: string; startsAt: string; endsAt: string }) {
  if (l.status === "draft") return "Waiting for prize pool";
  const now = Date.now();
  if (now < new Date(l.startsAt).getTime()) return "Upcoming";
  if (now < new Date(l.endsAt).getTime()) return "Live";
  return "Ended";
}
