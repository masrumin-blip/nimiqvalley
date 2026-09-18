import { createFileRoute, Link } from "@tanstack/react-router";
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => (
            <Link
              key={game.slug}
              to={game.path}
              className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-card shadow-lg transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-foreground/80">
                  <span className="text-base" aria-hidden="true">{game.emoji}</span>
                  Arcade original
                </div>
                <h2
                  className="font-display text-2xl font-black uppercase leading-none text-foreground drop-shadow-[0_2px_0_var(--background)] sm:text-3xl"
                  style={{ textShadow: `0 2px 0 var(--background), 0 0 18px ${game.accent}` }}
                >
                  {game.name}
                </h2>
                <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground/80 sm:text-sm">{game.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-black uppercase text-foreground transition-transform group-hover:translate-x-1">
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
