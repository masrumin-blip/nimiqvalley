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
          <h1 className="mt-4 flex items-center gap-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            <Trophy className="size-7 text-primary" aria-hidden="true" />
            Leagues
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Compete on games with verified scores. Prize pools are locked once funded.
          </p>
          <Link
            to="/leagues/new"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-black uppercase tracking-wide text-primary-foreground"
          >
            <Plus className="size-4" aria-hidden="true" /> Create league
          </Link>
        </header>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && sorted.length === 0 && <p className="text-sm text-muted-foreground">No leagues yet. Create the first one.</p>}

        <div className="grid gap-3">
          {sorted.map((l) => {
            const game = LEAGUE_GAMES.find((g) => g.slug === l.gameSlug);
            const phase = leaguePhase(l);
            return (
              <Link
                key={l.id}
                to="/leagues/$id"
                params={{ id: l.id }}
                className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold text-foreground">{l.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${phase === "Live" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {phase}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {game?.name ?? l.gameSlug} · Pool {l.pool} {l.token.toUpperCase()} · {l.payout === "winner" ? "Winner takes all" : "Top 3 50/30/20"} · 🏆 Host {l.creatorName || `${l.creatorWallet.slice(0, 9)}…`}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(l.startsAt).toLocaleString()} → {new Date(l.endsAt).toLocaleString()}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
