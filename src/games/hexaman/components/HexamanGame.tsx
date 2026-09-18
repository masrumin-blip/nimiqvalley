import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";
import {
  buildGrid,
  COLS,
  ROWS,
  TUNNEL_ROW,
  PLAYER_SPAWN,
  HOUSE_CELLS,
  HOUSE_EXIT,
  type Cell,
} from "./maze";
import { PALETTE } from "./palette";
import { Button } from "@/components/ui/button";
import { reportScore } from "@/lib/report-score";

const CELL = 26;
const W = COLS * CELL;
const H = ROWS * CELL;

type Dir = { x: number; y: number };
const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} satisfies Record<string, Dir>;

type Entity = {
  c: number;
  r: number;
  dir: Dir;
  next: Dir | null;
  speed: number;
};

type Ghost = Entity & {
  color: string;
  scatter: { c: number; r: number };
  mode: "house" | "out";
  releaseAt: number;
  index: number;
  /** Extra speed earned each time this ghost slot is eaten and respawned. */
  bonus: number;
};

const BASE_GHOST_SPEED = 5.4;
const MAX_GHOST_SPEED = 11;
const RESPAWN_SPEED_STEP = 0.6;
const NORMAL_PHASE_SECONDS = 4;
const YELLOW_PHASE_SECONDS = 3;
const POWER_FRIGHT_SECONDS = 3;
const BLINK_SECONDS = 1.5;
const BLINK_INTERVAL = 0.5;

function isVirusBlue(time: number) {
  const cycle = NORMAL_PHASE_SECONDS + YELLOW_PHASE_SECONDS;
  return time % cycle >= NORMAL_PHASE_SECONDS;
}

/** True while the yellow phase is about to end and the blink is "off"
 *  (show normal color). Toggles every BLINK_INTERVAL seconds. */
function isVirusBlinkOff(time: number) {
  const cycle = NORMAL_PHASE_SECONDS + YELLOW_PHASE_SECONDS;
  const t = time % cycle;
  if (t < NORMAL_PHASE_SECONDS) return false;
  const remaining = cycle - t;
  return remaining <= BLINK_SECONDS && Math.floor(time / BLINK_INTERVAL) % 2 === 0;
}

type Status = "ready" | "playing" | "dying" | "over";

export type HudState = {
  score: number;
  best: number;
  lives: number;
  level: number;
  status: Status;
  combo: number;
};

function wrap(c: number) {
  if (c < -0.5) return COLS - 0.5;
  if (c > COLS - 0.5) return -0.5;
  return c;
}

