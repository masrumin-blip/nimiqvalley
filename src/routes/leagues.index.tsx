import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trophy } from "lucide-react";

import { PlayerBadge } from "@/components/PlayerBadge";
import { listLeagues } from "@/lib/leagues.functions";
import { LEAGUE_GAMES, leaguePhase } from "@/lib/verification-info";

const title = "Leagues — NimiqValley";
const description = "Join score leagues for verified NimiqValley games and compete for NIM or USDT prize pools.";

export const Route = createFileRoute("/leagues/")({
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
  component: LeaguesPage,
});

function LeaguesPage() {
  const fetchLeagues = useServerFn(listLeagues);
  const { data, isLoading } = useQuery({ queryKey: ["leagues"], queryFn: () => fetchLeagues(), refetchInterval: 30_000 });
  const leagues = data ?? [];
  const order = ["Live", "Upcoming", "Waiting for prize pool", "Ended"];
  const sorted = [...leagues].sort((a, b) => order.indexOf(leaguePhase(a)) - order.indexOf(leaguePhase(b)));

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-2">
            <Link to="/games" className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-accent">
              ← Game Hub
            </Link>
            <PlayerBadge />
          </div>
          <div className="arcade-panel mt-5 overflow-hidden p-5 text-center">
            <div className="arcade-label">★ Tournament Hall ★</div>
            <h1 className="mt-2 flex items-center justify-center gap-3 font-display text-4xl font-black uppercase tracking-tight text-foreground sm:text-5xl">
              <Trophy className="arcade-glow size-9 text-primary" aria-hidden="true" />
              Leagues
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Compete on games with verified scores. Prize pools are locked once funded.
            </p>
            <Link to="/leagues/new" className="arcade-btn mt-4 min-h-11 px-5 text-xs">
              <Plus className="size-4" aria-hidden="true" /> Create league
            </Link>
          </div>
        </header>

        {isLoading && (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        )}
        {!isLoading && sorted.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-primary/40 p-8 text-center">
            <div className="arcade-label animate-pulse">Insert coin</div>
            <p className="mt-2 text-sm text-muted-foreground">No leagues yet. Create the first one.</p>
          </div>
        )}

        <div className="grid gap-3">
          {sorted.map((l) => {
            const game = LEAGUE_GAMES.find((g) => g.slug === l.gameSlug);
            const phase = leaguePhase(l);
            const bar =
              phase === "Live" ? "bg-primary animate-pulse" : phase === "Upcoming" ? "bg-neon-cyan" : phase === "Ended" ? "bg-muted-foreground/40" : "bg-neon-orange";
            return (
              <Link
                key={l.id}
                to="/leagues/$id"
                params={{ id: l.id }}
                className={`arcade-panel group flex overflow-hidden transition-transform hover:-translate-y-0.5 ${phase === "Ended" ? "opacity-70" : ""}`}
              >
                <span className={`w-1.5 shrink-0 ${bar}`} aria-hidden="true" />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${phase === "Live" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {phase === "Live" ? "● Live" : phase}
                      </span>
                      <div className="mt-1.5 truncate font-display text-lg font-black text-foreground">{l.title}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="arcade-label">Pool</div>
                      <div className="font-mono text-xl font-black tabular-nums text-primary">
                        {l.pool} <span className="text-xs">{l.token.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-md border border-border bg-background/60 px-2 py-0.5 text-foreground">{game?.name ?? l.gameSlug}</span>
                    <span className="rounded-md border border-border bg-background/60 px-2 py-0.5 text-muted-foreground">{l.payout === "winner" ? "Winner takes all" : "Top 3 · 50/30/20"}</span>
                    <span className="rounded-md border border-border bg-background/60 px-2 py-0.5 text-muted-foreground">🏆 {l.creatorName || `${l.creatorWallet.slice(0, 9)}…`}</span>
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {new Date(l.startsAt).toLocaleString()} → {new Date(l.endsAt).toLocaleString()}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
