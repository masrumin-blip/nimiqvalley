import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { playSfx } from "@/lib/sfx";

/**
 * CROSSING FOR NIMIQ
 * A polished endless hopper: grass, roads with cars, rivers with logs.
 * Keyboard: WASD / arrows. Touch: swipe or tap directional buttons.
 */

// ---------- Types ----------
type LaneType = "grass" | "road" | "river";

interface Obstacle {
  /** world x in cells (float) */
  x: number;
  width: number; // in cells
  speed: number; // cells per second (sign = direction)
  kind: "car" | "truck" | "log";
  hue: number;
}

interface Lane {
  type: LaneType;
  obstacles: Obstacle[];
  /** static tree cells for grass */
  trees: number[];
  /** hexagonal coin columns waiting to be collected */
  coins: number[];
  index: number;
}


interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

// ---------- Constants ----------
const COLS = 11;
const PLAYER_COL = 5;
const LANES_AHEAD = 16;
const LANES_BEHIND = 6;
const CELL = 64; // px, scaled by dpr & zoom
const HOP_TIME = 0.12;
// Minimum center-to-center distance between vehicles so a gap is always passable
const MIN_ROAD_GAP = 4.6;
// Player hitbox half-width in cells (tight: car must really touch the player)
const PLAYER_HALF = 0.28;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));

function makeLane(index: number): Lane {
  // First lanes always grass for a safe start
  if (index < 3) {
    return {
      type: "grass",
      obstacles: [],
      trees: scatterTrees().filter((c) => c !== PLAYER_COL),
      coins: [],
      index,
    };
  }
  const prevBias = index < 6 ? 0.35 : 0; // gentle ramp
  const r = Math.random();
  let type: LaneType;
  if (r < 0.4 - prevBias * 0.2) type = "road";
  else if (r < 0.65 - prevBias * 0.1) type = "river";
  else type = "grass";

  const lane: Lane = { type, obstacles: [], trees: [], coins: [], index };

  if (type === "grass") {
    lane.trees = scatterTrees();
  } else if (type === "road") {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = dir * rand(2.2, 4.6) * (1 + index * 0.004);
    const baseCount = randInt(2, 4);
    // Vehicle intensity reduced by 25%
    const count = Array.from({ length: baseCount }, () => Math.random() < 0.4875).filter(Boolean).length;
    const spacing = count > 0 ? Math.max(COLS / count + rand(1, 3), MIN_ROAD_GAP) : 0;
    for (let i = 0; i < count; i++) {
      const isTruck = Math.random() < 0.25;
      lane.obstacles.push({
        x: i * spacing + rand(-0.6, 0.6),
        width: isTruck ? 2.6 : 1.6,
        speed,
        kind: isTruck ? "truck" : "car",
        hue: randInt(0, 359),
      });
    }
  } else {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = dir * rand(1.4, 3.0) * (1 + index * 0.003);
    const count = randInt(2, 3);
    const spacing = COLS / count + rand(1.5, 3.5);
    for (let i = 0; i < count; i++) {
      lane.obstacles.push({
        x: i * spacing + rand(-0.5, 0.5),
        width: rand(2.2, 3.8),
        speed,
        kind: "log",
        hue: 0,
      });
    }
  }
  // scatter coins on walkable ground (grass without trees, or road)
  if (index >= 1 && (type === "grass" || type === "road")) {
    const n = type === "grass" ? randInt(2, 3) : randInt(1, 2);
    for (let i = 0; i < n; i++) {
      const c = randInt(0, COLS - 1);
      if (!lane.trees.includes(c) && !lane.coins.includes(c)) lane.coins.push(c);
    }
  }
  return lane;
}

function scatterTrees(): number[] {
  const trees: number[] = [];
  // Keep one guaranteed open corridor so a row can never be a dead end
  const corridor = randInt(0, COLS - 1);
  for (let c = 0; c < COLS; c++) {
    if (c === corridor) continue;
    if (trees.length >= 4) break;
    if (Math.random() < 0.22) trees.push(c);
  }
  return trees;
}

