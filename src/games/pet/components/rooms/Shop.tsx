import { useState } from "react";
import { Check, Coins, Lock } from "lucide-react";
import { Pet } from "@/games/pet/components/pet/Pet";
import { COSMETICS, FOODS } from "@/games/pet/game/items";
import { sfx } from "@/games/pet/game/audio";
import { useGame } from "@/games/pet/game/store";
import { cn } from "@/lib/utils";

type Tab = "food" | "hat" | "glasses";

const TABS: { id: Tab; label: string }[] = [
  { id: "food", label: "🍽️ Food" },
  { id: "hat", label: "🎩 Hats" },
  { id: "glasses", label: "🕶️ Glasses" },
];

export function Shop() {
  const { state, mood, buy, equip, flash } = useGame();
  const [tab, setTab] = useState<Tab>("food");

  const handleBuy = (id: string, name: string) => {
    if (buy(id)) {
      sfx.buy();
      flash(`Bought and equipped ${name}! 🎉`);
    } else {
      sfx.deny();
      flash("Not enough coins — play the arcade!");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-4 rounded-3xl border border-border/60 bg-card/85 p-3 backdrop-blur">
        <Pet
          mood={mood}
          hat={state.hat}
          glasses={state.glasses}
          dirt={state.dirt}
          onTap={() => sfx.giggle()}
          className="h-28 w-28 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold">Dress up {state.name}</p>
          <p className="text-xs text-muted-foreground">
            Tap an owned item to wear it. Tap again to take it off.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            <Coins className="size-3.5" /> {state.coins} coins
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              sfx.tap();
            }}
            className={cn(
              "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition",
              tab === t.id
                ? "border-transparent bg-primary text-primary-foreground shadow"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {tab === "food" &&
          FOODS.map((f) => (
            <button
              key={f.id}
              onClick={() => handleBuy(f.id, f.name)}
              className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
            >
              <span className="text-3xl">{f.emoji}</span>
              <span className="text-xs font-semibold">{f.name}</span>
              <span className="text-[11px] text-muted-foreground">
                +{f.hunger} hunger{f.fun ? ` · +${f.fun} fun` : ""}
                {f.energy ? ` · +${f.energy} energy` : ""}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                <Coins className="size-3" /> {f.price}
              </span>
              <span className="text-[10px] text-muted-foreground">Owned: {state.pantry[f.id] ?? 0}</span>
            </button>
          ))}

        {tab !== "food" &&
          COSMETICS.filter((c) => c.kind === tab).map((c) => {
            const owned = state.owned.includes(c.id);
            const worn =
              (c.kind === "hat" && state.hat === c.value) ||
              (c.kind === "glasses" && state.glasses === c.value);
            return (
              <button
                key={c.id}
                onClick={() => {
                  if (owned) {
                    equip(c.id);
                    sfx.pop();
                  } else {
                    handleBuy(c.id, c.name);
                  }
                }}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-2xl border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md active:scale-95",
                  worn ? "border-primary ring-2 ring-primary/40" : "border-border",
                )}
              >
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-xs font-semibold">{c.name}</span>
                {owned ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                    <Check className="size-3" /> {worn ? "Wearing" : "Owned"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                    {state.coins < c.price ? <Lock className="size-3" /> : <Coins className="size-3" />} {c.price}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}
