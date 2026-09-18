import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { PlayerBadge } from "@/components/PlayerBadge";
import { GAMES } from "@/lib/games";

const title = "Game Hub — 15 NimiqValley Games";
const description =
  "Fifteen Nimiq arcade games: 3D racing, endless runners, neon mazes, table soccer, a virtual pet, and more.";

export const Route = createFileRoute("/games/")({
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
  component: GameHub,
});

function GameHub() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            ← Main Menu
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            NimiqValley
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Game Hub
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Fifteen games are ready to play. Choose one to open it full screen.
          </p>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/leaderboard"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-black uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              <Trophy className="size-4" aria-hidden="true" />
              Leaderboard
            </Link>
            <Link
              to="/arena"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-black uppercase tracking-wide text-foreground transition-transform hover:-translate-y-0.5"
            >
              <MessagesSquare className="size-4" aria-hidden="true" />
              Arena Chat
            </Link>
          </div>
          <PlayerBadge />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {GAMES.map((game) => (
            <Link
              key={game.slug}
              to={game.path}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-card shadow-lg transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:aspect-[4/3]"
            >
              <img
                src={game.cover}
                alt={`In-game screenshot of ${game.name}`}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" aria-hidden="true" />
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: game.accent }}
                aria-hidden="true"
              />
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
                <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase text-foreground/70">
                  <span className="text-sm" aria-hidden="true">{game.emoji}</span>
                  Arcade original
                </div>
                <h2
                  className="font-display line-clamp-2 text-base font-black uppercase leading-tight text-foreground sm:text-2xl"
                  style={{ textShadow: `0 2px 0 var(--background), 0 0 18px ${game.accent}` }}
                >
                  {game.name}
                </h2>
                <p className="mt-1 line-clamp-2 text-[11px] font-medium text-foreground/75 sm:text-sm">{game.tagline}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase text-foreground transition-transform group-hover:translate-x-1 sm:text-xs">
                  Play now <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
