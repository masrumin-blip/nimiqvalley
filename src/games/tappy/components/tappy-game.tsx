import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";
import { Play, RotateCcw } from "lucide-react";
import { startGameRun, submitGameRun } from "@/lib/game-runs.functions";
import { currentLeagueId } from "@/lib/verification-info";
import {
  BIRD_R,
  BIRD_X,
  GROUND_H,
  H,
  MAX_TICKS,
  SPEED,
  TICK_DT,
  TREE_W,
  W,
  createRng,
  createSimState,
  levelFor,
  stepSim,
  type SimState,
} from "@/games/tappy/tappy-sim";

type Phase = "ready" | "playing" | "dead";

// Re-exported shape for the renderer below; the authoritative version lives in tappy-sim.ts.
type FutureTree = SimState["trees"][number];

// Each obstacle keeps its spawned variant for its entire lifetime.
const coreColors = ["#c478ff", "#42e8f5", "#ff75c7", "#58f0aa"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1
  size: number;
  hue: number;
}

export function TappyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [best, setBest] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("tappy-best") ?? 0);
  });

  // Mutable game state in a ref so the loop never re-subscribes.
  // `sim` (from tappy-sim.ts) is the only thing that decides score/collisions.
  // Everything else here (particles, flash, shake, rot, idle birdY) is
  // cosmetic and never affects the verified result.
  const gs = useRef({
    phase: "ready" as Phase,
    sim: null as SimState | null,
    rng: null as (() => number) | null,
    simAcc: 0, // fixed-timestep accumulator
    simTickCount: 0,
    pendingFlap: false,
    inputTicks: [] as number[],
    sessionId: null as string | null, // null = local practice run, not submitted for verification
    birdY: H / 2, // mirrors sim.birdY while playing; free-runs during idle bob otherwise
    vel: 0,
    rot: 0,
    trees: [] as FutureTree[],
    time: 0,
    flash: 0,
    particles: [] as Particle[],
    shake: 0,
  });

  // A run's seed always comes from the server so a player can never pick a
  // seed that's easy to farm. Pre-fetched ahead of time so tapping "start"
  // feels instant.
  const nextSessionRef = useRef<{ sessionId: string; seed: number } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const prefetchSession = useCallback(async () => {
    try {
      const session = await startGameRun({ data: { slug: "tappy", leagueId: currentLeagueId() } });
      nextSessionRef.current = session;
      setSessionReady(true);
    } catch {
      // Not signed in, or the request failed — the game still works locally,
      // it just won't be eligible for the leaderboard until a session exists.
      nextSessionRef.current = null;
      setSessionReady(false);
    }
  }, []);

  useEffect(() => {
    void prefetchSession();
  }, [prefetchSession]);

  const startGame = useCallback(() => {
    const g = gs.current;
    const session = nextSessionRef.current;
    // Use the server-issued seed when we have one (verified run); otherwise
    // fall back to a local-only seed so guests can still play and practice.
    const seed = session?.seed ?? Math.floor(Math.random() * 2 ** 31);
    g.sessionId = session?.sessionId ?? null;
    nextSessionRef.current = null;
    setSessionReady(false);
    void prefetchSession(); // line up the next run in the background

    g.phase = "playing";
    g.rng = createRng(seed);
    g.sim = createSimState(g.rng);
    g.simAcc = 0;
    g.simTickCount = 0;
    g.pendingFlap = false;
    g.inputTicks = [];
    g.birdY = g.sim.birdY;
    g.vel = g.sim.vel;
    g.trees = [];
    g.flash = 0;
    g.particles = [];
    g.shake = 0;
    setScore(0);
    setLevel(1);
    setPhase("playing");
    playSfx("start");
  }, [prefetchSession]);

  const die = useCallback(() => {
    const g = gs.current;
    g.phase = "dead";
    g.flash = 1;
    g.shake = 1;
    // explosion burst
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      g.particles.push({
        x: BIRD_X,
        y: g.birdY,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 1,
        size: 2 + Math.random() * 4,
        hue: 20 + Math.random() * 40,
      });
    }
    playSfx("gameover");
    setPhase("dead");

    // Verification happens here: we send the seed's session id and the
    // ticks we flapped on, never the score itself. The server replays the
    // exact same simulation and writes whatever score *that* run produces.
    const sessionId = g.sessionId;
    const inputs = g.inputTicks;
    g.sessionId = null;
    if (sessionId) {
      void submitGameRun({ data: { slug: "tappy", sessionId, inputs } })
        .then((res) => {
          if (res.saved) {
            setBest((prev) => {
              const nb = Math.max(prev, res.score);
              localStorage.setItem("tappy-best", String(nb));
              return nb;
            });
          }
        })
        .catch(() => {
          /* Leaderboard write is best-effort from the client's point of view;
             the server remains the sole source of truth either way. */
        });
    }
  }, []);

  const flap = useCallback(() => {
    const g = gs.current;
    if (g.phase === "ready") {
      startGame();
      return;
    }
    if (g.phase === "playing") {
      // The actual velocity change only takes effect on the next fixed tick
      // (see the loop below) — this just marks the request and plays the
      // instant feedback so input still feels responsive.
      g.pendingFlap = true;
      playSfx("jump", 0.6);
      // flap burst
      for (let i = 0; i < 6; i++) {
        g.particles.push({
          x: BIRD_X - 10,
          y: g.birdY + 6,
          vx: -60 - Math.random() * 80,
          vy: 40 + Math.random() * 80,
          life: 0.8,
          size: 2 + Math.random() * 3,
          hue: 45 + Math.random() * 20,
        });
      }
    }
  }, [startGame]);

  // Input handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      const g = gs.current;
      g.time += dt;

      if (g.phase === "playing" && g.sim) {
        // Fixed-timestep simulation: physics/spawn/collisions always advance
        // in exact 1/60s increments regardless of the render frame rate, so
        // a run replays identically no matter what device it was played on.
        g.simAcc += dt;
        while (g.simAcc >= TICK_DT) {
          g.simAcc -= TICK_DT;
          const flapThisTick = g.pendingFlap;
          g.pendingFlap = false;
          if (flapThisTick) g.inputTicks.push(g.simTickCount);

          const stepped = stepSim(g.sim, g.rng!, flapThisTick);
          g.sim = stepped.state;
          g.simTickCount += 1;

          if (stepped.events.coins.length > 0) {
            setScore(g.sim.score);
            setLevel(levelFor(g.sim.score));
            playSfx("coin", 0.5);
            for (const coin of stepped.events.coins) {
              for (let i = 0; i < 14; i++) {
                const a = (Math.PI * 2 * i) / 14;
                g.particles.push({
                  x: coin.x,
                  y: coin.y,
                  vx: Math.cos(a) * (55 + Math.random() * 80),
                  vy: Math.sin(a) * (55 + Math.random() * 80),
                  life: 0.9,
                  size: 2 + Math.random() * 2.5,
                  hue: 48 + Math.random() * 10,
                });
              }
            }
          }

          if (stepped.events.died || g.simTickCount >= MAX_TICKS) {
            g.birdY = g.sim.birdY;
            g.trees = g.sim.trees;
            die();
            break;
          }
        }
        if (g.sim) {
          g.birdY = g.sim.birdY;
          g.vel = g.sim.vel;
          g.trees = g.sim.trees;
          g.rot = Math.max(-0.5, Math.min(1.3, g.sim.vel / 500));
        }
      } else if (g.phase === "ready") {
        // idle bobbing (purely cosmetic, not part of any run)
        g.birdY = H / 2 + Math.sin(g.time * 3) * 10;
        g.rot = Math.sin(g.time * 3) * 0.12;
      }
      // trail particles while flying
      if (g.phase === "playing" && Math.random() < 0.55) {
        g.particles.push({
          x: BIRD_X - BIRD_R,
          y: g.birdY + (Math.random() - 0.5) * 8,
          vx: -SPEED * 0.6,
          vy: (Math.random() - 0.5) * 30,
          life: 0.6,
          size: 1.5 + Math.random() * 2.5,
          hue: 45 + Math.random() * 25,
        });
      }

      // update particles
      for (const pt of g.particles) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 140 * dt;
        pt.life -= dt * 1.6;
      }
      g.particles = g.particles.filter((pt) => pt.life > 0);

      g.flash = Math.max(0, g.flash - dt * 3);
      g.shake = Math.max(0, g.shake - dt * 2.5);

      draw(ctx, g);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [die]);

  const onCanvasPointer = (e: React.PointerEvent) => {
    e.preventDefault();
    flap();
  };

  return (
    <div className="min-h-full bg-background bg-grid relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-center lg:gap-10 lg:py-14">
        {/* Game column */}
        <div className="flex w-full max-w-[420px] flex-col items-center gap-2 lg:gap-4">
          <header className="text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight text-glow sm:text-5xl">
              NIMIQ <span className="text-primary">TAPPY</span>
            </h1>
            <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
              Tap, click, or press space to fly. Collect coins and dodge every obstacle.
            </p>
          </header>

          <div
            ref={wrapRef}
            className="relative w-full overflow-hidden rounded-2xl border border-border/60 shadow-[0_0_60px_-12px] shadow-primary/40"
            style={{ aspectRatio: `${W}/${H}` }}
          >
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onPointerDown={onCanvasPointer}
              className="block h-full w-full cursor-pointer touch-none select-none"
            />

            {/* Score HUD */}
            {phase === "playing" && (
              <div className="pointer-events-none absolute inset-x-0 top-5 flex flex-col items-center gap-1 text-center">
                <span className="inline-flex items-center gap-2 font-display text-6xl font-bold text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                  <svg viewBox="0 0 32 32" className="h-8 w-8 text-chart-4" aria-hidden="true">
                    <polygon
                      points="2,16 9,4 23,4 30,16 23,28 9,28"
                      fill="currentColor"
                    />
                  </svg>
                  {score}
                </span>
                <span className="rounded-full border border-primary/40 bg-background/50 px-3 py-0.5 font-display text-xs tracking-widest text-primary">
                  LEVEL {level}
                </span>
              </div>
            )}

            {/* Ready overlay */}
            {phase === "ready" && (
              <button
                onClick={startGame}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/50 backdrop-blur-[2px] transition-colors hover:bg-background/40"
              >
                <span className="animate-float inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_40px] shadow-primary/60">
                  <Play className="ml-1 h-9 w-9" />
                </span>
                <span className="font-display text-xl font-semibold text-foreground">
                  Tap to start
                </span>
                {best > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Your best: <b className="text-primary">{best} coins</b>
                  </span>
                )}
                {!sessionReady && (
                  <span className="text-xs text-muted-foreground/70">
                    Connect your wallet for a verified, leaderboard-eligible run
                  </span>
                )}
              </button>
            )}

            {/* Game over overlay */}
            {phase === "dead" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 px-6 backdrop-blur-sm">
                <h2 className="font-display text-3xl font-bold text-destructive">GAME OVER</h2>
                <div className="flex items-center gap-6 text-center">
                  <div>
                     <p className="text-xs uppercase tracking-widest text-muted-foreground">Coins</p>
                    <p className="font-display text-4xl font-bold text-foreground">{score}</p>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div>
                     <p className="text-xs uppercase tracking-widest text-muted-foreground">Best</p>
                    <p className="font-display text-4xl font-bold text-primary">{best}</p>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 font-display text-sm font-semibold text-primary-foreground shadow-[0_0_25px_-5px] shadow-primary/60 transition hover:brightness-110"
                >
                   <RotateCcw className="h-4 w-4" /> Play again
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ---- Rendering ----
function draw(ctx: CanvasRenderingContext2D, g: typeof importState) {
  ctx.save();
  // screen shake
  if (g.shake > 0) {
    const s = g.shake * 8;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#050816");
  sky.addColorStop(0.45, "#0d1130");
  sky.addColorStop(0.8, "#1a1440");
  sky.addColorStop(1, "#241a4d");
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  // aurora bands
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const auroraShift = Math.sin(g.time * 0.4) * 30;
  const aurora = ctx.createLinearGradient(0, 60, W, 220);
  aurora.addColorStop(0, "rgba(57,255,136,0)");
  aurora.addColorStop(0.4, "rgba(57,255,200,0.06)");
  aurora.addColorStop(0.6, "rgba(120,80,255,0.08)");
  aurora.addColorStop(1, "rgba(57,255,136,0)");
  ctx.fillStyle = aurora;
  ctx.beginPath();
  ctx.moveTo(-20, 90 + auroraShift);
  ctx.bezierCurveTo(W * 0.3, 40 - auroraShift, W * 0.7, 160 + auroraShift, W + 20, 80);
  ctx.lineTo(W + 20, 160);
  ctx.bezierCurveTo(W * 0.7, 240 + auroraShift, W * 0.3, 120 - auroraShift, -20, 170 + auroraShift);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // stars (deterministic twinkle, two sizes)
  for (let i = 0; i < 56; i++) {
    const sx = (i * 97.13) % W;
    const sy = ((i * 61.7) % (H - GROUND_H - 60)) + 10;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(g.time * 1.5 + i));
    const big = i % 7 === 0;
    ctx.globalAlpha = tw * (big ? 0.95 : 0.6);
    ctx.fillStyle = big ? "#cfe8ff" : "#ffffff";
    const sz = big ? 2.6 : 1.6;
    ctx.fillRect(sx, sy, sz, sz);
    if (big) {
      // sparkle cross
      ctx.globalAlpha = tw * 0.35;
      ctx.fillRect(sx - 3, sy + 0.8, sz + 6, 1);
      ctx.fillRect(sx + 0.8, sy - 3, 1, sz + 6);
    }
  }
  ctx.globalAlpha = 1;

  // yellow, flat-top hexagonal moon with halo
  const mx = W - 70;
  const my = 82;
  const halo = ctx.createRadialGradient(mx, my, 20, mx, my, 70);
  halo.addColorStop(0, "rgba(255,230,0,0.3)");
  halo.addColorStop(1, "rgba(255,230,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(mx, my, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "#ffe600";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffe600";
  ctx.strokeStyle = "#fff7a8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6;
    const px = mx + Math.cos(angle) * 29;
    const py = my + Math.sin(angle) * 29;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // parallax skyline — far layer
  const farOff = g.phase === "playing" ? (g.time * SPEED * 0.15) % 200 : 0;
  ctx.fillStyle = "#111637";
  for (let block = -2; block * 200 - farOff < W + 200; block++) {
    const x = block * 200 - farOff;
    for (let b = 0; b < 4; b++) {
      const bw = 34 + ((b * 53) % 26);
      const bh = 60 + (((b * 97 + block * 41) % 90 + 90) % 90);
      ctx.fillRect(x + b * 52, H - GROUND_H - bh, bw, bh);
    }
  }
  // near layer with lit windows
  const nearOff = g.phase === "playing" ? (g.time * SPEED * 0.35) % 260 : 0;
  for (let block = -2; block * 260 - nearOff < W + 260; block++) {
    const x = block * 260 - nearOff;
    for (let b = 0; b < 3; b++) {
      const bx = x + b * 88;
      const bw = 52 + ((b * 31) % 20);
      const bh = 34 + (((b * 71 + block * 29) % 60 + 60) % 60);
      ctx.fillStyle = "#0b0e26";
      ctx.fillRect(bx, H - GROUND_H - bh, bw, bh);
      // windows
      ctx.fillStyle = "rgba(255,209,102,0.5)";
      for (let wy = H - GROUND_H - bh + 8; wy < H - GROUND_H - 8; wy += 12) {
        for (let wx = bx + 6; wx < bx + bw - 8; wx += 12) {
          if ((Math.floor(wx * 7 + wy * 13) % 5) < 2) ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
  }

  // futuristic trees
  for (const p of g.trees) {
    const top = p.gapY - p.gap / 2;
    const bottom = p.gapY + p.gap / 2;
    drawObstacle(ctx, p.x, 0, top, true, p.variant);
    drawObstacle(ctx, p.x, bottom, H - GROUND_H - bottom, false, p.variant);
    if (!p.coinCollected) drawCoin(ctx, p.x + TREE_W / 2, p.coinY, g.time);
  }

  // particles (behind bird, additive glow)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const pt of g.particles) {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = `hsl(${pt.hue} 100% 60%)`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // ground
  const gg = ctx.createLinearGradient(0, H - GROUND_H, 0, H);
  gg.addColorStop(0, "#1b1524");
  gg.addColorStop(1, "#0c0a14");
  ctx.fillStyle = gg;
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
  // neon edge with glow
  ctx.save();
  ctx.shadowColor = "#39ff88";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#39ff88";
  ctx.fillRect(0, H - GROUND_H, W, 3);
  ctx.restore();

  // perspective grid on ground
  ctx.strokeStyle = "rgba(57,255,136,0.18)";
  ctx.lineWidth = 1;
  const offset = g.phase === "playing" ? (g.time * SPEED) % 40 : 0;
  for (let x = -40 - offset; x < W + 40; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, H - GROUND_H + 4);
    ctx.lineTo(x - 24, H);
    ctx.stroke();
  }
  for (let i = 1; i <= 3; i++) {
    const y = H - GROUND_H + (GROUND_H / 4) * i;
    ctx.globalAlpha = 0.18 * (i / 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // bird
  drawBird(ctx, g);

  // death flash
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255,60,60,${g.flash * 0.4})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }
  ctx.restore();
}

function drawBird(ctx: CanvasRenderingContext2D, g: typeof importState) {
  ctx.save();
  ctx.translate(BIRD_X, g.birdY);
  ctx.rotate(g.rot);

  const flapSpeed = g.phase === "playing" ? 22 : 8;
  const wing = Math.sin(g.time * flapSpeed);

  // outer glow
  ctx.save();
  ctx.shadowColor = "#ffb01f";
  ctx.shadowBlur = 24;

  // body — radial golden gradient
  const body = ctx.createRadialGradient(-4, -5, 2, 0, 0, BIRD_R + 2);
  body.addColorStop(0, "#fff3b0");
  body.addColorStop(0.45, "#ffd23f");
  body.addColorStop(1, "#f0a500");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_R + 2, BIRD_R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // tail feathers
  ctx.fillStyle = "#ff6b35";
  ctx.beginPath();
  ctx.moveTo(-BIRD_R + 2, -2);
  ctx.lineTo(-BIRD_R - 12, -7 + wing * 2);
  ctx.lineTo(-BIRD_R - 9, 2);
  ctx.lineTo(-BIRD_R - 12, 8 + wing * 2);
  ctx.lineTo(-BIRD_R + 2, 5);
  ctx.closePath();
  ctx.fill();

  // wing — layered
  ctx.fillStyle = "#ff8c1a";
  ctx.beginPath();
  ctx.ellipse(-3, wing * 3, 10, 6 + wing * 3, -0.5 - wing * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffc85e";
  ctx.beginPath();
  ctx.ellipse(-2, wing * 3 - 1, 6, 3.5 + wing * 2, -0.5 - wing * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // crest feather
  ctx.strokeStyle = "#ff6b35";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-2, -BIRD_R + 2);
  ctx.quadraticCurveTo(-6, -BIRD_R - 8, -10, -BIRD_R - 6);
  ctx.stroke();

  // eye with shine
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(6, -5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#10121f";
  ctx.beginPath();
  ctx.arc(7.5, -5, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(8.3, -6, 1, 0, Math.PI * 2);
  ctx.fill();

  // beak
  const beak = ctx.createLinearGradient(10, 0, 22, 4);
  beak.addColorStop(0, "#ff8c42");
  beak.addColorStop(1, "#ff5722");
  ctx.fillStyle = beak;
  ctx.beginPath();
  ctx.moveTo(11, -2);
  ctx.lineTo(22, 1.5);
  ctx.lineTo(11, 6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  isTop: boolean,
  variant: number,
) {
  if (h <= 0) return;
  const color = coreColors[variant % coreColors.length] ?? coreColors[0] ?? "#c478ff";
  const center = x + TREE_W / 2;
  const mouthY = isTop ? y + h : y;
  const inward = isTop ? -1 : 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, TREE_W, h);
  ctx.clip();

  // A fixed, canvas-drawn energy cylinder. Everything stays within the
  // simulation's collision rectangle; the variant only chooses its color.
  const body = ctx.createLinearGradient(x, 0, x + TREE_W, 0);
  body.addColorStop(0, "#46536e");
  body.addColorStop(0.09, "#1a2543");
  body.addColorStop(0.22, "#0c132c");
  body.addColorStop(0.5, "#080e24");
  body.addColorStop(0.78, "#0c132c");
  body.addColorStop(0.91, "#1a2543");
  body.addColorStop(1, "#46536e");
  ctx.fillStyle = body;
  ctx.fillRect(x, y, TREE_W, h);

  // Recessed light well: a broad transparent bloom around a narrow solid core.
  const well = ctx.createLinearGradient(center - 20, 0, center + 20, 0);
  well.addColorStop(0, "transparent");
  well.addColorStop(0.5, color);
  well.addColorStop(1, "transparent");
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = well;
  ctx.fillRect(center - 20, y, 40, h);
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = color;
  ctx.fillRect(center - 8, y, 16, h);
  ctx.globalAlpha = 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.fillRect(center - 2, y, 4, h);
  ctx.shadowBlur = 0;

  // Slim metal rails and their colored inner reflections give the cylinder
  // shape without introducing a busy repeating pattern as it moves.
  ctx.fillStyle = "#8094b3";
  ctx.globalAlpha = 0.7;
  ctx.fillRect(x + 3, y, 2, h);
  ctx.fillRect(x + TREE_W - 5, y, 2, h);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(x + 10, y, 2, h);
  ctx.fillRect(x + TREE_W - 12, y, 2, h);
  ctx.globalAlpha = 1;

  // The solid end cap points into the gap; no glow extends into safe space.
  ctx.fillStyle = "#263450";
  ctx.fillRect(x, isTop ? mouthY - 12 : mouthY, TREE_W, 12);
  ctx.fillStyle = "#0a1028";
  ctx.beginPath();
  ctx.ellipse(center, mouthY + inward * 6, TREE_W / 2 - 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.stroke();
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const radius = 13 + Math.sin(time * 5) * 0.8;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "#ffe600";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#ffe600";
  ctx.strokeStyle = "#fff7a8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    const px = Math.cos(a) * radius;
    const py = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// helper type for draw signature
const importState = {
  phase: "ready" as Phase,
  birdY: 0,
  vel: 0,
  rot: 0,
  trees: [] as FutureTree[],
  time: 0,
  flash: 0,
  particles: [] as Particle[],
  shake: 0,
};
