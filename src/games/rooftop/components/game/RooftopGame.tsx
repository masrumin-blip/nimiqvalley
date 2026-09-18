import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";

import { Scene, type Controls } from "./Scene";

type Phase = "ready" | "playing" | "over";

function HexCoin({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 22" aria-hidden="true" className={className}>
      <polygon
        points="6,1 18,1 23,11 18,21 6,21 1,11"
        fill="var(--game-coin)"
        stroke="color-mix(in oklab, var(--game-ink) 35%, transparent)"
        strokeWidth="1"
      />
      <polygon points="9,5 15,5 18,11 15,17 9,17 6,11" fill="none" stroke="#fff8c9" strokeWidth="1" />
    </svg>
  );
}

export function RooftopGame() {
  const controls = useRef<Controls>({ left: false, right: false, jumpQueued: false });
  const [phase, setPhase] = useState<Phase>("ready");
  const [coins, setCoins] = useState(0);
  const [meters, setMeters] = useState(0);
  const [speed, setSpeed] = useState(15);
  const [best, setBest] = useState(0);
  const [runId, setRunId] = useState(0);
  const [impact, setImpact] = useState(false);
  const deathTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deathPending = useRef(false);

  useEffect(() => {
    const stored = Number(localStorage.getItem("nimiq-rooftop-best-coins") ?? 0);
    if (!Number.isNaN(stored)) setBest(stored);
  }, []);

  const start = useCallback(() => {
    if (deathTimer.current) clearTimeout(deathTimer.current);
    deathTimer.current = null;
    deathPending.current = false;
    setImpact(false);
    setCoins(0);
    setMeters(0);
    setSpeed(15);
    setRunId((r) => r + 1);
    controls.current = { left: false, right: false, jumpQueued: false };
    setPhase("playing");
  }, []);

  const onDead = useCallback((c: number, m: number, cause: "obstacle" | "fall") => {
    if (deathPending.current) return;
    deathPending.current = true;
    setImpact(cause === "obstacle");
    setCoins(c);
    setMeters(m);
    deathTimer.current = setTimeout(
      () => {
        setImpact(false);
        setPhase("over");
        setBest((b) => {
          const next = Math.max(b, c);
          localStorage.setItem("nimiq-rooftop-best-coins", String(next));
          return next;
        });
      },
      cause === "obstacle" ? 180 : 0,
    );
  }, []);

  useEffect(
    () => () => {
      if (deathTimer.current) clearTimeout(deathTimer.current);
    },
    [],
  );

  const onScore = useCallback((c: number, m: number, s: number) => {
    setCoins(c);
    setMeters(m);
    setSpeed(s);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) controls.current.left = true;
      if (["ArrowRight", "d", "D"].includes(e.key)) controls.current.right = true;
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) {
        e.preventDefault();
        if (phase === "playing") controls.current.jumpQueued = true;
        else start();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) controls.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) controls.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, start]);

  const hold = (side: "left" | "right") => ({
    onPointerDown: () => (controls.current[side] = true),
    onPointerUp: () => (controls.current[side] = false),
    onPointerLeave: () => (controls.current[side] = false),
    onPointerCancel: () => (controls.current[side] = false),
  });

  const difficulty = Math.min(100, Math.round(((speed - 15) / 20) * 100));

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-game-sky font-[family-name:var(--font-body)] text-game-ink">
      <Canvas shadows camera={{ position: [0, 14, -26], fov: 58 }} dpr={[1, 2]}>
        <Scene
          playing={phase === "playing"}
          controls={controls}
          onScore={onScore}
          onDead={onDead}
          runId={runId}
        />
      </Canvas>

      {/* soft vignette for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 85% at 50% 38%, transparent 42%, color-mix(in oklab, var(--game-ink) 46%, transparent) 100%)",
        }}
      />

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-game-flame transition-opacity duration-150 ${impact ? "opacity-45" : "opacity-0"}`}
      />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="rounded-2xl border border-game-gold/40 bg-game-panel/75 px-4 py-2.5 shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="text-[10px] uppercase tracking-[0.3em] opacity-55">Coins</div>
          <div className="mt-0.5 flex items-center gap-2">
            <HexCoin className="h-6 w-6 drop-shadow-[0_0_10px_var(--game-coin)]" />
            <span className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide">
              {coins}
            </span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.22em] opacity-50">{meters} m</div>
        </div>
        <div className="rounded-2xl border border-game-gold/40 bg-game-panel/75 px-4 py-2.5 text-right shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="text-[10px] uppercase tracking-[0.3em] opacity-55">Best</div>
          <div className="font-[family-name:var(--font-display)] text-2xl leading-none">{best}</div>
          <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-game-ink/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-game-gold to-game-flame transition-all duration-300"
              style={{ width: `${difficulty}%` }}
            />
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.22em] opacity-55">
            Difficulty {difficulty}%
          </div>
        </div>
      </div>

      {/* touch controls */}
      {phase === "playing" && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 lg:hidden">
          <div className="flex gap-3">
            <button
              aria-label="Move left"
              {...hold("left")}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-game-gold/50 bg-game-panel/70 text-2xl shadow-[var(--shadow-panel)] backdrop-blur-xl transition active:scale-95 active:bg-game-panel"
            >
              ←
            </button>
            <button
              aria-label="Move right"
              {...hold("right")}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-game-gold/50 bg-game-panel/70 text-2xl shadow-[var(--shadow-panel)] backdrop-blur-xl transition active:scale-95 active:bg-game-panel"
            >
              →
            </button>
          </div>
          <button
            aria-label="Jump"
            onPointerDown={() => (controls.current.jumpQueued = true)}
            className="h-20 w-20 rounded-full bg-gradient-to-b from-game-gold to-game-flame font-[family-name:var(--font-display)] text-lg tracking-[0.18em] text-game-panel shadow-[var(--shadow-panel)] transition active:scale-95"
          >
            JUMP
          </button>
        </div>
      )}

      {phase !== "playing" && (
        <div className="absolute inset-0 flex items-center justify-center px-6 backdrop-blur-[3px]">
          <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-game-gold/50 bg-game-panel/90 text-center shadow-[var(--shadow-panel)]">
            <div className="h-1.5 w-full bg-gradient-to-r from-game-coin via-game-flame to-game-gold" />
            <div className="p-7">
              {phase === "ready" && (
                <p className="text-[10px] uppercase tracking-[0.42em] opacity-55">Endless Runner</p>
              )}
              <h1 className="mt-1 font-[family-name:var(--font-display)] text-5xl leading-none tracking-wide">
                {phase === "ready" ? "Nimiq Rooftop" : "You Fell"}
              </h1>

              {phase === "over" ? (
                <>
                <div className="mt-4 flex justify-center">
                  <div
                    className="rounded-full border border-game-coin/70 bg-game-ink/25 px-4 py-1.5 font-[family-name:var(--font-display)] text-xl tracking-[0.3em]"
                    style={{
                      color: "var(--game-coin)",
                      textShadow:
                        "0 0 6px var(--game-coin), 0 0 18px var(--game-coin), 0 0 32px var(--game-coin)",
                    }}
                  >
                    NIMIQ ROOFTOP
                  </div>
                </div>
                <div className="mt-4 flex items-stretch gap-3">
                  <div className="flex-1 rounded-2xl border border-game-gold/35 bg-game-sky/35 px-3 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <HexCoin className="h-5 w-5" />
                      <span className="font-[family-name:var(--font-display)] text-3xl leading-none">
                        {coins}
                      </span>
                    </div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.24em] opacity-55">
                      Coins
                    </div>
                  </div>
                  <div className="flex-1 rounded-2xl border border-game-gold/35 bg-game-sky/35 px-3 py-3">
                    <div className="font-[family-name:var(--font-display)] text-3xl leading-none">
                      {meters}m
                    </div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.24em] opacity-55">
                      Distance
                    </div>
                  </div>
                </div>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed opacity-70">
                  Sprint across the sunset skyline. Jump the gaps, dodge the obstacles and grab
                  every neon coin — it only gets faster.
                </p>
              )}

              <button
                onClick={start}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-game-flame to-game-gold px-6 py-4 font-[family-name:var(--font-display)] text-xl tracking-[0.22em] text-game-panel shadow-[var(--shadow-panel)] transition hover:brightness-105 active:scale-[0.98]"
              >
                {phase === "ready" ? "START RUN" : "RUN AGAIN"}
              </button>
              <p className="mt-5 text-[10px] uppercase tracking-[0.22em] opacity-55">
                ← → move · space to jump · on mobile use the on-screen buttons
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
