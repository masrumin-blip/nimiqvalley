import { Lightbulb, LightbulbOff } from "lucide-react";
import { Pet } from "@/games/pet/components/pet/Pet";
import { sfx } from "@/games/pet/game/audio";
import { useGame } from "@/games/pet/game/store";
import { cn } from "@/lib/utils";

export function Bedroom() {
  const { state, mood, toggleSleep, flash } = useGame();
  const sleeping = state.sleeping;

  const toggle = () => {
    toggleSleep();
    if (sleeping) {
      sfx.wake();
      flash("Good morning! ☀️");
    } else {
      sfx.sleep();
      flash("Lights out… sweet dreams 💤");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "relative flex flex-1 items-end justify-center overflow-hidden rounded-3xl transition-colors duration-700",
          sleeping && "bg-[var(--room-night)]",
        )}
      >
        {sleeping &&
          Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="absolute size-1 rounded-full bg-white"
              style={{
                left: `${(i * 37) % 96}%`,
                top: `${(i * 23) % 60}%`,
                animation: `star-twinkle ${1.6 + (i % 4) * 0.6}s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}

        {/* bed */}
        <div className="absolute inset-x-6 bottom-4 h-28 rounded-[2rem] bg-[var(--room-bed)] shadow-lg">
          <div className="absolute left-4 top-3 h-10 w-20 rounded-xl bg-white/80" />
        </div>

        <Pet
          mood={sleeping ? "sleeping" : mood}
          hat={state.hat}
          glasses={state.glasses}
          dirt={state.dirt}
          onTap={() => (sleeping ? sfx.deny() : sfx.tap())}
          className="relative z-10 mb-10 h-48 w-48 sm:h-60 sm:w-60"
        />

        <button
          onClick={toggle}
          aria-label={sleeping ? "Turn the lamp on" : "Turn the lamp off"}
          className="absolute right-5 top-5 z-20 grid size-16 place-items-center rounded-full border border-border bg-card shadow-md transition hover:scale-105 active:scale-95"
        >
          {sleeping ? (
            <LightbulbOff className="size-7 text-muted-foreground" />
          ) : (
            <Lightbulb className="size-7 text-amber-500" />
          )}
        </button>
      </div>

      <div className="mt-3 rounded-3xl border border-border/60 bg-card/85 p-4 text-center backdrop-blur">
        <p className="text-sm font-semibold">
          {sleeping ? "Sleeping — energy is refilling 💤" : "Turn off the lamp so your pet can nap"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Energy: {Math.round(state.energy)}% · Naps also slow down the other needs.
        </p>
      </div>
    </div>
  );
}
