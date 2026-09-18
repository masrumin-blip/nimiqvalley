import type { Difficulty } from "@/games/checkers/lib/ai";

const LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function Controls({
  difficulty,
  onRestart,
  onExit,
}: {
  difficulty: Difficulty;
  onRestart: () => void;
  onExit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-xl bg-arena-panel px-4 py-2 text-sm font-semibold text-neon-blue">
        Level: {LABELS[difficulty]}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg border border-neon-yellow/50 px-4 py-2 text-sm font-semibold text-neon-yellow transition-colors hover:bg-neon-yellow/10"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-destructive/60 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
