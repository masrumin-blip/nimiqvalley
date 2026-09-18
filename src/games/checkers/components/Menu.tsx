import type { Difficulty } from "@/games/checkers/lib/ai";
import { NEON_COLORS, type NeonColor } from "./Piece";

const LEVELS: { id: Difficulty; label: string; hint: string }[] = [
  { id: "easy", label: "Easy", hint: "Relaxed play with frequent mistakes" },
  { id: "medium", label: "Medium", hint: "Plans several moves ahead" },
  { id: "hard", label: "Hard", hint: "Deeper calculation and stronger play" },
];

const COLOR_IDS: NeonColor[] = ["yellow", "blue", "green", "pink", "orange", "purple"];

const HEX = "3,50 27,7 73,7 97,50 73,93 27,93";

export function Menu({
  color,
  cpuColor,
  difficulty,
  onColor,
  onCpuColor,
  onDifficulty,
  onStart,
}: {
  color: NeonColor;
  cpuColor: NeonColor;
  difficulty: Difficulty;
  onColor: (c: NeonColor) => void;
  onCpuColor: (c: NeonColor) => void;
  onDifficulty: (d: Difficulty) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-10">
      <div className="text-center">
        <h1 className="text-5xl font-black tracking-tight text-neon-yellow drop-shadow-[0_0_18px_var(--color-neon-yellow-deep)]">
          NIMIQ CHECKERS
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          International Draughts · 10×10 · Play against the CPU
        </p>
      </div>

      <section className="grid w-full max-w-xl grid-cols-2 gap-5">
        {[
          { label: "Your color", value: color, onChange: onColor },
          { label: "CPU color", value: cpuColor, onChange: onCpuColor },
        ].map((picker) => (
          <div key={picker.label}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {picker.label}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_IDS.map((id) => {
                const meta = NEON_COLORS[id];
                const active = id === picker.value;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => picker.onChange(id)}
                    aria-label={`${picker.label}: ${meta.label}`}
                    aria-pressed={active}
                    className={[
                      "flex min-h-14 items-center justify-center rounded-xl bg-arena-panel p-2 transition-all",
                      active ? "ring-2" : "opacity-65 hover:opacity-100",
                    ].join(" ")}
                    style={
                      active
                        ? { boxShadow: `0 0 18px ${meta.stroke}`, color: meta.stroke }
                        : undefined
                    }
                  >
                    <svg viewBox="0 0 100 100" className="h-9 w-9" aria-hidden="true">
                      <polygon points={HEX} fill={meta.fill} stroke={meta.stroke} strokeWidth={8} />
                    </svg>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-sm font-semibold" style={{ color: NEON_COLORS[picker.value].stroke }}>
              {NEON_COLORS[picker.value].label}
            </p>
          </div>
        ))}
      </section>

      <section className="w-full max-w-md">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Difficulty
        </h2>
        <div className="flex flex-col gap-2">
          {LEVELS.map((level) => {
            const active = level.id === difficulty;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => onDifficulty(level.id)}
                aria-pressed={active}
                className={[
                  "rounded-xl px-4 py-3 text-left transition-colors",
                  active
                    ? "bg-neon-blue-deep text-neon-blue shadow-[0_0_16px_var(--color-neon-blue-deep)]"
                    : "bg-arena-panel text-muted-foreground hover:text-neon-blue",
                ].join(" ")}
              >
                <span className="block text-base font-bold">{level.label}</span>
                <span className="block text-xs opacity-80">{level.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={onStart}
        className="w-full max-w-md rounded-xl border-2 border-neon-yellow bg-neon-yellow/10 px-6 py-4 text-lg font-black tracking-wide text-neon-yellow shadow-[0_0_24px_var(--color-neon-yellow-deep)] transition-colors hover:bg-neon-yellow/20"
      >
        START GAME
      </button>
    </div>
  );
}
