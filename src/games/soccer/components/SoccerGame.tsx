import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";
import { reportScore } from "@/lib/report-score";
import { useOnlineSoccer } from "@/games/soccer/online/useOnlineSoccer";
import { TURN_TIMEOUT_MS, type MatchMove, type MatchState } from "@/lib/soccer/types";


/* ---------------- types & constants ---------------- */

type Team = "player" | "cpu";
type Difficulty = "easy" | "medium" | "hard";
type Phase = "menu" | "tutorial" | "aim" | "sim" | "goal" | "over";
type PlayerColor = "yellow" | "cyan" | "green" | "violet" | "orange";

const PLAYER_COLORS: Record<
  PlayerColor,
  { label: string; rgb: string; textClass: string; surfaceClass: string; swatchClass: string }
> = {
  yellow: {
    label: "Yellow",
    rgb: "255,225,60",
    textClass: "text-player-yellow",
    surfaceClass: "border-player-yellow bg-player-yellow/15 text-player-yellow",
    swatchClass: "bg-player-yellow",
  },
  cyan: {
    label: "Cyan",
    rgb: "70,225,255",
    textClass: "text-player-cyan",
    surfaceClass: "border-player-cyan bg-player-cyan/15 text-player-cyan",
    swatchClass: "bg-player-cyan",
  },
  green: {
    label: "Green",
    rgb: "100,245,135",
    textClass: "text-player-green",
    surfaceClass: "border-player-green bg-player-green/15 text-player-green",
    swatchClass: "bg-player-green",
  },
  violet: {
    label: "Violet",
    rgb: "190,120,255",
    textClass: "text-player-violet",
    surfaceClass: "border-player-violet bg-player-violet/15 text-player-violet",
    swatchClass: "bg-player-violet",
  },
  orange: {
    label: "Orange",
    rgb: "255,155,55",
    textClass: "text-player-orange",
    surfaceClass: "border-player-orange bg-player-orange/15 text-player-orange",
    swatchClass: "bg-player-orange",
  },
};

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  team: Team | "ball";
}

// Portrait pitch: player defends the bottom goal, CPU the top one.
const W = 760;
const H = 1120;
const WALL = 26;
const GOAL_W = 162.5;
const PIECE_R = 25;
const BALL_R = 15;
const FRICTION = 0.976;
const STOP = 0.06;
const MAX_PULL = 180;
// Shot strength boosted by 15%.
const POWER = 0.1035;
const BALL_MAX_SPEED = 12.65;

// [across the pitch, distance from own goal]
// The first three make the goal screen: a keeper right in front of the
// goal plus two spaced defenders ahead of it, so no straight opening
// shot from the kick-off spot can reach the net.
const FORMATION: Array<[number, number]> = [
  [0.5, 0.055],
  [0.41, 0.17],
  [0.59, 0.17],
  [0.16, 0.31],
  [0.5, 0.29],
  [0.84, 0.31],
  [0.34, 0.45],
  [0.66, 0.45],
];

function makeBodies(): Body[] {
  const bodies: Body[] = [];
  const px = (f: number) => WALL + f * (W - WALL * 2);
  const py = (f: number) => WALL + f * (H - WALL * 2);
  for (const [fx, fy] of FORMATION) {
    bodies.push({ x: px(fx), y: H - py(fy), vx: 0, vy: 0, r: PIECE_R, m: 3, team: "player" });
    bodies.push({ x: px(1 - fx), y: py(fy), vx: 0, vy: 0, r: PIECE_R, m: 3, team: "cpu" });
  }
  bodies.push({ x: W / 2, y: H / 2, vx: 0, vy: 0, r: BALL_R, m: 1, team: "ball" });
  return bodies;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: string;
}

const inGoalBand = (x: number) => Math.abs(x - W / 2) < GOAL_W / 2;

/**
 * Predict the path of a piece until the FIRST thing it hits
 * (another piece, the ball, or a wall). No bounce preview.
 */
