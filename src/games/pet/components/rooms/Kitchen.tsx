import { useEffect, useRef, useState } from "react";
import { Pet } from "@/games/pet/components/pet/Pet";
import { FOODS, FOOD_MAP } from "@/games/pet/game/items";
import { sfx } from "@/games/pet/game/audio";
import { useGame } from "@/games/pet/game/store";
import { cn } from "@/lib/utils";

export function Kitchen() {
  const { state, mood, eat, flash } = useGame();
  const [chewing, setChewing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const chewingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (chewingTimer.current) clearTimeout(chewingTimer.current);
    };
  }, []);

  const feed = (id: string) => {
    if (state.sleeping) {
      sfx.deny();
      flash("Shhh… still sleeping 💤");
      return;
    }
    if ((state.pantry[id] ?? 0) > 0) {
      eat(id);
      sfx.chomp();
      setChewing(true);
      if (chewingTimer.current) clearTimeout(chewingTimer.current);
      chewingTimer.current = setTimeout(() => setChewing(false), 1000);
      flash(`Yum! ${FOOD_MAP[id]?.name ?? "snack"} 😋`);
    } else {
      sfx.deny();
      flash("None left — buy more in the Shop!");
    }
  };

  const owned = FOODS.filter((f) => (state.pantry[f.id] ?? 0) > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const id = e.dataTransfer.getData("text/plain") || dragging;
          if (id) feed(id);
          setDragging(null);
        }}
        className={cn(
          "relative flex min-h-0 flex-1 items-end justify-center overflow-hidden rounded-2xl border-2 border-dashed border-transparent transition-colors sm:rounded-3xl",
          dragOver && "border-primary/60 bg-primary/5",
        )}
      >
        <div className="absolute inset-x-4 bottom-3 h-12 rounded-2xl bg-[var(--room-counter)] shadow-inner sm:bottom-6 sm:h-16" />
        <Pet
          mood={chewing ? "eating" : mood}
          hat={state.hat}
          glasses={state.glasses}
          dirt={state.dirt}
          chewing={chewing}
          onTap={() => sfx.tap()}
          className="relative z-10 mb-6 h-44 w-44 sm:mb-10 sm:h-64 sm:w-64"
        />
        {dragOver && (
          <p className="absolute top-4 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
            Drop to feed!
          </p>
        )}
      </div>

      <div className="mt-2 shrink-0 rounded-2xl border border-border bg-card p-2 shadow-lg sm:mt-3 sm:rounded-3xl sm:border-2 sm:p-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase leading-tight tracking-wide text-foreground sm:mb-2 sm:text-xs">
          Pantry — drag onto your pet or tap to feed
        </p>
        {owned.length === 0 ? (
          <p className="py-4 text-center text-sm font-medium text-foreground/80">
            The fridge is empty! Play the arcade for coins, then stock up in the Shop.
          </p>
        ) : (
          <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1 sm:max-h-none sm:gap-3">
            {owned.map((f) => (
              <button
                key={f.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", f.id);
                  setDragging(f.id);
                }}
                onDragEnd={() => setDragging(null)}
                onClick={() => feed(f.id)}
                className="group relative flex size-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-border bg-secondary text-2xl leading-none shadow-md ring-1 ring-foreground/10 transition-transform hover:-translate-y-1 hover:shadow-lg active:scale-95 sm:size-[4.5rem] sm:rounded-2xl sm:border-2 sm:text-3xl"
                title={`${f.name} · +${f.hunger} hunger`}
              >
                <span className="drop-shadow-sm">{f.emoji}</span>
                <span className="text-[8px] font-bold uppercase tracking-wide text-secondary-foreground sm:text-[9px]">
                  {f.name}
                </span>
                <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border border-card bg-primary text-[10px] font-extrabold text-primary-foreground shadow sm:-right-1.5 sm:-top-1.5 sm:size-6 sm:border-2 sm:text-[11px]">
                  {state.pantry[f.id]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
