import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Flag, PlusCircle, Swords, Trophy } from "lucide-react";

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
            className="group mt-5 flex min-h-16 items-center gap-3 rounded-2xl border-2 border-primary bg-gradient-to-r from-primary via-accent to-primary px-5 py-3 text-primary-foreground shadow-[0_6px_0_0_color-mix(in_oklab,var(--primary)_45%,transparent),0_0_28px_color-mix(in_oklab,var(--primary)_40%,transparent)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
          >
            <PlusCircle className="size-8 shrink-0 transition-transform group-hover:rotate-90" aria-hidden="true" />
            <span className="flex flex-col text-left">
              <span className="text-lg font-black uppercase tracking-wider">Create league</span>
              <span className="text-[11px] font-semibold opacity-80">Host a tournament · set your prize pool</span>
            </span>
          </Link>
        </header>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && sorted.length === 0 && <p className="text-sm text-muted-foreground">No leagues yet. Create the first one.</p>}

        <div className="grid gap-3">
          {sorted.map((l) => {
            const game = LEAGUE_GAMES.find((g) => g.slug === l.gameSlug);
            const phase = leaguePhase(l);
            const ended = phase === "Ended";
            const live = phase === "Live";
            const left = new Date(l.endsAt).getTime() - Date.now();
            const leftTxt = `${Math.floor(left / 86400000)}d ${Math.floor((left % 86400000) / 3600000)}h left`;
            if (ended) {
              return (
                <Link key={l.id} to="/leagues/$id" params={{ id: l.id }} className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 transition-colors hover:bg-muted/60">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <Flag className="size-3.5" aria-hidden="true" /> Concluded · {new Date(l.endsAt).toLocaleDateString()}
                  </div>
                  <div className="mt-1 truncate font-bold text-foreground">{l.title}</div>
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-background/60 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <Trophy className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {l.champion ? (
                        <span className="truncate"><b>{l.champion.name || `${l.champion.wallet.slice(0, 9)}…`}</b> · {l.champion.best}</span>
                      ) : (
                        <span className="text-muted-foreground">No champion</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs font-bold text-muted-foreground">{l.pool} {l.token.toUpperCase()} pool</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{game?.name ?? l.gameSlug}</div>
                </Link>
              );
            }
            return (
              <Link
                key={l.id}
                to="/leagues/$id"
                params={{ id: l.id }}
                className={`rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 ${live ? "border-2 border-primary shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_35%,transparent)]" : "border-border hover:bg-accent"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-lg font-black text-foreground">{l.title}</span>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${live ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {live && <span className="size-2 animate-pulse rounded-full bg-primary-foreground" />}
                    {live ? "Live now" : phase}
                  </span>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-2xl font-black tabular-nums text-primary">{l.pool} {l.token.toUpperCase()}</div>
                    <div className="text-xs text-muted-foreground">
                      {game?.name ?? l.gameSlug} · {l.payout === "winner" ? "Winner takes all" : "Top 3 50/30/20"} · Host {l.creatorName || `${l.creatorWallet.slice(0, 9)}…`}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {live ? `⏳ ${leftTxt}` : `Starts ${new Date(l.startsAt).toLocaleString()}`}
                    </div>
                  </div>
                  {live && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-black uppercase text-primary-foreground">
                      <Swords className="size-3.5" aria-hidden="true" /> Compete
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
