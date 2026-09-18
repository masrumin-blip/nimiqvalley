import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";
import { Trophy, Medal, Play, RotateCcw, Loader2, Crown } from "lucide-react";
import { reportScore } from "@/lib/report-score";

// ---- Game constants (logical canvas units) ----
const W = 400;
const H = 640;
const BIRD_X = 96;
const BIRD_R = 14;
const GRAVITY = 1500; // px/s^2
const FLAP = -430; // px/s
const TREE_W = 68;
const GAP = 165;
const GAP_MIN = 112;
const SPEED = 170; // px/s
const SPEED_MAX = 330;
const SPAWN_EVERY = 1.45; // seconds
const SPAWN_MIN = 0.95;
const GROUND_H = 70;

// ---- Progressive difficulty ----
// Level naik setiap 5 poin; makin tinggi level makin cepat & celah makin sempit.
function levelFor(score: number) {
  return Math.floor(score / 5) + 1;
}
function difficultyFor(score: number) {
  const t = Math.min(1, score / 50); // penuh pada skor 50
  const e = t * t * (3 - 2 * t); // smoothstep
  return {
    speed: SPEED + (SPEED_MAX - SPEED) * e,
    gap: GAP - (GAP - GAP_MIN) * e,
    spawn: SPAWN_EVERY - (SPAWN_EVERY - SPAWN_MIN) * e,
    wobble: e, // pohon bergerak naik-turun di level tinggi
  };
}

type Phase = "ready" | "playing" | "dead";

interface FutureTree {
  x: number;
  gapY: number; // center of gap
  baseY: number;
  gap: number;
  amp: number; // amplitudo gerak vertikal
  phase: number;
  variant: number;
  coinY: number;
  coinCollected: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1
  size: number;
  hue: number;
}

interface LeaderRow {
  id: string;
  player_name: string;
  score: number;
  created_at: string;
}

