import { formatTime } from "@/games/race/lib/hud";
import { useGame } from "@/games/race/store/game";
import { Button } from "@/components/ui/button";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Results() {
  const { results, laps, backToMenu, startSingle } = useGame();
  const you = results.findIndex((r) => r.isYou) + 1;

  return (
    <main className="min-h-dvh bg-sky px-4 pb-10 pt-10">
      <div className="mx-auto w-full max-w-md">
        <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-primary">Official Results</p>
        <h1 className="mt-1 text-center text-5xl font-extrabold text-foreground">
          {you === 1 ? "Race Winner" : `Finished P${you}`}
        </h1>
        <p className="mt-1 text-center text-sm text-foreground/70">
          {laps} lap{laps > 1 ? "s" : ""} complete
        </p>

        <ul className="mt-6 space-y-2">
          {results.map((r, i) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 rounded-sm border border-border px-4 py-3 shadow-pop ${
                r.isYou ? "bg-accent" : "bg-card/90"
              }`}
            >
              <span className="w-7 text-center font-display text-lg">
                {MEDALS[i] ?? i + 1}
              </span>
              <span
                className="h-7 w-7 rounded-lg border-2 border-foreground/20"
                style={{ backgroundColor: r.color }}
              />
              <span className="font-bold text-foreground">{r.name}</span>
              <span className="ml-auto font-display text-sm text-foreground">
                {r.time === null ? "-" : formatTime(r.time)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-7 space-y-3">
          <Button
            type="button"
            onClick={startSingle}
            className="h-auto w-full rounded-sm bg-primary py-4 font-display text-xl uppercase text-primary-foreground shadow-pop active:translate-y-1 active:shadow-none"
          >
            Race Again
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={backToMenu}
            className="h-auto w-full rounded-sm border border-border bg-card/80 py-3 font-bold uppercase text-foreground"
          >
            Main Menu
          </Button>
        </div>
      </div>
    </main>
  );
}