function predictPath(
  x: number,
  y: number,
  vx: number,
  vy: number,
  r: number,
  bodies: Body[],
  exclude: number,
) {
  const pts: Array<{ x: number; y: number }> = [{ x, y }];
  for (let i = 0; i < 260; i++) {
    x += vx;
    y += vy;
    vx *= FRICTION;
    vy *= FRICTION;

    // stop at first contact with another body
    for (let j = 0; j < bodies.length; j++) {
      if (j === exclude) continue;
      const o = bodies[j]!;
      const dx = x - o.x;
      const dy = y - o.y;
      const d = Math.hypot(dx, dy);
      const min = r + o.r;
      if (d < min) {
        const nx = d === 0 ? 1 : dx / d;
        const ny = d === 0 ? 0 : dy / d;
        pts.push({ x: o.x + nx * min, y: o.y + ny * min });
        return pts;
      }
    }

    // goal mouth: let the line enter the goal
    if ((y - r < WALL || y + r > H - WALL) && inGoalBand(x)) {
      pts.push({ x, y });
      return pts;
    }

    // stop at walls (no bounce)
    let hitWall = false;
    if (x - r < WALL) {
      x = WALL + r;
      hitWall = true;
    } else if (x + r > W - WALL) {
      x = W - WALL - r;
      hitWall = true;
    }
    if (y - r < WALL) {
      y = WALL + r;
      hitWall = true;
    } else if (y + r > H - WALL) {
      y = H - WALL - r;
      hitWall = true;
    }
    if (hitWall) {
      pts.push({ x, y });
      return pts;
    }

    if (Math.hypot(vx, vy) < STOP) break;
  }
  pts.push({ x, y });
  return pts;
}

/* ---------------- component ---------------- */

