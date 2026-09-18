import { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Heart, Play, RotateCcw } from "lucide-react";
import { sfx } from "@/games/pet/game/audio";
import { useGame } from "@/games/pet/game/store";
import { cn } from "@/lib/utils";
import { Pet } from "@/games/pet/components/pet/Pet";

interface Faller {
  id: number;
  x: number; // percent
  y: number; // percent
  vy: number;
  kind: "food" | "bomb" | "coin";
  emoji: string;
}

const FOOD_EMOJI = ["🍎", "🍰", "🍔", "🍣", "🍩", "🍓", "🥑", "🍌"];

type Phase = "idle" | "playing" | "over";

export function Arcade() {
  const { state, patch, addCoins, bump, flash } = useGame();
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [fallers, setFallers] = useState<Faller[]>([]);
  const [x, setX] = useState(50);
  const [caught, setCaught] = useState(false);
  const [eating, setEating] = useState(false);

  const areaRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(50);
  const fallersRef = useRef<Faller[]>([]);
  const idRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const spawnRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const keysRef = useRef<Record<string, boolean>>({});
  const caughtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPlayerX = (v: number) => {
    const clamped = Math.max(6, Math.min(94, v));
    xRef.current = clamped;
    setX(clamped);
  };

  const endGame = useCallback(() => {
    setPhase("over");
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const earned = Math.max(1, Math.round(scoreRef.current / 2));
    addCoins(earned);
    bump({ fun: Math.min(40, 8 + scoreRef.current / 3), energy: -6, hunger: -4 });
    if (scoreRef.current > state.highScore) patch({ highScore: scoreRef.current });
    sfx.gameOver();
    flash(`+${earned} coins earned! 🪙`);
  }, [addCoins, bump, flash, patch, state.highScore]);

  const start = () => {
    if (state.sleeping) {
      sfx.deny();
      flash("Your pet is asleep — wake them in the bedroom.");
      return;
    }
    if (state.energy < 8) {
      sfx.deny();
      flash("Too tired to play! Nap first 💤");
      return;
    }
    scoreRef.current = 0;
    livesRef.current = 3;
    fallersRef.current = [];
    setScore(0);
    setLives(3);
    setFallers([]);
    setCaught(false);
    setEating(false);
    if (caughtTimerRef.current) clearTimeout(caughtTimerRef.current);
    if (eatingTimerRef.current) clearTimeout(eatingTimerRef.current);
    setPlayerX(50);
    spawnRef.current = 0;
    lastRef.current = 0;
    setPhase("playing");
    sfx.pop();
  };

  useEffect(() => {
    if (phase !== "playing") return;

    const onKey = (e: KeyboardEvent) => {
      keysRef.current[e.key] = e.type === "keydown";
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    const step = (t: number) => {
      const dt = lastRef.current ? Math.min(48, t - lastRef.current) : 16;
      lastRef.current = t;

      if (keysRef.current["ArrowLeft"]) setPlayerX(xRef.current - dt * 0.055);
      if (keysRef.current["ArrowRight"]) setPlayerX(xRef.current + dt * 0.055);

      spawnRef.current -= dt;
      const difficulty = 1 + Math.min(1.6, scoreRef.current / 40);
      if (spawnRef.current <= 0) {
        spawnRef.current = 780 / difficulty;
        const roll = Math.random();
        const kind: Faller["kind"] = roll < 0.16 ? "bomb" : roll < 0.28 ? "coin" : "food";
        fallersRef.current.push({
          id: ++idRef.current,
          x: 8 + Math.random() * 84,
          y: -6,
          vy: (0.026 + Math.random() * 0.014) * difficulty,
          kind,
          emoji:
            kind === "bomb"
              ? "💣"
              : kind === "coin"
                ? "🪙"
                : (FOOD_EMOJI[Math.floor(Math.random() * FOOD_EMOJI.length)] ?? "🍎"),
        });
      }

      const next: Faller[] = [];
      for (const f of fallersRef.current) {
        const y = f.y + f.vy * dt;
        const hit = y > 78 && y < 96 && Math.abs(f.x - xRef.current) < 11;
        if (hit) {
          if (f.kind === "bomb") {
            livesRef.current -= 1;
            setLives(livesRef.current);
            sfx.hurt();
          } else if (f.kind === "coin") {
            scoreRef.current += 5;
            setScore(scoreRef.current);
            sfx.coin();
          } else {
            scoreRef.current += 2;
            setScore(scoreRef.current);
            sfx.chomp();
            setEating(true);
            if (eatingTimerRef.current) clearTimeout(eatingTimerRef.current);
            eatingTimerRef.current = setTimeout(() => setEating(false), 1000);
          }
          setCaught(true);
          if (caughtTimerRef.current) clearTimeout(caughtTimerRef.current);
          caughtTimerRef.current = setTimeout(() => setCaught(false), 180);
          continue;
        }
        if (y > 104) {
          if (f.kind === "food") {
            livesRef.current -= 1;
            setLives(livesRef.current);
            sfx.deny();
          }
          continue;
        }
        next.push({ ...f, y });
      }
      fallersRef.current = next;
      setFallers(next);

      if (livesRef.current <= 0) {
        endGame();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (caughtTimerRef.current) clearTimeout(caughtTimerRef.current);
      if (eatingTimerRef.current) clearTimeout(eatingTimerRef.current);
    };
  }, [phase, endGame]);

  const trackPointer = (clientX: number) => {
    const box = areaRef.current?.getBoundingClientRect();
    if (!box) return;
    setPlayerX(((clientX - box.left) / box.width) * 100);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center gap-3 text-sm font-semibold">
        <span className="rounded-full bg-card/85 px-3 py-1">Score {score}</span>
        <span className="flex items-center gap-1 rounded-full bg-card/85 px-3 py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              className={cn("size-4", i < lives ? "fill-red-500 text-red-500" : "text-muted-foreground/40")}
            />
          ))}
        </span>
        <span className="ml-auto rounded-full bg-card/85 px-3 py-1 text-xs text-muted-foreground">
          Best {state.highScore}
        </span>
      </div>

      <div
        ref={areaRef}
        onPointerMove={(e) => trackPointer(e.clientX)}
        onPointerDown={(e) => trackPointer(e.clientX)}
        className="relative flex-1 touch-none overflow-hidden rounded-3xl border border-border/60 bg-[var(--room-arcade)]"
      >
        {fallers.map((f) => (
          <span
            key={f.id}
            className="absolute -translate-x-1/2 text-3xl"
            style={{ left: `${f.x}%`, top: `${f.y}%` }}
          >
            {f.emoji}
          </span>
        ))}

        {/* pet player */}
        <div
          className="absolute bottom-0 h-24 w-24 transition-transform duration-100 sm:h-28 sm:w-28"
          style={{ left: `${x}%`, transform: `translateX(-50%) scale(${caught ? 1.14 : 1})` }}
        >
          <Pet
            mood={eating ? "eating" : "happy"}
            hat={state.hat}
            glasses={state.glasses}
            dirt={state.dirt}
            chewing={eating}
            playing={phase === "playing"}
            onTap={() => sfx.giggle()}
            className="h-full w-full"
          />
        </div>

        {phase !== "playing" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
            <div className="max-w-xs rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
              <h3 className="text-lg font-bold">
                {phase === "idle" ? "Snack Catcher" : "Game over!"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {phase === "idle"
                  ? "Move the basket to catch food and coins. Dodge bombs, don't drop snacks."
                  : `You scored ${score} and earned ${Math.max(1, Math.round(score / 2))} coins.`}
              </p>
              <button
                onClick={start}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:brightness-110 active:scale-95"
              >
                {phase === "idle" ? <Play className="size-4" /> : <RotateCcw className="size-4" />}
                {phase === "idle" ? "Play" : "Play again"}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Coins className="size-3.5" /> Coins earned here can be spent in the Shop.
      </p>
    </div>
  );
}
