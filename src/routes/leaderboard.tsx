import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import { useState } from "react";

import { PlayerBadge } from "@/components/PlayerBadge";
import { usePlayer } from "@/hooks/usePlayer";
import { LEADERBOARD_GAMES, shortWallet } from "@/lib/leaderboard";
import { getLeaderboard } from "@/lib/leaderboard.functions";

const title = "Leaderboard — NimiqValley Game Hub";
const description =
  "Global high scores for every NimiqValley arcade game. Connect your Nimiq wallet and climb the ranking.";

export const Route = createFileRoute("/leaderboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const [slug, setSlug] = useState(LEADERBOARD_GAMES[0]!.slug);
  const game = LEADERBOARD_GAMES.find((g) => g.slug === slug)!;
  const fetchBoard = useServerFn(getLeaderboard);
  const { player } = usePlayer();

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", slug],
    queryFn: () => fetchBoard({ data: { slug } }),
  });

  const rows = data?.rows ?? [];
  const you = data?.you ?? null;
  const youInTop = you ? rows.some((r) => r.wallet === you.wallet) : false;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/games"
              className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              ← Game Hub
            </Link>
            <PlayerBadge />
          </div>
          <h1 className="mt-4 flex items-center gap-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            <Trophy className="size-7 text-primary" aria-hidden="true" />
            Leaderboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Best result per player. Pick a game to see its global top 50.
          </p>
        </header>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {LEADERBOARD_GAMES.map((g) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => setSlug(g.slug)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                g.slug === slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[3rem_1fr_6rem] gap-2 border-b border-border px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">{game.metric}</span>
          </div>

          {isLoading && <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>}

          {!isLoading && rows.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No scores yet. Be the first to play {game.name}.
            </p>
          )}

          {rows.map((row) => {
            const mine = player?.wallet === row.wallet;
            return (
              <div
                key={row.wallet}
                className={`grid grid-cols-[3rem_1fr_6rem] items-center gap-2 border-b border-border/50 px-4 py-2 text-sm last:border-0 ${
                  mine ? "bg-primary/10 font-bold" : ""
                }`}
              >
                <span className="text-muted-foreground">{row.rank}</span>
                <span className="truncate">{row.displayName || shortWallet(row.wallet)}</span>
                <span className="text-right tabular-nums">{game.format(row.value)}</span>
              </div>
            );
          })}

          {you && !youInTop && (
            <div className="grid grid-cols-[3rem_1fr_6rem] items-center gap-2 border-t border-border bg-primary/10 px-4 py-2 text-sm font-bold">
              <span>{you.rank}</span>
              <span className="truncate">{you.displayName || shortWallet(you.wallet)} (you)</span>
              <span className="text-right tabular-nums">{game.format(you.value)}</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