export default function SoccerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [target, setTarget] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [playerColor, setPlayerColor] = useState<PlayerColor>("yellow");
  const [score, setScore] = useState({ player: 0, cpu: 0 });
  const [turn, setTurn] = useState<Team>("player");
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const bodies = useRef<Body[]>(makeBodies());
  const sparks = useRef<Spark[]>([]);
  const drag = useRef<{ i: number; x: number; y: number } | null>(null);
  const phaseRef = useRef<Phase>("menu");
  const turnRef = useRef<Team>("player");
  const scoreRef = useRef({ player: 0, cpu: 0 });
  const targetRef = useRef(2);
  const diffRef = useRef<Difficulty>("medium");
  const playerColorRef = useRef<PlayerColor>("yellow");
  const scaleRef = useRef(1);
  const cpuTimer = useRef<number | null>(null);
  const flash = useRef(0);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const setTurnBoth = (t: Team) => {
    turnRef.current = t;
    setTurn(t);
  };

  const burst = (x: number, y: number, hue: string, n = 10) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 4;
      sparks.current.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue });
    }
  };

  const resetPositions = useCallback(() => {
    bodies.current = makeBodies();
    sparks.current = [];
    drag.current = null;
  }, []);

  const startMatch = useCallback(() => {
    resetPositions();
    scoreRef.current = { player: 0, cpu: 0 };
    setScore({ player: 0, cpu: 0 });
    targetRef.current = target;
    diffRef.current = difficulty;
    playerColorRef.current = playerColor;
    setTurnBoth("player");
    setConfirmExit(false);
    setBanner("YOUR TURN");
    playSfx("start", 0.8);
    setTimeout(() => setBanner(null), 1200);
    setPhaseBoth("aim");
  }, [difficulty, playerColor, resetPositions, target]);

  const choosePlayerColor = (color: PlayerColor) => {
    playerColorRef.current = color;
    setPlayerColor(color);
  };

  /* ---------- cpu ---------- */

  const cpuShoot = useCallback(() => {
    const list = bodies.current;
    const ball = list[list.length - 1]!;
    const diff = diffRef.current;
    const goal = { x: W / 2, y: H - WALL }; // CPU attacks the bottom goal
    // CPU is 40% more precise: aim wobble cut by 40% and power far more consistent.
    const PRECISION = 0.6; // 40% less aiming error
    const noise = (diff === "easy" ? 0.225 : diff === "medium" ? 0.09 : 0.025) * PRECISION;
    const powerScale = diff === "easy" ? 0.8 : diff === "medium" ? 0.95 : 1;
    const powerJitter = 0.12 * PRECISION; // steadier shot strength too

    // Distance from a point to a segment, used to detect blockers on a path.
    const distToSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy || 1;
      let t = ((px - ax) * dx + (py - ay) * dy) / len;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    };

    const gdx = goal.x - ball.x;
    const gdy = goal.y - ball.y;
    const gl = Math.hypot(gdx, gdy) || 1;
    const goalAng = Math.atan2(gdy, gdx);

    let best: { body: Body; ang: number; score: number } | null = null;

    for (const b of list) {
      if (b.team !== "cpu") continue;
      // Search candidate ball directions around the straight line to goal.
      // 40% finer angular search: more candidate directions, tighter steps.
      for (let k = -14; k <= 14; k++) {
        const shotAng = goalAng + (k * 0.054);
        const dirX = Math.cos(shotAng);
        const dirY = Math.sin(shotAng);
        // Contact point the piece must reach to push the ball along shotAng.
        const cx = ball.x - dirX * (PIECE_R + BALL_R);
        const cy = ball.y - dirY * (PIECE_R + BALL_R);
        const approach = Math.atan2(cy - b.y, cx - b.x);
        const travel = Math.hypot(cx - b.x, cy - b.y);
        if (travel < 1) continue;

        // Prefer shots pointed at the goal mouth.
        let score = 100 * (dirX * (gdx / gl) + dirY * (gdy / gl));
        // Penalise a long run-up and a bad contact angle.
        score -= travel * 0.06;
        score -= Math.abs(((approach - shotAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 22;

        // Penalise anything standing in the run-up or on the ball's path.
        for (const o of list) {
          if (o === b || o === ball) continue;
          if (distToSeg(o.x, o.y, b.x, b.y, cx, cy) < PIECE_R * 2) score -= 40;
          const lane = distToSeg(o.x, o.y, ball.x, ball.y, ball.x + dirX * gl, ball.y + dirY * gl);
          if (lane < PIECE_R + BALL_R) score -= o.team === "player" ? 55 : 30;
        }
        // Never nudge the ball back toward its own goal.
        if (dirY < 0) score -= 120;

        if (!best || score > best.score) best = { body: b, ang: approach, score };
      }
    }
    if (!best) return;

    const ang = best.ang + (Math.random() - 0.5) * noise;
    const power =
      MAX_PULL * powerScale * (1 - powerJitter + Math.random() * powerJitter) * POWER;
    best.body.vx = Math.cos(ang) * power;
    best.body.vy = Math.sin(ang) * power;
    burst(best.body.x, best.body.y, "255,70,90", 12);
    playSfx("kick", 0.75);
    setPhaseBoth("sim");
  }, []);

  /* ---------- main loop ---------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const resize = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const avail = Math.max(240, wrap.clientHeight || 240);
      const scale = Math.min(wrap.clientWidth / W, avail / H);
      scaleRef.current = scale;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(W * scale * dpr);
      canvas.height = Math.round(H * scale * dpr);
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);

    const scoreGoal = (who: Team) => {
      const s = { ...scoreRef.current };
      s[who] += 1;
      scoreRef.current = s;
      setScore(s);
      flash.current = 1;
      playSfx("goal", 0.9);
       burst(
         W / 2,
         who === "player" ? WALL : H - WALL,
         who === "player" ? PLAYER_COLORS[playerColorRef.current].rgb : "255,70,90",
         40,
       );
      if (s[who] >= targetRef.current) {
        setBanner(who === "player" ? "YOU WIN!" : "CPU WINS");
        playSfx(who === "player" ? "win" : "lose", 0.9);
        setPhaseBoth("over");
        if (who === "player") {
          const wins = Number(localStorage.getItem("nimiq-soccer-wins") ?? 0) + 1;
          localStorage.setItem("nimiq-soccer-wins", String(wins));
          reportScore("soccer", wins);
        }
        return;
      }
      setBanner("GOAL!");
      setPhaseBoth("goal");
      window.setTimeout(() => {
        resetPositions();
        setTurnBoth(who === "player" ? "cpu" : "player");
        setBanner(who === "player" ? "CPU TURN" : "YOUR TURN");
        window.setTimeout(() => setBanner(null), 900);
        setPhaseBoth("aim");
        if (who === "player") {
          cpuTimer.current = window.setTimeout(() => {
            if (phaseRef.current === "aim" && turnRef.current === "cpu") cpuShoot();
          }, 900);
        }
      }, 1100);
    };

    const step = () => {
      const list = bodies.current;
      const ball = list[list.length - 1]!;

      if (phaseRef.current === "sim" || phaseRef.current === "goal") {
        for (const b of list) {
          b.x += b.vx;
          b.y += b.vy;
          b.vx *= FRICTION;
          b.vy *= FRICTION;
          if (Math.hypot(b.vx, b.vy) < STOP) {
            b.vx = 0;
            b.vy = 0;
          }
          const band = inGoalBand(b.x) && b.team === "ball";
          if (b.x - b.r < WALL) {
            b.x = WALL + b.r;
            b.vx = Math.abs(b.vx) * 0.85;
            if (Math.abs(b.vx) > 1) burst(b.x, b.y, "120,240,255", 4);
          }
          if (b.x + b.r > W - WALL) {
            b.x = W - WALL - b.r;
            b.vx = -Math.abs(b.vx) * 0.85;
            if (Math.abs(b.vx) > 1) burst(b.x, b.y, "120,240,255", 4);
          }
          if (b.y - b.r < WALL && !band) {
            b.y = WALL + b.r;
            b.vy = Math.abs(b.vy) * 0.85;
            if (Math.abs(b.vy) > 1) burst(b.x, b.y, "120,240,255", 4);
          }
          if (b.y + b.r > H - WALL && !band) {
            b.y = H - WALL - b.r;
            b.vy = -Math.abs(b.vy) * 0.85;
            if (Math.abs(b.vy) > 1) burst(b.x, b.y, "120,240,255", 4);
          }
        }

        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i]!;
            const b = list[j]!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const min = a.r + b.r;
            if (dist === 0 || dist >= min) continue;
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = min - dist;
            const totalM = a.m + b.m;
            a.x -= nx * overlap * (b.m / totalM);
            a.y -= ny * overlap * (b.m / totalM);
            b.x += nx * overlap * (a.m / totalM);
            b.y += ny * overlap * (a.m / totalM);
            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const sep = rvx * nx + rvy * ny;
            if (sep > 0) continue;
            const imp = (-(1 + 0.92) * sep) / (1 / a.m + 1 / b.m);
            a.vx -= (imp * nx) / a.m;
            a.vy -= (imp * ny) / a.m;
            b.vx += (imp * nx) / b.m;
            b.vy += (imp * ny) / b.m;
            for (const body of [a, b]) {
              if (body.team !== "ball") continue;
              const speed = Math.hypot(body.vx, body.vy);
              if (speed > BALL_MAX_SPEED) {
                body.vx = (body.vx / speed) * BALL_MAX_SPEED;
                body.vy = (body.vy / speed) * BALL_MAX_SPEED;
              }
            }
            if (Math.abs(imp) > 1.5) {
              burst((a.x + b.x) / 2, (a.y + b.y) / 2, "255,255,255", 5);
              /* ball contact sounds like a ball; piece-on-piece is a body bump */
              const ballInvolved = a.team === "ball" || b.team === "ball";
              playSfx(ballInvolved ? "ballhit" : "thud", Math.max(0.3, Math.min(1, Math.abs(imp) / 18)));
            }
          }
        }

        if (phaseRef.current === "sim") {
          // Goal counts once the ball's centre crosses the goal line.
          // (Pieces can't enter the goal mouth, so requiring the whole
          // ball past the line could strand the ball on the line forever.)
          if (inGoalBand(ball.x)) {
            if (ball.y < WALL) scoreGoal("player");
            else if (ball.y > H - WALL) scoreGoal("cpu");
          }
        }

        if (phaseRef.current === "sim" && list.every((b) => b.vx === 0 && b.vy === 0)) {
          // Stuck-ball guard: a ball resting on the goal line (touching it,
          // in the goal band) still counts — pieces can never reach it there.
          if (inGoalBand(ball.x)) {
            if (ball.y - ball.r <= WALL) {
              scoreGoal("player");
              return;
            }
            if (ball.y + ball.r >= H - WALL) {
              scoreGoal("cpu");
              return;
            }
          }
          const next: Team = turnRef.current === "player" ? "cpu" : "player";
          setTurnBoth(next);
          setPhaseBoth("aim");
          if (next === "cpu") {
            cpuTimer.current = window.setTimeout(() => {
              if (phaseRef.current === "aim" && turnRef.current === "cpu") cpuShoot();
            }, 700);
          }
        }
      }

      sparks.current = sparks.current.filter((s) => s.life > 0);
      for (const s of sparks.current) {
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.94;
        s.vy *= 0.94;
        s.life -= 0.03;
      }
      flash.current = Math.max(0, flash.current - 0.02);

      draw(
        ctx,
        list,
        drag.current,
        flash.current,
        sparks.current,
        turnRef.current,
        phaseRef.current,
        PLAYER_COLORS[playerColorRef.current].rgb,
      );
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      if (cpuTimer.current) window.clearTimeout(cpuTimer.current);
    };
  }, [cpuShoot, resetPositions]);

  /* ---------- pointer ---------- */

  const toLocal = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const s = scaleRef.current;
    return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s };
  };

  const onDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim" || turnRef.current !== "player") return;
    const p = toLocal(e);
    const list = bodies.current;
    for (let i = 0; i < list.length; i++) {
      const b = list[i]!;
      if (b.team !== "player") continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) <= b.r + 18) {
        drag.current = { i, x: p.x, y: p.y };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toLocal(e);
    drag.current = { ...drag.current, x: p.x, y: p.y };
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || phaseRef.current !== "aim" || turnRef.current !== "player") return;
    const b = bodies.current[d.i];
    if (!b) return;
    let dx = b.x - d.x;
    let dy = b.y - d.y;
    const len = Math.hypot(dx, dy);
    if (len < 12) return;
    const clamped = Math.min(len, MAX_PULL);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    b.vx = dx * POWER;
    b.vy = dy * POWER;
    burst(b.x, b.y, PLAYER_COLORS[playerColorRef.current].rgb, 12);
    playSfx("kick", 0.9);
    setPhaseBoth("sim");
  };

  /* ---------- ui ---------- */

  const inMatch = phase === "aim" || phase === "sim" || phase === "goal" || phase === "over";
  const activeColor = PLAYER_COLORS[playerColor];

  const exitToMenu = () => {
    if (cpuTimer.current) window.clearTimeout(cpuTimer.current);
    drag.current = null;
    resetPositions();
    setConfirmExit(false);
    setBanner(null);
    setScore({ player: 0, cpu: 0 });
    scoreRef.current = { player: 0, cpu: 0 };
    setPhaseBoth("menu");
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden px-2 pb-1 pt-[max(0.375rem,env(safe-area-inset-top))] sm:px-4">
      <header className="relative flex items-center justify-center px-8">
        <h1 className="font-display text-[11px] tracking-[0.3em] text-neon-yellow drop-shadow-[0_0_14px_rgba(255,225,60,0.45)]">
          NIMIQ SOCCER
        </h1>
        {inMatch && (
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            className="absolute right-0 top-0 rounded-lg border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-foreground/80 transition hover:border-neon-red hover:text-neon-red"
          >
            EXIT
          </button>
        )}
      </header>

      {inMatch && (
        <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1 backdrop-blur">
          <div className="text-center">
            <div className={`text-[9px] tracking-widest ${activeColor.textClass}`}>YOU</div>
            <div className={`font-display text-lg leading-tight ${activeColor.textClass}`}>{score.player}</div>
          </div>
          <div className="min-w-0 text-center">
            <div className="truncate text-[9px] tracking-widest text-muted-foreground">
              FIRST TO {target} · {difficulty.toUpperCase()}
            </div>
            <div
              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
                turn === "player" ? activeColor.surfaceClass : "bg-neon-red/20 text-neon-red"
              }`}
            >
              {turn === "player" ? "YOUR TURN" : "CPU TURN"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] tracking-widest text-neon-red">CPU</div>
            <div className="font-display text-lg leading-tight text-neon-red">{score.cpu}</div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="relative mx-auto mt-1 flex min-h-0 w-full flex-1 items-center justify-center">
        <div className="relative mx-auto w-fit overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(60,220,255,0.12)]">
          <canvas
            ref={canvasRef}
            className="block touch-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />

          {banner && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="font-display animate-pulse text-2xl tracking-[0.25em] text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.7)] sm:text-4xl">
                {banner}
              </span>
            </div>
          )}

          {phase === "menu" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-background/85 px-5 py-6 backdrop-blur-sm">
              <div className="w-full max-w-xs text-center">
                <div className="mb-2 text-xs tracking-widest text-muted-foreground">FIRST TO</div>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3].map((g) => (
                    <button
                      key={g}
                      onClick={() => setTarget(g)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        target === g
                          ? "border-neon-yellow bg-neon-yellow/15 text-neon-yellow shadow-[0_0_20px_rgba(255,225,60,0.35)]"
                          : "border-white/15 text-foreground/70 hover:border-white/40"
                      }`}
                    >
                      {g} {g === 1 ? "GOAL" : "GOALS"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-xs text-center">
                <div className="mb-2 text-xs tracking-widest text-muted-foreground">YOUR TEAM COLOR</div>
                <div className="flex justify-center gap-3" role="radiogroup" aria-label="Choose your team color">
                  {(Object.keys(PLAYER_COLORS) as PlayerColor[]).map((color) => {
                    const option = PLAYER_COLORS[color];
                    const selected = playerColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={option.label}
                        title={option.label}
                        onClick={() => choosePlayerColor(color)}
                        className={`grid size-10 place-items-center rounded-full border transition ${
                          selected
                            ? `${option.surfaceClass} scale-110 shadow-neon`
                            : "border-foreground/25 bg-card/60"
                        }`}
                      >
                        <span className={`size-5 rotate-30 rounded-[4px] ${option.swatchClass}`} />
                      </button>
                    );
                  })}
                </div>
                <div className={`mt-2 text-xs font-semibold ${activeColor.textClass}`}>
                  {activeColor.label}
                </div>
              </div>

              <div className="w-full max-w-xs text-center">
                <div className="mb-2 text-xs tracking-widest text-muted-foreground">DIFFICULTY</div>
                <div className="flex justify-center gap-2">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 rounded-xl border px-2 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                        difficulty === d
                          ? "border-neon-red bg-neon-red/15 text-neon-red shadow-[0_0_20px_rgba(255,70,90,0.35)]"
                          : "border-white/15 text-foreground/70 hover:border-white/40"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex w-full max-w-xs flex-col items-center gap-2">
                <button
                  onClick={() => setPhaseBoth("tutorial")}
                  className="font-display w-full rounded-2xl bg-neon-yellow px-10 py-3 text-lg tracking-[0.2em] text-black shadow-[0_0_35px_rgba(255,225,60,0.5)] transition hover:scale-[1.03]"
                >
                  PLAY
                </button>
                <button
                  onClick={startMatch}
                  className="w-full rounded-xl border border-white/20 px-6 py-2 text-sm font-semibold tracking-wider text-foreground/80 transition hover:border-white/50"
                >
                  SKIP TUTORIAL
                </button>
              </div>
            </div>
          )}

          {phase === "tutorial" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-background/90 px-5 py-6 backdrop-blur-sm">
              <div className="font-display text-lg tracking-[0.2em] text-neon-yellow sm:text-2xl">
                HOW TO PLAY
              </div>
              <ol className="w-full max-w-xs space-y-3 text-sm text-foreground/85">
                <li className="flex gap-3">
                  <span className={`font-display ${activeColor.textClass}`}>1</span>
                  <span>Your hexagon pieces defend the bottom goal. Score in the top goal.</span>
                </li>
                <li className="flex gap-3">
                  <span className={`font-display ${activeColor.textClass}`}>2</span>
                  <span>Press one of your pieces, drag backwards to aim, then release to shoot.</span>
                </li>
                <li className="flex gap-3">
                  <span className={`font-display ${activeColor.textClass}`}>3</span>
                  <span>The dashed line shows your path until the first piece or wall it hits.</span>
                </li>
                <li className="flex gap-3">
                  <span className={`font-display ${activeColor.textClass}`}>4</span>
                  <span>Turns alternate with the CPU. First team to reach the goal target wins.</span>
                </li>
              </ol>
              <div className="flex w-full max-w-xs flex-col items-center gap-2">
                <button
                  onClick={startMatch}
                  className="font-display w-full rounded-2xl bg-neon-yellow px-10 py-3 text-lg tracking-[0.2em] text-black shadow-[0_0_35px_rgba(255,225,60,0.5)] transition hover:scale-[1.03]"
                >
                  START MATCH
                </button>
                <button
                  onClick={() => setPhaseBoth("menu")}
                  className="w-full rounded-xl border border-white/20 px-6 py-2 text-sm font-semibold tracking-wider text-foreground/80 transition hover:border-white/50"
                >
                  BACK TO MENU
                </button>
              </div>
            </div>
          )}

          {phase === "over" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/85 px-4 backdrop-blur-sm">
              <div
                className={`font-display text-center text-2xl tracking-[0.2em] sm:text-4xl ${
                  score.player > score.cpu ? activeColor.textClass : "text-neon-red"
                }`}
              >
                {score.player > score.cpu ? "YOU WIN!" : "CPU WINS"}
              </div>
              <div className="text-lg text-muted-foreground">
                {score.player} — {score.cpu}
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={startMatch}
                  className="rounded-xl bg-neon-yellow px-6 py-2 font-semibold text-black shadow-[0_0_25px_rgba(255,225,60,0.4)]"
                >
                  Play Again
                </button>
                <button
                  onClick={exitToMenu}
                  className="rounded-xl border border-white/20 px-6 py-2 font-semibold text-foreground/80"
                >
                  Main Menu
                </button>
              </div>
            </div>
          )}

          {confirmExit && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-background/80 px-6 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Exit match"
            >
              <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-card/95 p-5 text-center shadow-[0_0_40px_rgba(0,0,0,0.6)]">
                <div className="font-display text-base tracking-widest text-foreground">
                  EXIT MATCH?
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your current score will be lost.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={exitToMenu}
                    className="flex-1 rounded-xl bg-neon-red px-4 py-2 text-sm font-semibold text-black"
                  >
                    YES
                  </button>
                  <button
                    onClick={() => setConfirmExit(false)}
                    className="flex-1 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-foreground/80"
                  >
                    NO
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- rendering ---------------- */

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function draw(
  ctx: CanvasRenderingContext2D,
  list: Body[],
  drag: { i: number; x: number; y: number } | null,
  flash: number,
  sparks: Spark[],
  turn: Team,
  phase: Phase,
  playerRgb: string,
) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#050a16");
  grad.addColorStop(0.5, "#081226");
  grad.addColorStop(1, "#05080f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = "rgba(90,220,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(90,220,255,0.9)";
  ctx.shadowBlur = 18;
  ctx.strokeStyle = "rgba(140,235,255,0.75)";
  ctx.lineWidth = 3;
  ctx.strokeRect(WALL, WALL, W - WALL * 2, H - WALL * 2);
  ctx.beginPath();
  ctx.moveTo(WALL, H / 2);
  ctx.lineTo(W - WALL, H / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 100, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(W / 2 - 175, WALL, 350, 130);
  ctx.strokeRect(W / 2 - 175, H - WALL - 130, 350, 130);
  ctx.restore();

  const drawGoal = (top: boolean, color: string) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    const y = top ? WALL : H - WALL;
    ctx.beginPath();
    ctx.moveTo(W / 2 - GOAL_W / 2, y);
    ctx.lineTo(W / 2 + GOAL_W / 2, y);
    ctx.stroke();
    const g = ctx.createLinearGradient(0, y, 0, top ? y + 70 : y - 70);
    g.addColorStop(0, color.replace("1)", "0.35)"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - GOAL_W / 2, top ? y : y - 70, GOAL_W, 70);
    ctx.restore();
  };
  drawGoal(true, `rgba(${playerRgb},1)`); // player scores here
  drawGoal(false, "rgba(255,70,90,1)");

  // aim guide: stops at the first object hit (no bounce preview)
  if (drag) {
    const b = list[drag.i]!;
    let dx = b.x - drag.x;
    let dy = b.y - drag.y;
    const len = Math.min(Math.hypot(dx, dy), MAX_PULL);
    const a = Math.atan2(dy, dx);
    dx = Math.cos(a) * len;
    dy = Math.sin(a) * len;
    const pct = len / MAX_PULL;
    const pts = predictPath(b.x, b.y, dx * POWER, dy * POWER, b.r, list, drag.i);

    ctx.save();
    ctx.lineCap = "round";
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1]!;
      const p1 = pts[i]!;
      const fade = i === 1 ? 0.95 : 0.45;
      ctx.setLineDash([12, 12]);
      ctx.lineWidth = i === 1 ? 5 : 3.5;
      ctx.strokeStyle = `rgba(${playerRgb},${fade})`;
      ctx.shadowColor = `rgba(${playerRgb},0.8)`;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    const end = pts[pts.length - 1]!;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(end.x, end.y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${playerRgb},0.85)`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 10 + pct * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const b of list) {
    if (b.team === "ball") {
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#f7f7f7";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b1b1b";
      hexPath(ctx, b.x, b.y, b.r * 0.45);
      ctx.fill();
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * b.r * 0.45, b.y + Math.sin(a) * b.r * 0.45);
        ctx.lineTo(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r);
        ctx.stroke();
      }
      ctx.restore();
      continue;
    }
    const isPlayer = b.team === "player";
    const c = isPlayer ? playerRgb : "255,70,90";
    ctx.save();
    ctx.shadowColor = `rgba(${c},0.95)`;
    ctx.shadowBlur = isPlayer && turn === "player" && phase === "aim" ? 30 : 18;
    const fill = ctx.createRadialGradient(b.x - 6, b.y - 8, 3, b.x, b.y, b.r);
    fill.addColorStop(0, `rgba(${c},0.95)`);
    fill.addColorStop(1, `rgba(${c},0.18)`);
    ctx.fillStyle = fill;
    hexPath(ctx, b.x, b.y, b.r);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(${c},1)`;
    ctx.stroke();
    ctx.shadowBlur = 0;
    hexPath(ctx, b.x, b.y, b.r * 0.45);
    ctx.strokeStyle = `rgba(${c},0.8)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  for (const s of sparks) {
    ctx.fillStyle = `rgba(${s.hue},${Math.max(s.life, 0)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3 * s.life + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }
}
