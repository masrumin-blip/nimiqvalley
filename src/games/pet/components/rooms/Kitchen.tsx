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
    <div className="flex min-h-0 flex-1 flex-col">
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
          "relative flex flex-1 items-end justify-center rounded-3xl border-2 border-dashed border-transparent transition-colors",
          dragOver && "border-primary/60 bg-primary/5",
        )}
      >
        <div className="absolute inset-x-4 bottom-6 h-16 rounded-2xl bg-[var(--room-counter)] shadow-inner" />
        <Pet
          mood={chewing ? "eating" : mood}
          hat={state.hat}
          glasses={state.glasses}
          dirt={state.dirt}
          chewing={chewing}
          onTap={() => sfx.tap()}
          className="relative z-10 mb-10 h-52 w-52 sm:h-64 sm:w-64"
        />
        {dragOver && (
          <p className="absolute top-4 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
            Drop to feed!
          </p>
        )}
      </div>

      <div className="mt-3 rounded-3xl border-2 border-border bg-card p-3 shadow-lg">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground">
          Pantry — drag onto your pet or tap to feed
        </p>
        {owned.length === 0 ? (
          <p className="py-4 text-center text-sm font-medium text-foreground/80">
            The fridge is empty! Play the arcade for coins, then stock up in the Shop.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
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
                className="group relative flex size-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-border bg-secondary text-3xl leading-none shadow-md ring-1 ring-foreground/10 transition-transform hover:-translate-y-1 hover:shadow-lg active:scale-95"
                title={`${f.name} · +${f.hunger} hunger`}
              >
                <span className="drop-shadow-sm">{f.emoji}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide text-secondary-foreground">
                  {f.name}
                </span>
                <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border-2 border-card bg-primary text-[11px] font-extrabold text-primary-foreground shadow">
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
