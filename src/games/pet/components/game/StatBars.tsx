import { Cookie, Droplets, Moon, Smile } from "lucide-react";
import { useGame } from "@/games/pet/game/store";
import { cn } from "@/lib/utils";

const BARS = [
  { key: "hunger", label: "Hunger", icon: Cookie, color: "var(--stat-hunger)" },
  { key: "hygiene", label: "Hygiene", icon: Droplets, color: "var(--stat-hygiene)" },
  { key: "energy", label: "Energy", icon: Moon, color: "var(--stat-energy)" },
  { key: "fun", label: "Fun", icon: Smile, color: "var(--stat-fun)" },
] as const;

export function StatBars({ className }: { className?: string }) {
  const { state } = useGame();

  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {BARS.map(({ key, label, icon: Icon, color }) => {
        const value = Math.round(state[key]);
        const low = value < 25;
        return (
          <div
            key={key}
            className="rounded-2xl border border-border/60 bg-card/80 px-3 py-2 shadow-sm backdrop-blur"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Icon className="size-3.5" style={{ color }} />
              {label}
              <span className={cn("ml-auto tabular-nums", low && "text-destructive")}>{value}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-500", low && "animate-pulse")}
                style={{ width: `${value}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