function randomGapY(gap: number, amp = 0) {
  const margin = 60 + amp;
  const span = H - GROUND_H - gap - margin * 2;
  return margin + gap / 2 + Math.random() * Math.max(20, span);
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
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  const [playerName, setPlayerName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("tappy-name") ?? "";
  });
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Mutable game state in a ref so the loop never re-subscribes
  const gs = useRef({
    phase: "ready" as Phase,
    birdY: H / 2,
    vel: 0,
    rot: 0,
    trees: [] as FutureTree[],
    spawnT: 0,
    score: 0,
    time: 0,
    flash: 0,
    particles: [] as Particle[],
    shake: 0,
    nextVariant: 0,
  });

  const fetchLeaders = useCallback(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("tappy-leaderboard");
    setLeaders(saved ? (JSON.parse(saved) as LeaderRow[]) : []);
    setLoadingLeaders(false);
  }, []);

  useEffect(() => {
    fetchLeaders();
  }, [fetchLeaders]);

  const startGame = useCallback(() => {
    const g = gs.current;
    g.phase = "playing";
    g.birdY = H / 2;
    g.vel = FLAP * 0.6;
    g.trees = [];
    g.spawnT = 0.9;
    g.score = 0;
    g.flash = 0;
    g.particles = [];
    g.shake = 0;
    g.nextVariant = Math.floor(Math.random() * 4);
    setScore(0);
    setLevel(1);
    setPhase("playing");
    setSubmitState("idle");
    playSfx("start");
  }, []);

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
    reportScore("tappy", g.score);
    setBest((prev) => {
      const nb = Math.max(prev, g.score);
      localStorage.setItem("tappy-best", String(nb));
      return nb;
    });
  }, []);

  const flap = useCallback(() => {
    const g = gs.current;
    if (g.phase === "ready") {
      startGame();
      return;
    }
    if (g.phase === "playing") {
      g.vel = FLAP;
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

      if (g.phase === "playing") {
        const d = difficultyFor(g.score);
        g.vel += GRAVITY * dt;
        g.birdY += g.vel * dt;
        g.rot = Math.max(-0.5, Math.min(1.3, g.vel / 500));

        // spawn futuristic trees
        g.spawnT -= dt;
        if (g.spawnT <= 0) {
          const amp = g.score >= 15 ? d.wobble * 42 : 0;
          const baseY = randomGapY(d.gap, amp);
          g.trees.push({
            x: W + TREE_W,
            gapY: baseY,
            baseY,
            gap: d.gap,
            amp,
            phase: Math.random() * Math.PI * 2,
            variant: g.nextVariant,
            coinY: baseY + (Math.random() - 0.5) * Math.min(44, d.gap * 0.28),
            coinCollected: false,
          });
          g.nextVariant = (g.nextVariant + 1 + Math.floor(Math.random() * 3)) % 4;
          g.spawnT = d.spawn;
        }

        // move futuristic trees
        for (const p of g.trees) {
          p.x -= d.speed * dt;
          p.gapY = p.amp > 0 ? p.baseY + Math.sin(g.time * 1.6 + p.phase) * p.amp : p.baseY;
          p.coinY = p.gapY;
        }
        g.trees = g.trees.filter((p) => p.x + TREE_W > -20);

        // Coins are the only source of score.
        for (const p of g.trees) {
          if (p.coinCollected) continue;
          const coinX = p.x + TREE_W / 2;
          const dx = BIRD_X - coinX;
          const dy = g.birdY - p.coinY;
          if (dx * dx + dy * dy < (BIRD_R + 15) * (BIRD_R + 15)) {
            p.coinCollected = true;
            g.score += 1;
            setScore(g.score);
            setLevel(levelFor(g.score));
            playSfx("coin", 0.5);
            for (let i = 0; i < 14; i++) {
              const a = (Math.PI * 2 * i) / 14;
              g.particles.push({
                x: coinX,
                y: p.coinY,
                vx: Math.cos(a) * (55 + Math.random() * 80),
                vy: Math.sin(a) * (55 + Math.random() * 80),
                life: 0.9,
                size: 2 + Math.random() * 2.5,
                hue: 48 + Math.random() * 10,
              });
            }
          }
        }

        // collisions
        if (g.birdY + BIRD_R >= H - GROUND_H || g.birdY - BIRD_R <= 0) {
          die();
        } else {
          for (const p of g.trees) {
            const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + TREE_W;
            if (inX) {
              const top = p.gapY - p.gap / 2;
              const bottom = p.gapY + p.gap / 2;
              if (g.birdY - BIRD_R < top || g.birdY + BIRD_R > bottom) {
                die();
                break;
              }
            }
          }
        }
      } else if (g.phase === "ready") {
        // idle bobbing
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

  const submitScore = async () => {
    const name = playerName.trim().slice(0, 20);
    if (!name || submitState === "saving") return;
    setSubmitState("saving");
    localStorage.setItem("tappy-name", name);
    const row: LeaderRow = {
      id: `${Date.now()}`,
      player_name: name,
      score: gs.current.score,
      created_at: new Date().toISOString(),
    };
    const next = [row, ...leaders]
      .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at))
      .slice(0, 10);
    window.localStorage.setItem("tappy-leaderboard", JSON.stringify(next));
    setLeaders(next);
    setSubmitState("saved");
  };

  const onCanvasPointer = (e: React.PointerEvent) => {
    e.preventDefault();
    flap();
  };

  return (
    <div className="min-h-screen bg-background bg-grid relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-6 px-4 py-8 lg:flex-row lg:items-start lg:justify-center lg:gap-10 lg:py-14">
        {/* Game column */}
        <div className="flex w-full max-w-[420px] flex-col items-center gap-4">
          <header className="text-center">
            <h1 className="font-display text-4xl font-bold tracking-tight text-glow sm:text-5xl">
              NIMIQ <span className="text-primary">TAPPY</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
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

                {submitState === "saved" ? (
                  <p className="rounded-lg bg-primary/15 px-4 py-2 text-sm font-medium text-primary">
                     Score saved to the leaderboard!
                  </p>
                ) : (
                  <div className="flex w-full max-w-[260px] flex-col gap-2">
                    <input
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      maxLength={20}
                       placeholder="Your name..."
                      className="h-10 w-full rounded-lg border border-input bg-card px-3 text-center text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/40"
                    />
                    <button
                      onClick={submitScore}
                      disabled={submitState === "saving" || !playerName.trim()}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-secondary font-display text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80 disabled:opacity-50"
                    >
                      {submitState === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
                       {submitState === "error" ? "Try again" : "Save score"}
                    </button>
                  </div>
                )}

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

        {/* Leaderboard */}
        <aside className="w-full max-w-[420px] lg:mt-24 lg:max-w-sm">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold tracking-wide">LEADERBOARD</h2>
            </div>

            {loadingLeaders ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : leaders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                 No scores yet. Be the first coin collector!
              </p>
            ) : (
              <ol className="space-y-1.5">
                {leaders.map((row, i) => (
                  <li
                    key={row.id}
                    className={
                      i === 0
                        ? "flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5"
                        : "flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2.5"
                    }
                  >
                    <span className="flex w-7 shrink-0 justify-center">
                      {i === 0 ? (
                        <Crown className="h-5 w-5 text-primary" />
                      ) : i < 3 ? (
                        <Medal
                          className={`h-5 w-5 ${i === 1 ? "text-muted-foreground" : "text-chart-4"}`}
                        />
                      ) : (
                        <span className="font-display text-sm font-bold text-muted-foreground">
                          {i + 1}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {row.player_name}
                    </span>
                    <span className="font-display text-base font-bold text-primary">
                      {row.score}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
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
  for (let x = -200 - farOff; x < W + 200; x += 200) {
    for (let b = 0; b < 4; b++) {
      const bw = 34 + ((b * 53) % 26);
      const bh = 60 + ((b * 97 + Math.floor(x)) % 90);
      ctx.fillRect(x + b * 52, H - GROUND_H - bh, bw, bh);
    }
  }
  // near layer with lit windows
  const nearOff = g.phase === "playing" ? (g.time * SPEED * 0.35) % 260 : 0;
  for (let x = -260 - nearOff; x < W + 260; x += 260) {
    for (let b = 0; b < 3; b++) {
      const bx = x + b * 88;
      const bw = 52 + ((b * 31) % 20);
      const bh = 34 + ((b * 71 + Math.floor(x * 0.7)) % 60);
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
    drawObstacle(ctx, p.x, 0, top, true, g.time, p.variant);
    drawObstacle(ctx, p.x, bottom, H - GROUND_H - bottom, false, g.time, p.variant);
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
  time: number,
  variant: number,
) {
  if (h <= 0) return;

  const palettes = [
    { dark: "#123c30", mid: "#1c8057", light: "#83ffc0", glow: "#39ff88" },
    { dark: "#173b57", mid: "#287b8d", light: "#91f5ff", glow: "#44d9ff" },
    { dark: "#4d294c", mid: "#a23c77", light: "#ff91c8", glow: "#ff4fa3" },
    { dark: "#313466", mid: "#6553b5", light: "#c7a6ff", glow: "#9f72ff" },
  ];
  const palette = palettes[variant % palettes.length] ?? {
    dark: "#07512d",
    mid: "#16b867",
    light: "#6effaa",
    glow: "#39ff88",
  };

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 14;

  // Organic luminous trunk, deliberately unlike an industrial pipe.
  const grad = ctx.createLinearGradient(x, 0, x + TREE_W, 0);
  grad.addColorStop(0, palette.dark);
  grad.addColorStop(0.2, palette.mid);
  grad.addColorStop(0.5, palette.light);
  grad.addColorStop(0.8, palette.mid);
  grad.addColorStop(1, palette.dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x + 9, y);
  ctx.bezierCurveTo(x - 1, y + h * 0.25, x + 14, y + h * 0.62, x + 5, y + h);
  ctx.lineTo(x + TREE_W - 5, y + h);
  ctx.bezierCurveTo(x + TREE_W - 15, y + h * 0.62, x + TREE_W + 2, y + h * 0.24, x + TREE_W - 9, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Animated surface pattern: diagonal, circuit, armored, or crystal.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 8, y, TREE_W + 16, h);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  const stripeOff = (time * 40) % 26;
  if (variant % 4 === 0) {
    for (let sy = y - 30 + stripeOff; sy < y + h + 30; sy += 26) {
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x + TREE_W, sy - 14);
      ctx.lineTo(x + TREE_W, sy - 9);
      ctx.lineTo(x, sy + 5);
      ctx.closePath();
      ctx.fill();
    }
  } else if (variant % 4 === 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    for (let sy = y + 18; sy < y + h; sy += 34) {
      ctx.beginPath();
      ctx.moveTo(x + 8, sy);
      ctx.lineTo(x + 28, sy);
      ctx.lineTo(x + 36, sy + 9);
      ctx.lineTo(x + TREE_W - 8, sy + 9);
      ctx.stroke();
    }
  } else if (variant % 4 === 2) {
    for (let sy = y + 8; sy < y + h; sy += 30) {
      roundRect(ctx, x + 7, sy, TREE_W - 14, 18, 9);
      ctx.fill();
    }
  } else {
    for (let sy = y + 10; sy < y + h; sy += 34) {
      ctx.beginPath();
      ctx.moveTo(x + TREE_W / 2, sy - 8);
      ctx.lineTo(x + TREE_W - 8, sy + 7);
      ctx.lineTo(x + TREE_W / 2, sy + 18);
      ctx.lineTo(x + 8, sy + 7);
      ctx.closePath();
      ctx.fill();
    }
  }
  // center highlight
  const shine = ctx.createLinearGradient(x, 0, x + TREE_W, 0);
  shine.addColorStop(0, "rgba(255,255,255,0)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.16)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(x + 7, y, TREE_W - 14, h);
  ctx.restore();

  // glowing crown and branching roots face the flight gap
  const crownH = 32;
  const crownY = isTop ? y + h - crownH : y;
  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 18;
  const capGrad = ctx.createLinearGradient(x, 0, x + TREE_W, 0);
  capGrad.addColorStop(0, palette.dark);
  capGrad.addColorStop(0.5, palette.light);
  capGrad.addColorStop(1, palette.dark);
  ctx.fillStyle = capGrad;
  for (let i = 0; i < 7; i++) {
    const cx = x - 8 + i * ((TREE_W + 16) / 6);
    const cy = isTop ? crownY + crownH - Math.abs(i - 3) * 3 : crownY + Math.abs(i - 3) * 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 13 + (i % 2) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // neon rim on the gap-facing edge
  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 10;
  ctx.fillStyle = palette.light;
  const rimY = isTop ? y + h - 4 : y;
  ctx.fillRect(x - 8, rimY, TREE_W + 16, 4);
  ctx.restore();

  // fine energy veins make each tree feel alive
  ctx.strokeStyle = palette.light;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + TREE_W / 2, isTop ? y : y + h);
  ctx.bezierCurveTo(x + 15, y + h * 0.35, x + TREE_W - 12, y + h * 0.62, x + TREE_W / 2, isTop ? y + h : y);
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// helper type for draw signature
const importState = {
  phase: "ready" as Phase,
  birdY: 0,
  vel: 0,
  rot: 0,
  trees: [] as FutureTree[],
  spawnT: 0,
  score: 0,
  time: 0,
  flash: 0,
  particles: [] as Particle[],
  shake: 0,
  nextVariant: 0,
};