// ---------- Component ----------
export default function CrossingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("nimiq-coins-best") || 0));
    } catch {}
  }, []);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const exitConfirmRef = useRef(false);
  useEffect(() => {
    exitConfirmRef.current = exitConfirm;
  }, [exitConfirm]);

  const stateRef = useRef({
    lanes: [] as Lane[],
    player: { x: PLAYER_COL, y: 0, px: PLAYER_COL, py: 0, hopT: 1, facing: 1 },
    score: 0,
    dead: false,
    deadT: 0,
    particles: [] as Particle[],
    cameraY: -3,
    started: false,
    time: 0,
    onLog: null as Obstacle | null,
    logOffset: 0,

    deathCause: "" as "" | "car" | "water",
  });

  const spawnBurst = useCallback((x: number, y: number, color: string, n: number) => {
    const s = stateRef.current;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(1.5, 5);
      s.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2,
        life: 0,
        maxLife: rand(0.4, 0.8),
        size: rand(0.06, 0.16),
        color,
      });
    }
  }, []);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.lanes = [];
    for (let i = -LANES_BEHIND; i < LANES_AHEAD; i++) s.lanes.push(makeLane(i));
    s.player = { x: PLAYER_COL, y: 0, px: PLAYER_COL, py: 0, hopT: 1, facing: 1 };
    s.score = 0;
    s.dead = false;
    s.deadT = 0;
    s.particles = [];
    s.cameraY = -3;
    s.onLog = null;
    s.logOffset = 0;
    s.deathCause = "";
    setScore(0);
    setGameOver(false);
    setExitConfirm(false);
  }, []);

  const die = useCallback(
    (cause: "car" | "water") => {
      const s = stateRef.current;
      if (s.dead) return;
      s.dead = true;
      s.deathCause = cause;
      s.deadT = 0;
      spawnBurst(s.player.x, s.player.y, cause === "car" ? "#ff5d5d" : "#4fc3f7", 26);
      playSfx(cause === "car" ? "collision" : "splash", 0.8);
      setBest((b) => {
        const nb = Math.max(b, s.score);
        try {
          localStorage.setItem("nimiq-coins-best", String(nb));
        } catch {}
        return nb;
      });
      setTimeout(() => { setGameOver(true); playSfx("gameover", 0.8); }, 700);
    },
    [spawnBurst],
  );

  const move = useCallback(
    (dx: number, dy: number) => {
      const s = stateRef.current;
      if (s.dead || !s.started) return;
      if (s.player.hopT < 1) return; // one press = one hop
      // snap back to the grid (riding a log leaves a fractional x)
      const nx = Math.round(s.player.x + dx);
      const ny = s.player.y + dy;
      if (nx < 0 || nx >= COLS) return;
      // blocked by tree?
      const lane = s.lanes.find((l) => l.index === ny);
      if (lane?.type === "grass" && lane.trees.includes(nx)) return;
      s.player.px = s.player.x;
      s.player.py = s.player.y;
      s.player.x = nx;
      s.player.y = ny;
      s.player.hopT = 0;
      s.onLog = null;
      if (dx !== 0) s.player.facing = dx;
      spawnBurst(nx - dx * 0.3, ny - dy * 0.3, "rgba(255,255,255,0.7)", 5);
      playSfx("jump", 0.45);

      // scoring: collect hexagonal coins
      if (lane) {
        const ci = lane.coins.indexOf(nx);
        if (ci >= 0) {
          lane.coins.splice(ci, 1);
          s.score += 1;
          setScore(s.score);
          spawnBurst(nx, ny, "#f7c531", 12);
          playSfx("coin", 0.6);
        }
      }
    },
    [spawnBurst],
  );

  // ---------- input ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return; // held key must not auto-repeat hops
      const s = stateRef.current;
      if (exitConfirm) return;
      if (!s.started) {
        return;
      }
      if (s.dead) return;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          move(0, 1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          move(0, -1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          move(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          move(1, 0);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitConfirm, move]);

  // swipe
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let active = false;
    const fromControl = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("button");
    const ts = (e: TouchEvent) => {
      if (fromControl(e.target)) {
        active = false;
        return;
      }
      active = true;
      sx = e.touches[0]!.clientX;
      sy = e.touches[0]!.clientY;
    };
    const te = (e: TouchEvent) => {
      if (!active || fromControl(e.target)) return;
      active = false; // one move per gesture
      const s = stateRef.current;
      if (!s.started || exitConfirm) return;
      const dx = e.changedTouches[0]!.clientX - sx;
      const dy = e.changedTouches[0]!.clientY - sy;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (Math.max(adx, ady) < 24) {
        move(0, 1); // tap = forward
        return;
      }
      if (adx > ady) move(dx > 0 ? 1 : -1, 0);
      else move(0, dy < 0 ? 1 : -1);
    };
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchend", te);
    return () => {
      el.removeEventListener("touchstart", ts);
      el.removeEventListener("touchend", te);
    };
  }, [exitConfirm, move]);

  // ---------- game loop ----------
  useEffect(() => {
    reset();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrapRef.current!.clientWidth;
      const h = wrapRef.current!.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = stateRef.current;
      s.time += dt;

      // --- update ---
      if (s.started && !s.dead && !exitConfirmRef.current) {
        s.player.hopT = Math.min(1, s.player.hopT + dt / HOP_TIME);

        // extend lanes
        const maxLane = s.lanes[s.lanes.length - 1]?.index ?? 0;
        if (s.player.y + LANES_AHEAD > maxLane) {
          for (let i = maxLane + 1; i <= s.player.y + LANES_AHEAD; i++) {
            s.lanes.push(makeLane(i));
          }
        }
        // prune old lanes
        while (s.lanes.length && s.lanes[0]!.index < s.player.y - LANES_BEHIND - 4) {
          s.lanes.shift();
        }

        // move obstacles — wrap instantly at the screen edges
        for (const lane of s.lanes) {
          for (const ob of lane.obstacles) {
            ob.x += ob.speed * dt;
            const half = ob.width / 2;
            let shift = 0;
            if (ob.speed > 0 && ob.x - half > COLS) shift = -(COLS + ob.width);
            if (ob.speed < 0 && ob.x + half < 0) shift = COLS + ob.width;
            if (shift !== 0) {
              ob.x += shift;
              // carry the rider along so it never looks like a fall
              if (s.onLog === ob) {
                s.player.x += shift;
                s.player.px += shift;
              }
            }
          }
        }


        // player lane interactions
        const lane = s.lanes.find((l) => l.index === s.player.y);
        if (lane) {
          if (lane.type === "road") {
            for (const ob of lane.obstacles) {
              // require real overlap between the car body and the player body
              const overlap =
                Math.min(s.player.x + PLAYER_HALF, ob.x + ob.width / 2) -
                Math.max(s.player.x - PLAYER_HALF, ob.x - ob.width / 2);
              if (overlap > 0.06) {
                die("car");
              }
            }
            s.onLog = null;
          } else if (lane.type === "river") {
            // stay locked to the current log as long as it belongs to this lane
            let riding: Obstacle | null =
              s.onLog && lane.obstacles.includes(s.onLog) ? s.onLog : null;
            if (!riding) {
              for (const ob of lane.obstacles) {
                if (
                  s.player.x > ob.x - ob.width / 2 - 0.3 &&
                  s.player.x < ob.x + ob.width / 2 + 0.3
                ) {
                  riding = ob;
                  break;
                }
              }
            }
            if (riding && s.player.hopT >= 1) {
              if (s.onLog !== riding) {
                s.onLog = riding;
                s.logOffset = s.player.x - riding.x;
              }
            } else if (s.player.hopT >= 1 && !riding) {
              die("water");
            }
          } else {
            s.onLog = null;
          }
        }


        // ride the log — the player is locked to the log, so wrapping is seamless
        if (s.onLog && !s.dead) {
          s.player.x = s.onLog.x + s.logOffset;
          if (s.player.hopT >= 1) s.player.px = s.player.x;
        }



        // idle timeout: eagle — skip for simplicity, no pressure
      } else if (s.dead) {
        s.deadT += dt;
      }

      // camera follow (smooth)
      const targetCam = s.player.y - 3;
      s.cameraY += (targetCam - s.cameraY) * Math.min(1, dt * 6);

      // particles
      for (const p of s.particles) {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 9 * dt;
      }
      s.particles = s.particles.filter((p) => p.life < p.maxLife);

      // --- render ---
      const w = canvas.width;
      const h = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cell = CELL * dpr * Math.min(1.15, Math.max(0.72, w / (COLS * CELL * dpr * 0.92)));
      const DEPTH = 0.58; // vertical squash => tilted camera look
      const laneH = cell * DEPTH;
      const baseY = h * 0.9;
      const originX = w / 2 - (COLS * cell) / 2;
      const toScreenY = (laneIdx: number, frac = 0) =>
        baseY - (laneIdx - s.cameraY + frac) * laneH;

      // sky: dusk gradient
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#1b1338");
      bg.addColorStop(0.42, "#3d2a5c");
      bg.addColorStop(0.72, "#8a5a7a");
      bg.addColorStop(1, "#e08a6a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const horizon = toScreenY(s.cameraY + h / laneH) || 0;
      const hz = Math.max(0, Math.min(h * 0.55, h * 0.3));

      // sun glow
      const sunY = hz * 0.72;
      const sg = ctx.createRadialGradient(w * 0.7, sunY, 0, w * 0.7, sunY, h * 0.42);
      sg.addColorStop(0, "rgba(255,200,150,0.55)");
      sg.addColorStop(1, "rgba(255,180,140,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,226,190,0.9)";
      circle(ctx, w * 0.7, sunY, h * 0.045);

      // stars (upper sky)
      ctx.save();
      for (let i = 0; i < 46; i++) {
        const sx2 = ((i * 937.3) % 1) * w;
        const sy2 = ((i * 517.7) % 1) * h * 0.32;
        const tw = 0.5 + 0.5 * Math.sin(s.time * 2 + i);
        ctx.fillStyle = `rgba(255,255,255,${0.3 * tw})`;
        ctx.fillRect(sx2, sy2, 2 * dpr, 2 * dpr);
      }
      ctx.restore();

      // distant hills silhouettes
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer === 0 ? "rgba(52,34,66,0.75)" : "rgba(32,22,48,0.9)";
        ctx.beginPath();
        const baseHill = hz * (1.05 + layer * 0.22);
        ctx.moveTo(0, baseHill + h);
        for (let x = 0; x <= w; x += 12 * dpr) {
          const yy =
            baseHill -
            Math.sin(x / (w / (2.2 + layer)) + layer * 1.7) * h * (0.035 + layer * 0.02) -
            Math.sin(x / (w / 7) + layer) * h * 0.012;
          ctx.lineTo(x, yy);
        }
        ctx.lineTo(w, baseHill + h);
        ctx.closePath();
        ctx.fill();
      }

      // ---- 2.5D box helper (oblique projection) ----
      const box = (
        cx: number,
        yFront: number,
        bw: number,
        bd: number,
        bh: number,
        top: string,
        front: string,
      ) => {
        const x0 = cx - bw / 2;
        const yBack = yFront - bd;
        // front face
        ctx.fillStyle = front;
        ctx.fillRect(x0, yFront - bh, bw, bh);
        // top face
        ctx.fillStyle = top;
        ctx.fillRect(x0, yBack - bh, bw, bd);
      };
      const shadow = (cx: number, cy: number, rx: number) => {
        ctx.fillStyle = "rgba(20,10,30,0.28)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, rx * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      // flat-top hexagonal yellow coin with a thin extruded rim
      const hexPath = (cx: number, cy: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 6 + (Math.PI / 3) * i;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r * DEPTH;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };
      const hexCoin = (cx: number, groundY: number, r: number, phase: number) => {
        const bob = Math.sin(s.time * 3 + phase) * r * 0.18;
        const thick = r * 0.34;
        const cy = groundY - r * 0.55 * DEPTH - thick - bob;
        shadow(cx, groundY, r * 0.7);
        // extruded rim (darker gold)
        ctx.fillStyle = "#b8860f";
        hexPath(cx, cy + thick, r);
        ctx.fill();
        ctx.fillStyle = "#d19b18";
        ctx.fillRect(cx - r, cy, r * 2, thick);
        // plated top face
        ctx.fillStyle = "#f7c531";
        hexPath(cx, cy, r);
        ctx.fill();
        // subtle plate highlight
        ctx.fillStyle = "rgba(255,244,190,0.6)";
        hexPath(cx, cy - r * 0.05 * DEPTH, r * 0.6);
        ctx.fill();
      };

      const p = s.player;
      const hopE = easeOut(p.hopT);
      const playerScreenY = toScreenY(p.py) + (toScreenY(p.y) - toScreenY(p.py)) * hopE;
      const playerScreenX = originX + (p.px + (p.x - p.px) * hopE + 0.5) * cell;

      // draw lanes far -> near
      const ordered = [...s.lanes].sort((a, b) => b.index - a.index);
      for (const lane of ordered) {
        const yFront = toScreenY(lane.index);
        const yBack = yFront - laneH;
        if (yBack > h + laneH * 2 || yFront < -laneH * 6) continue;
        

        if (lane.type === "grass") {
          const alt = lane.index % 2 === 0;
          const lift = cell * 0.05;
          // side (thickness)
          ctx.fillStyle = alt ? "#2f5f34" : "#2a5730";
          ctx.fillRect(0, yFront - lift, w, lift + 1);
          // top
          ctx.fillStyle = alt ? "#4f9a4f" : "#579f52";
          ctx.fillRect(0, yBack - lift, w, laneH + 1);
          // per-column checker so one step reads as one tile
          ctx.fillStyle = alt ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.045)";
          for (let c = 0; c < COLS; c++) {
            if ((c + lane.index) % 2 === 0) {
              ctx.fillRect(originX + c * cell, yBack - lift, cell, laneH + 1);
            }
          }
          // lane separator
          ctx.fillStyle = "rgba(20,50,25,0.25)";
          ctx.fillRect(0, yFront - lift, w, 1.5 * dpr);
          // speckles
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          for (let c = 0; c < COLS; c++) {
            if ((lane.index * 31 + c * 17) % 5 === 0) {
              ctx.fillRect(
                originX + c * cell + cell * 0.28,
                yBack - lift + laneH * 0.35,
                cell * 0.16,
                laneH * 0.22,
              );
            }
          }
          // trees as extruded blocks
          for (const t of lane.trees) {
            const tx = originX + (t + 0.5) * cell;
            const groundY = yFront - lift;
            shadow(tx, groundY, cell * 0.3);
            box(tx, groundY, cell * 0.16, laneH * 0.5, cell * 0.34, "#6b4426", "#4b2f1a");
            const th = cell * 0.34;
            box(
              tx,
              groundY - th * 0.7,
              cell * 0.62,
              laneH * 0.72,
              cell * 0.5,
              "#4fbe6a",
              "#2f8b4a",
            );
            box(
              tx,
              groundY - th * 0.7 - cell * 0.42,
              cell * 0.42,
              laneH * 0.55,
              cell * 0.3,
              "#68d47d",
              "#3ba055",
            );
          }
        } else if (lane.type === "road") {
          ctx.fillStyle = "#3a3550";
          ctx.fillRect(0, yFront - cell * 0.02, w, cell * 0.02 + 1);
          ctx.fillStyle = "#2b2740";
          ctx.fillRect(0, yBack, w, laneH + 1);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(0, yBack, w, 2 * dpr);
          // dashed center line, one dash per tile
          ctx.fillStyle = "rgba(255,240,200,0.28)";
          for (let c = 0; c < COLS; c++) {
            ctx.fillRect(
              originX + c * cell + cell * 0.3,
              yBack + laneH / 2 - 1.5 * dpr,
              cell * 0.4,
              3 * dpr,
            );
          }
          // lane separator at the near edge
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(0, yFront - 1.5 * dpr, w, 1.5 * dpr);
        } else {
          const rg = ctx.createLinearGradient(0, yBack, 0, yFront);
          rg.addColorStop(0, "#1b4a7a");
          rg.addColorStop(1, "#123457");
          ctx.fillStyle = rg;
          ctx.fillRect(0, yBack, w, laneH + 1);
          ctx.strokeStyle = "rgba(170,220,255,0.2)";
          ctx.lineWidth = 2 * dpr;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            for (let x = 0; x <= w; x += 8 * dpr) {
              const wy =
                yBack +
                laneH * (0.22 + i * 0.28) +
                Math.sin(x / (30 * dpr) + s.time * 2 + i * 2) * 2.5 * dpr;
              if (x === 0) ctx.moveTo(x, wy);
              else ctx.lineTo(x, wy);
            }
            ctx.stroke();
          }
          // sun reflection shimmer
          ctx.fillStyle = `rgba(255,210,170,${0.06 + 0.03 * Math.sin(s.time * 3)})`;
          ctx.fillRect(w * 0.6, yBack, w * 0.2, laneH);
        }

        // obstacles as boxes
        for (const ob of lane.obstacles) {
          const ox = originX + ob.x * cell;
          const ow = ob.width * cell;
          if (ob.kind === "log") {
            const gy = yFront - laneH * 0.12;
            box(ox, gy, ow, laneH * 0.66, cell * 0.16, "#9a6a3c", "#6d4524");
            ctx.fillStyle = "rgba(0,0,0,0.15)";
            ctx.fillRect(ox - ow / 2, gy - laneH * 0.66 - cell * 0.16, ow, 2 * dpr);
          } else {
            const gy = yFront - laneH * 0.08;
            const bw = ow;
            const bd = laneH * 0.7;
            const bodyH = ob.kind === "truck" ? cell * 0.3 : cell * 0.24;
            shadow(ox, gy, ow * 0.45);
            box(
              ox,
              gy,
              bw,
              bd,
              bodyH,
              `oklch(0.72 0.16 ${ob.hue})`,
              `oklch(0.5 0.16 ${ob.hue})`,
            );
            // cabin / roof
            const cabW = ob.kind === "truck" ? bw * 0.34 : bw * 0.5;
            const dir = ob.speed > 0 ? 1 : -1;
            const cabX = ob.kind === "truck" ? ox + dir * (bw / 2 - cabW / 2) : ox;
            box(
              cabX,
              gy - bodyH,
              cabW,
              bd * 0.78,
              cell * 0.18,
              `oklch(0.8 0.12 ${ob.hue})`,
              "rgba(200,230,255,0.75)",
            );
            // headlights
            ctx.fillStyle = "rgba(255,235,180,0.95)";
            const hx = dir > 0 ? ox + bw / 2 - 5 * dpr : ox - bw / 2;
            ctx.fillRect(hx, gy - bodyH * 0.75, 5 * dpr, bodyH * 0.3);
          }
        }

        // hexagonal coins
        for (const c of lane.coins) {
          hexCoin(originX + (c + 0.5) * cell, yFront - cell * 0.03, cell * 0.24, c + lane.index);
        }

        // player drawn within its lane for correct depth
        if (!s.dead && lane.index === Math.round(p.y)) {
          drawPlayer();
        }
      }

      function drawPlayer() {
        const hop = Math.sin(Math.PI * hopE);
        const gy = playerScreenY;
        shadow(playerScreenX, gy, cell * 0.32);
        const lift = hop * cell * 0.42;
        const bodyY = gy - lift;
        const bd = laneH * 0.6;
        const facing = p.facing;
        const headX = playerScreenX + facing * cell * 0.2;
        // buffalo body and shoulder hump
        box(playerScreenX, bodyY, cell * 0.58, bd, cell * 0.34, "#6f4a2f", "#49301f");
        box(
          playerScreenX - facing * cell * 0.13,
          bodyY - cell * 0.3,
          cell * 0.34,
          bd * 0.72,
          cell * 0.16,
          "#7d5536",
          "#543722",
        );
        // broad head
        box(headX, bodyY - cell * 0.28, cell * 0.4, bd * 0.72, cell * 0.29, "#654329", "#3e291a");
        // pale, curved horns
        ctx.strokeStyle = "#efe2bd";
        ctx.lineWidth = cell * 0.07;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(headX - cell * 0.13, bodyY - cell * 0.55);
        ctx.quadraticCurveTo(headX - cell * 0.3, bodyY - cell * 0.68, headX - cell * 0.34, bodyY - cell * 0.56);
        ctx.moveTo(headX + cell * 0.13, bodyY - cell * 0.55);
        ctx.quadraticCurveTo(headX + cell * 0.3, bodyY - cell * 0.68, headX + cell * 0.34, bodyY - cell * 0.56);
        ctx.stroke();
        // ears
        ctx.fillStyle = "#83573a";
        ctx.fillRect(headX - cell * 0.27, bodyY - cell * 0.49, cell * 0.13, cell * 0.08);
        ctx.fillRect(headX + cell * 0.14, bodyY - cell * 0.49, cell * 0.13, cell * 0.08);
        // muzzle
        box(
          headX + facing * cell * 0.05,
          bodyY - cell * 0.27,
          cell * 0.27,
          bd * 0.3,
          cell * 0.11,
          "#a77a5b",
          "#77523b",
        );
        // eyes and nostrils
        ctx.fillStyle = "#17110c";
        ctx.fillRect(headX + facing * cell * 0.09, bodyY - cell * 0.49, cell * 0.045, cell * 0.05);
        ctx.fillRect(headX - cell * 0.07, bodyY - cell * 0.31, cell * 0.035, cell * 0.025);
        ctx.fillRect(headX + cell * 0.04, bodyY - cell * 0.31, cell * 0.035, cell * 0.025);
        // four sturdy legs and dark hooves
        for (const lx of [-0.2, -0.08, 0.09, 0.21]) {
          ctx.fillStyle = "#4a301f";
          ctx.fillRect(playerScreenX + cell * lx - cell * 0.035, bodyY - cell * 0.03, cell * 0.07, cell * 0.12);
          ctx.fillStyle = "#201b18";
          ctx.fillRect(playerScreenX + cell * lx - cell * 0.04, bodyY + cell * 0.07, cell * 0.08, cell * 0.04);
        }
        // tail
        ctx.strokeStyle = "#3b2619";
        ctx.lineWidth = cell * 0.035;
        ctx.beginPath();
        ctx.moveTo(playerScreenX - facing * cell * 0.29, bodyY - cell * 0.27);
        ctx.quadraticCurveTo(
          playerScreenX - facing * cell * 0.4,
          bodyY - cell * 0.15,
          playerScreenX - facing * cell * 0.34,
          bodyY - cell * 0.06,
        );
        ctx.stroke();
      }

      // atmospheric haze toward the horizon
      const hazeTop = toScreenY(p.y + 17);
      const hg = ctx.createLinearGradient(0, hazeTop - laneH * 4, 0, hazeTop + h * 0.22);
      hg.addColorStop(0, "rgba(146,96,126,0.7)");
      hg.addColorStop(1, "rgba(146,96,126,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, w, hazeTop + h * 0.22);


      // particles

      for (const pt of s.particles) {
        const alpha = 1 - pt.life / pt.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pt.color;
        circle(ctx, originX + (pt.x + 0.5) * cell, toScreenY(pt.y) - laneH * 0.3, pt.size * cell);
      }
      ctx.globalAlpha = 1;

      // vignette
      const vg = ctx.createRadialGradient(w / 2, h * 0.6, h * 0.32, w / 2, h * 0.6, h * 0.9);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(10,4,20,0.5)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      void horizon;


      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [die, reset]);

  const startOrRestart = () => {
    reset();
    stateRef.current.started = true;
    setStarted(true);
  };

  const returnToMenu = () => {
    reset();
    stateRef.current.started = false;
    setStarted(false);
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-dvh w-full touch-none overflow-hidden bg-background select-none"
    >
      <canvas ref={canvasRef} className="block" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
        <div className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card/70 px-4 py-2 backdrop-blur-md">
          <HexCoin className="h-7 w-7" />
          <div className="font-display text-3xl font-bold text-[var(--gold)] tabular-nums">
            {score}
          </div>
        </div>
        <div className="ml-auto rounded-2xl border border-border/40 bg-card/70 px-4 py-2 text-right backdrop-blur-md">
          <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Best
          </div>
          <div className="font-display text-3xl font-bold text-[var(--gold)] tabular-nums">
            {best}
          </div>
        </div>
        {started && !gameOver && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExitConfirm(true)}
            className="pointer-events-auto h-12 rounded-xl border border-border/40 bg-card/70 px-4 font-display font-bold backdrop-blur-md"
            aria-label="Exit game"
          >
            Exit
          </Button>
        )}
      </div>

      {/* Tutorial / start overlay */}
      {!started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-background/70 px-6 py-8 backdrop-blur-sm">
          <div className="animate-fade-in text-center">
            <div className="font-display text-4xl font-extrabold tracking-tight text-[var(--gold)] sm:text-6xl">
              Crossing for Nimiq
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Guide the brave buffalo across an endless world.
            </p>
          </div>

          <div className="w-full max-w-sm rounded-3xl border border-border/40 bg-card/70 p-5 backdrop-blur-md">
            <div className="mb-3 text-[10px] font-semibold tracking-widest text-[var(--gold)] uppercase">
              How to play
            </div>
            <ul className="space-y-2.5 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="text-lg leading-none">👆</span>
                <span>
                  <b>Swipe</b> up, down, left or right to hop one tile.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-lg leading-none">👇</span>
                <span>
                  <b>Tap</b> the screen to hop forward, or use the on-screen arrow buttons.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-lg leading-none">⌨️</span>
                <span>
                  On desktop use <b>WASD</b> or the <b>arrow keys</b> — one press, one hop.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <HexCoin className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  Grab the yellow hexagonal coins — they are your score.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-lg leading-none">🚗</span>
                <span>Dodge cars and trucks — one touch and it is over.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-lg leading-none">🪵</span>
                <span>Ride the floating logs across rivers, never land in the water.</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={startOrRestart}
            className="h-14 rounded-full bg-[var(--gold)] px-10 font-display text-lg font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-105 hover:bg-[var(--gold)] active:scale-95"
          >
            ▶ Start Game
          </Button>
        </div>
      )}

      {/* Game over overlay */}
      {gameOver && (
        <div className="absolute inset-0 flex animate-fade-in flex-col items-center justify-center gap-5 bg-background/70 px-6 backdrop-blur-md">
          <div className="text-center font-display text-4xl font-extrabold text-destructive sm:text-6xl">
            {stateRef.current.deathCause === "water" ? "💦 Splash!" : "💥 Crashed!"}
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2">
              <HexCoin className="h-8 w-8" />
              <div className="font-display text-4xl font-bold text-[var(--gold)] tabular-nums">
                {score}
              </div>
            </div>
            <div className="mt-1 text-xs tracking-widest text-muted-foreground uppercase">
              Coins collected · Best {best}
            </div>
          </div>
          <Button
            onClick={startOrRestart}
            className="h-14 rounded-full bg-[var(--gold)] px-10 font-display text-lg font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-105 hover:bg-[var(--gold)] active:scale-95"
          >
            ↻ Play Again
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={returnToMenu}
            className="h-12 rounded-full border border-border/40 bg-card/70 px-10 font-display text-base font-bold backdrop-blur-md"
          >
            ☰ Menu
          </Button>

        </div>
      )}

      {/* Exit confirmation */}
      {exitConfirm && started && !gameOver && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/75 px-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-game-title"
        >
          <div className="w-full max-w-xs rounded-2xl border border-border/60 bg-card p-6 text-center shadow-2xl">
            <div id="exit-game-title" className="font-display text-2xl font-extrabold text-foreground">
              Exit this run?
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Your collected coins from this run will be lost.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => setExitConfirm(false)} className="h-11">
                No
              </Button>
              <Button type="button" variant="destructive" onClick={returnToMenu} className="h-11">
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile d-pad */}
      {started && !gameOver && !exitConfirm && (
        <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2 sm:hidden">
          {[
            { label: "←", dx: -1, dy: 0 },
            { label: "↓", dx: 0, dy: -1 },
            { label: "↑", dx: 0, dy: 1 },
            { label: "→", dx: 1, dy: 0 },
          ].map((b) => (
            <Button
              key={b.label}
              type="button"
              variant="secondary"
              size="icon"
              onPointerDown={() => move(b.dx, b.dy)}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/40 bg-card/70 text-xl text-foreground backdrop-blur-md active:bg-accent"
              aria-label={`Move ${b.label}`}
            >
              {b.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- helpers ----------
function easeOut(t: number) {
  return 1 - Math.pow(1 - Math.min(1, t), 3);
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.roundRect(x, y, w, h, r);
}

/** Plain yellow flat-top hexagonal coin icon. */
function HexCoin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <polygon points="8,4 24,4 30,16 24,28 8,28 2,16" fill="#b8860f" />
      <polygon points="8,2.5 24,2.5 29,14.5 24,26.5 8,26.5 3,14.5" fill="#f7c531" />
      <polygon points="11,8 21,8 25,14.5 21,21 11,21 7,14.5" fill="#fff4be" opacity="0.55" />
    </svg>
  );
}