export function HexamanGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudState>({
    score: 0,
    best: 0,
    lives: 3,
    level: 1,
    status: "ready",
    combo: 0,
  });

  const game = useRef({
    grid: buildGrid() as Cell[][],
    pellets: 0,
    player: {
      c: PLAYER_SPAWN.c,
      r: PLAYER_SPAWN.r,
      dir: DIRS.left,
      next: null,
      speed: 6.4,
    } as Entity,
    ghosts: [] as Ghost[],
    score: 0,
    lives: 3,
    level: 1,
    status: "ready" as Status,
    frightened: 0,
    eatenChain: 0,
    mouth: 0,
    t: 0,
    deathT: 0,
    floaters: [] as { c: number; r: number; text: string; life: number }[],
  });

  const lastMoveSfx = useRef(0);

  const publish = useCallback(() => {
    const g = game.current;
    setHud((prev) => {
      const best = Math.max(prev.best, g.score);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("hexaman-best", String(best));
        } catch {
          /* ignore */
        }
      }
      return {
        score: g.score,
        best,
        lives: g.lives,
        level: g.level,
        status: g.status,
        combo: g.eatenChain,
      };
    });
  }, []);

  // Dev-only handle for automated testing of the game state.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __hexaman?: typeof game }).__hexaman = game;
    }
  }, []);

  const isWall = useCallback((c: number, r: number, allowDoor = false) => {
    if (r < 0 || r >= ROWS) return true;
    let cc = c;
    if (cc < 0) cc = COLS - 1;
    if (cc >= COLS) cc = 0;
    const v = game.current.grid[r]?.[cc];
    if (v === "#") return true;
    if (v === "=") return !allowDoor;
    return false;
  }, []);

  const countPellets = useCallback(() => {
    let n = 0;
    for (const row of game.current.grid)
      for (const v of row) if (v === "." || v === "*") n++;
    return n;
  }, []);

  const spawnGhosts = useCallback(() => {
    const g = game.current;
    const scatters = [
      { c: 1, r: 1 },
      { c: COLS - 2, r: 1 },
      { c: 1, r: ROWS - 2 },
      { c: COLS - 2, r: ROWS - 2 },
    ];
    g.ghosts = HOUSE_CELLS.map((cell, i) => ({
      c: cell.c,
      r: cell.r,
      dir: DIRS.up,
      next: null,
      speed: 5.4 + Math.min(g.level - 1, 6) * 0.22,
      color: PALETTE.ghosts[i % PALETTE.ghosts.length] ?? PALETTE.frightened,
      scatter: scatters[i] ?? { c: 1, r: 1 },
      mode: "house",
      releaseAt: 0.8 + i * 2.6,
      index: i,
      bonus: 0,
    }));
  }, []);

  const resetPositions = useCallback(() => {
    const g = game.current;
    g.player = {
      c: PLAYER_SPAWN.c,
      r: PLAYER_SPAWN.r,
      dir: DIRS.left,
      next: null,
      speed: 6.4 + Math.min(g.level - 1, 5) * 0.14,
    };
    g.frightened = 0;
    g.eatenChain = 0;
    g.t = 0;
    spawnGhosts();
  }, [spawnGhosts]);

  const nextLevel = useCallback(() => {
    const g = game.current;
    playSfx("win", 0.8);
    g.level += 1;
    g.grid = buildGrid();
    g.pellets = countPellets();
    resetPositions();
    g.status = "ready";
    publish();
  }, [countPellets, publish, resetPositions]);

  const startGame = useCallback(() => {
    const g = game.current;
    g.grid = buildGrid();
    g.pellets = countPellets();
    g.score = 0;
    g.lives = 3;
    g.level = 1;
    g.floaters = [];
    resetPositions();
    g.status = "playing";
    publish();
  }, [countPellets, publish, resetPositions]);

  const setDir = useCallback((d: Dir) => {
    const g = game.current;
    g.player.next = d;
    if (g.status === "ready") {
      g.status = "playing";
      setHud((p) => ({ ...p, status: "playing" }));
    }
  }, []);

  // input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const map: Record<string, Dir> = {
        arrowup: DIRS.up,
        w: DIRS.up,
        arrowdown: DIRS.down,
        s: DIRS.down,
        arrowleft: DIRS.left,
        a: DIRS.left,
        arrowright: DIRS.right,
        d: DIRS.right,
      };
      if (map[k]) {
        e.preventDefault();
        const direction = map[k];
        if (direction) setDir(direction);
      }
      if (k === "enter" && game.current.status === "over") startGame();
    };
    window.addEventListener("keydown", onKey, { passive: false });
    try {
      const b = window.localStorage.getItem("hexaman-best");
      if (b) setHud((p) => ({ ...p, best: Number(b) || 0 }));
    } catch {
      /* ignore */
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [setDir, startGame]);

  // swipe
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      sx = t.clientX;
      sy = t.clientY;
    };
    const end = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? DIRS.right : DIRS.left);
      else setDir(dy > 0 ? DIRS.down : DIRS.up);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
    };
  }, [setDir]);

  // game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const g0 = game.current;
    if (g0.pellets === 0) g0.pellets = countPellets();
    if (g0.ghosts.length === 0) spawnGhosts();

    let raf = 0;
    let last = performance.now();

    const moveEntity = (e: Entity, dt: number, allowDoor: boolean) => {
      const step = e.speed * dt;
      const cc = Math.round(e.c);
      const rr = Math.round(e.r);
      const dx = cc - e.c;
      const dy = rr - e.r;
      const distToCenter = Math.hypot(dx, dy);
      const movingTowardCenter = dx * e.dir.x + dy * e.dir.y > 0;
      if (distToCenter < 1e-9 || (movingTowardCenter && distToCenter <= step)) {
        // Arrive exactly at the cell center: decide direction here.
        e.c = cc;
        e.r = rr;
        if (e.next && !isWall(cc + e.next.x, rr + e.next.y, allowDoor)) {
          e.dir = e.next;
          e.next = null;
        }
        if (isWall(cc + e.dir.x, rr + e.dir.y, allowDoor)) return;
        const rem = step - distToCenter;
        e.c = wrap(e.c + e.dir.x * rem);
        e.r += e.dir.y * rem;
      } else {
        e.c = wrap(e.c + e.dir.x * step);
        e.r += e.dir.y * step;
      }
    };

    const ghostTarget = (gh: Ghost) => {
      const g = game.current;
      if (g.frightened > 0 || isVirusBlue(g.t)) return gh.scatter;
      const player = g.player;
      const scatterPhase = g.t % 27 < 7;
      if (scatterPhase) return gh.scatter;
      if (gh.index === 0) return { c: player.c, r: player.r };
      if (gh.index === 1)
        return { c: player.c + player.dir.x * 4, r: player.r + player.dir.y * 4 };
      if (gh.index === 2)
        return { c: player.c - player.dir.x * 3, r: player.r - player.dir.y * 3 };
      const d = Math.hypot(player.c - gh.c, player.r - gh.r);
      return d > 6 ? { c: player.c, r: player.r } : gh.scatter;
    };

    const decideGhost = (gh: Ghost) => {
      const cc = Math.round(gh.c);
      const rr = Math.round(gh.r);
      const target = ghostTarget(gh);
      const opts = Object.values(DIRS).filter((d) => {
        if (d.x === -gh.dir.x && d.y === -gh.dir.y) return false;
        return !isWall(cc + d.x, rr + d.y, gh.mode !== "out");
      });
      if (!opts.length) {
        gh.dir = { x: -gh.dir.x, y: -gh.dir.y };
        return;
      }
      const current = game.current;
      const fright =
        (current.frightened > 0 || isVirusBlue(current.t)) && gh.mode === "out";
      if (fright && Math.random() < 0.75) {
        const randomDirection = opts[Math.floor(Math.random() * opts.length)];
        if (randomDirection) gh.dir = randomDirection;
        return;
      }
      const firstOption = opts[0];
      if (!firstOption) return;
      let best = firstOption;
      let bestD = Infinity;
      for (const d of opts) {
        const dist = Math.hypot(cc + d.x - target.c, rr + d.y - target.r);
        if (dist < bestD) {
          bestD = dist;
          best = d;
        }
      }
      gh.dir = best;
    };

    const update = (dt: number) => {
      const g = game.current;
      g.mouth += dt * 9;
      g.floaters = g.floaters.filter((f) => (f.life -= dt) > 0);
      if (g.status !== "playing") {
        if (g.status === "dying") {
          g.deathT += dt;
          if (g.deathT > 1.3) {
            g.deathT = 0;
            if (g.lives <= 0) {
              g.status = "over";
              playSfx("gameover", 0.8);
              reportScore("hexaman", g.score);
            } else {
              resetPositions();
              g.status = "ready";
            }
            publish();
          }
        }
        return;
      }
      g.t += dt;
      if (g.frightened > 0) {
        g.frightened -= dt;
        if (g.frightened <= 0) g.eatenChain = 0;
      }

      moveEntity(g.player, dt, false);
      {
        const now = performance.now();
        if ((g.player.dir.x !== 0 || g.player.dir.y !== 0) && now - lastMoveSfx.current > 150) {
          lastMoveSfx.current = now;
          playSfx("move", 0.25);
        }
      }

      // eat
      const pc = Math.round(g.player.c);
      const pr = Math.round(g.player.r);
      const cellRow = g.grid[pr];
      if (
        cellRow &&
        Math.abs(g.player.c - pc) < 0.4 &&
        Math.abs(g.player.r - pr) < 0.4
      ) {
        const v = cellRow[pc];
        if (v === "." || v === "*") {
          cellRow[pc] = "-";
          g.pellets -= 1;
          g.score += v === "." ? 10 : 50;
          playSfx(v === "*" ? "powerup" : "score", v === "*" ? 0.7 : 0.35);
          if (v === "*") {
            g.frightened = POWER_FRIGHT_SECONDS;
            g.eatenChain = 0;
            for (const gh of g.ghosts)
              if (gh.mode === "out") gh.dir = { x: -gh.dir.x, y: -gh.dir.y };
          }
          publish();
          if (g.pellets <= 0) {
            nextLevel();
            return;
          }
        }
      }

      for (let i = g.ghosts.length - 1; i >= 0; i--) {
        const gh = g.ghosts[i];
        if (!gh) continue;
        if (gh.mode === "house") {
          gh.releaseAt -= dt;
          gh.r += Math.sin(g.t * 4 + gh.index) * dt * 0.25;
          if (gh.releaseAt <= 0) {
            gh.mode = "out";
            gh.c = HOUSE_EXIT.c;
            gh.r = 8;
            gh.dir = DIRS.up;
          }
          continue;
        }
        const fright =
          (g.frightened > 0 || isVirusBlue(g.t)) && gh.mode === "out";
        const levelBase = BASE_GHOST_SPEED + Math.min(g.level - 1, 6) * 0.22;
        const base = Math.min(levelBase + gh.bonus, MAX_GHOST_SPEED);
        gh.speed = fright ? base * 0.62 : base;
        if (
          Math.abs(gh.c - Math.round(gh.c)) < 1e-6 &&
          Math.abs(gh.r - Math.round(gh.r)) < 1e-6
        ) {
          decideGhost(gh);
        }
        moveEntity(gh, dt, gh.mode !== "out");

        if (Math.hypot(gh.c - g.player.c, gh.r - g.player.r) < 0.72) {
          if (fright) {
            // The eaten ghost disappears for good; a faster replacement
            // spawns in the ghost house.
            g.eatenChain = Math.min(g.eatenChain + 1, 4);
            const pts = 200 * Math.pow(2, g.eatenChain - 1);
            g.score += pts;
            g.floaters.push({ c: gh.c, r: gh.r, text: `+${pts}`, life: 1 });
            playSfx("score", 0.7);
            const home = HOUSE_CELLS[gh.index % HOUSE_CELLS.length];
            if (!home) continue;
            g.ghosts.splice(i, 1);
            g.ghosts.push({
              c: home.c,
              r: home.r,
              dir: DIRS.up,
              next: null,
              speed: base,
              color: gh.color,
              scatter: gh.scatter,
              mode: "house",
              releaseAt: 1.5,
              index: gh.index,
              bonus: Math.min(
                gh.bonus + RESPAWN_SPEED_STEP,
                MAX_GHOST_SPEED - levelBase,
              ),
            });
            publish();
          } else {
            g.lives -= 1;
            g.status = "dying";
            g.deathT = 0;
            playSfx("collision", 0.8);
            publish();
          }
        }
      }
    };

    // Appends a flat-top hexagon sub-path to the current path (no beginPath).
    const hexagon = (x: number, y: number, size: number) => {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = x + Math.cos(angle) * size;
        const py = y + Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    const draw = () => {
      const g = game.current;
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(0, 0, W, H);

      // grid glow floor
      ctx.strokeStyle = PALETTE.gridGlow;
      ctx.lineWidth = 1;
      for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, H);
        ctx.stroke();
      }
      for (let j = 0; j <= ROWS; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * CELL);
        ctx.lineTo(W, j * CELL);
        ctx.stroke();
      }

      // walls: glowing orange hexagonal blocks
      const wallPath = () => {
        ctx.beginPath();
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (g.grid[r]![c] === "#") {
              hexagon(c * CELL + CELL / 2, r * CELL + CELL / 2, CELL * 0.43);
            }
          }
        }
      };
      ctx.save();
      ctx.shadowColor = PALETTE.wall;
      ctx.shadowBlur = 14;
      ctx.fillStyle = PALETTE.wallInner;
      wallPath();
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = PALETTE.wall;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.95;
      wallPath();
      ctx.stroke();
      ctx.restore();

      // ghost door
      ctx.save();
      ctx.shadowColor = PALETTE.door;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = PALETTE.door;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (g.grid[r]![c] === "=") {
            ctx.moveTo(c * CELL + 4, r * CELL + CELL / 2);
            ctx.lineTo(c * CELL + CELL - 4, r * CELL + CELL / 2);
          }
        }
      }
      ctx.stroke();
      ctx.restore();

      // pellets
      ctx.save();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = g.grid[r]![c];
          if (v === ".") {
            ctx.shadowColor = PALETTE.pellet;
            ctx.shadowBlur = 8;
            ctx.fillStyle = PALETTE.pellet;
            ctx.beginPath();
            ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 2.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (v === "*") {
            const pulse = 4.4 + Math.sin(g.mouth * 0.6) * 1.4;
            ctx.shadowColor = PALETTE.power;
            ctx.shadowBlur = 18;
            ctx.fillStyle = PALETTE.power;
            ctx.beginPath();
            ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, pulse, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();

      // Fixed cycle: 4 seconds of normal color, then 3 seconds where the
      // viruses turn yellow and are vulnerable. Repeats every 7 seconds.
      // During the last 1.5s of the yellow phase the viruses blink
      // (yellow/normal) every 0.5s to warn the phase is ending.
      const virusBlue = isVirusBlue(g.t);
      const virusBlinkOff = isVirusBlinkOff(g.t);
      for (const gh of g.ghosts) {
        const x = gh.c * CELL + CELL / 2;
        const y = gh.r * CELL + CELL / 2;
        const rad = CELL * 0.34;
        const fright = g.frightened > 0 && gh.mode === "out";
        const flash =
          fright &&
          g.frightened < BLINK_SECONDS &&
          Math.floor(g.t / BLINK_INTERVAL) % 2 === 0;
        const color =
          flash || virusBlinkOff
            ? gh.color
            : fright || virusBlue
              ? PALETTE.frightened
              : gh.color;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(g.mouth * 0.16 + gh.index) * 0.08);
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineCap = "round";

        // Eight short horns around the virus body.
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8;
          const inner = rad * 0.82;
          const outer = rad * 1.42;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(
            Math.cos(angle) * outer,
            Math.sin(angle) * outer,
            rad * 0.14,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();

        // Uneven viral surface spots.
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = PALETTE.pupil;
        for (const spot of [
          { x: -0.35, y: -0.48, s: 0.12 },
          { x: 0.42, y: 0.2, s: 0.1 },
          { x: -0.46, y: 0.36, s: 0.08 },
        ]) {
          ctx.beginPath();
          ctx.arc(spot.x * rad, spot.y * rad, spot.s * rad, 0, Math.PI * 2);
          ctx.fill();
        }

        // Eyes continue to track the current movement direction.
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 6;
        ctx.shadowColor = PALETTE.eyes;
        ctx.fillStyle = PALETTE.eyes;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(side * rad * 0.36, -rad * 0.16, rad * 0.25, rad * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = PALETTE.pupil;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(
            side * rad * 0.36 + gh.dir.x * rad * 0.11,
            -rad * 0.16 + gh.dir.y * rad * 0.11,
            rad * 0.12,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.restore();
      }

      // orange hexagon player with a wedge mouth and a directional eye
      const dying = g.status === "dying";
      const px = g.player.c * CELL + CELL / 2;
      const py = g.player.r * CELL + CELL / 2;
      const ang = Math.atan2(g.player.dir.y, g.player.dir.x);
      const open = dying
        ? Math.min(Math.PI, (g.deathT / 1.3) * Math.PI)
        : 0.26 + Math.abs(Math.sin(g.mouth)) * 0.3;
      const playerRadius = CELL * 0.47;
      ctx.save();
      ctx.shadowColor = PALETTE.player;
      ctx.shadowBlur = 22;
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.moveTo(px, py);
      const startAngle = ang + open;
      const endAngle = ang - open + Math.PI * 2;
      const vertexStep = Math.PI / 3;
      const firstVertex = Math.ceil(startAngle / vertexStep) * vertexStep;
      ctx.lineTo(
        px + Math.cos(startAngle) * playerRadius,
        py + Math.sin(startAngle) * playerRadius,
      );
      for (let angle = firstVertex; angle < endAngle; angle += vertexStep) {
        ctx.lineTo(
          px + Math.cos(angle) * playerRadius,
          py + Math.sin(angle) * playerRadius,
        );
      }
      ctx.lineTo(
        px + Math.cos(endAngle) * playerRadius,
        py + Math.sin(endAngle) * playerRadius,
      );
      ctx.closePath();
      ctx.fill();

      if (!dying) {
        const eyeSide = g.player.dir.x === 0 ? 1 : -g.player.dir.x;
        const eyeX =
          px + g.player.dir.x * playerRadius * 0.18 + eyeSide * playerRadius * 0.18;
        const eyeY =
          py +
          g.player.dir.y * playerRadius * 0.18 -
          Math.abs(g.player.dir.x) * playerRadius * 0.3;
        ctx.shadowBlur = 5;
        ctx.shadowColor = PALETTE.eyes;
        ctx.fillStyle = PALETTE.eyes;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, playerRadius * 0.17, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = PALETTE.pupil;
        ctx.beginPath();
        ctx.arc(
          eyeX + g.player.dir.x * playerRadius * 0.05,
          eyeY + g.player.dir.y * playerRadius * 0.05,
          playerRadius * 0.08,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();

      // floaters
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "bold 13px ui-monospace, monospace";
      for (const f of g.floaters) {
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.shadowColor = PALETTE.frightenedFlash;
        ctx.shadowBlur = 10;
        ctx.fillStyle = PALETTE.frightenedFlash;
        ctx.fillText(f.text, f.c * CELL + CELL / 2, f.r * CELL + CELL / 2 - (1 - f.life) * 18);
      }
      ctx.restore();

      // scanline overlay
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#ffffff";
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [countPellets, isWall, nextLevel, publish, resetPositions, spawnGhosts]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2">
      <div className="grid w-full max-w-[520px] grid-cols-4 gap-1.5 font-mono text-[9px] uppercase tracking-widest">
        {[
          { k: "Score", v: hud.score },
          { k: "Best", v: hud.best },
          { k: "Level", v: hud.level },
          { k: "Lives", v: hud.lives },
        ].map((s) => (
          <div key={s.k} className="rounded-md border border-primary/30 bg-card/60 px-1 py-1 text-center shadow-neon-sm">
            <div className="text-muted-foreground">{s.k}</div>
            <div className="text-sm font-bold leading-tight text-primary">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-primary/40 bg-card/40 p-1.5 shadow-neon">
        <canvas
          ref={canvasRef}
          style={{ aspectRatio: `${W} / ${H}` }}
          className="h-[80%] max-h-[80%] w-auto max-w-full touch-none rounded-xl"
        />
        {(hud.status === "ready" || hud.status === "over") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/80 backdrop-blur-sm">
            <h2 className="font-display text-2xl font-black uppercase tracking-[0.2em] text-primary drop-shadow-[0_0_12px_var(--color-primary)]">
              {hud.status === "over" ? "System Down" : "Ready"}
            </h2>
            <p className="max-w-[80%] text-center font-mono text-xs text-muted-foreground">
              {hud.status === "over"
                ? `Final score ${hud.score}. Reboot and run the grid again.`
                : "Swipe or use arrow keys / WASD to move."}
            </p>
            <Button
              onClick={() => (hud.status === "over" ? startGame() : setDir(DIRS.left))}
              className="rounded-full border border-accent/60 bg-accent/15 px-6 py-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent transition hover:bg-accent/25 shadow-neon-sm"
            >
              {hud.status === "over" ? "Reboot" : "Start"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid w-[132px] shrink-0 grid-cols-3 gap-1.5 md:hidden">
        <span />
        <PadButton label="▲" onPress={() => setDir(DIRS.up)} />
        <span />
        <PadButton label="◀" onPress={() => setDir(DIRS.left)} />
        <PadButton label="▼" onPress={() => setDir(DIRS.down)} />
        <PadButton label="▶" onPress={() => setDir(DIRS.right)} />
      </div>
    </div>
  );
}

function PadButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="aspect-square rounded-xl border border-primary/40 bg-card/70 text-primary shadow-neon-sm transition active:bg-primary/20"
    >
      {label}
    </Button>
  );
}
