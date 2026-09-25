/**
 * Deterministic, render-free simulation core for Crossing for Nimiq.
 * Runs identically in the browser and on the server (for score verification).
 * Never read Math.random / Date.now here — only the seeded rng and inputs.
 */
import { createRng } from "@/games/tappy/tappy-sim";

export { createRng };

export type LaneType = "grass" | "trail" | "river";

export interface Obstacle {
  x: number;
  width: number;
  speed: number;
  kind: "snake" | "log";
  hue: number;
}

export interface Lane {
  type: LaneType;
  obstacles: Obstacle[];
  trees: number[];
  coins: number[];
  index: number;
}

export const COLS = 11;
export const PLAYER_COL = 5;
export const LANES_AHEAD = 16;
export const LANES_BEHIND = 6;
export const HOP_TIME = 0.12;
const MIN_ROAD_GAP = 4.6;
const PLAYER_HALF = 0.28;

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;
/** Crossing has no timer, so allow long runs: 40 minutes. */
export const MAX_TICKS = TICK_RATE * 60 * 40;

/** Directions: 0 up, 1 down, 2 left, 3 right. */
export const DIRS: ReadonlyArray<[number, number]> = [
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
];

export interface CrossingSim {
  tick: number;
  lanes: Lane[];
  player: { x: number; y: number; px: number; py: number; hopT: number; facing: number };
  score: number;
  dead: boolean;
  deathCause: "" | "snake" | "water";
  onLog: Obstacle | null;
  logOffset: number;
}

export interface CrossingEvents {
  hop: { x: number; y: number; dx: number; dy: number } | null;
  coin: { x: number; y: number } | null;
  died: "" | "snake" | "water";
}

type Rng = () => number;
const rand = (rng: Rng, a: number, b: number) => a + rng() * (b - a);
const randInt = (rng: Rng, a: number, b: number) => Math.floor(rand(rng, a, b + 1));

function scatterTrees(rng: Rng): number[] {
  const trees: number[] = [];
  const corridor = randInt(rng, 0, COLS - 1);
  for (let c = 0; c < COLS; c++) {
    if (c === corridor) continue;
    if (trees.length >= 4) break;
    if (rng() < 0.22) trees.push(c);
  }
  return trees;
}

export function makeLane(rng: Rng, index: number): Lane {
  if (index < 3) {
    return { type: "grass", obstacles: [], trees: scatterTrees(rng).filter((c) => c !== PLAYER_COL), coins: [], index };
  }
  const prevBias = index < 6 ? 0.35 : 0;
  const r = rng();
  let type: LaneType;
  if (r < 0.4 - prevBias * 0.2) type = "trail";
  else if (r < 0.65 - prevBias * 0.1) type = "river";
  else type = "grass";

  const lane: Lane = { type, obstacles: [], trees: [], coins: [], index };
  if (type === "grass") {
    lane.trees = scatterTrees(rng);
  } else if (type === "trail") {
    const dir = rng() < 0.5 ? 1 : -1;
    const speed = dir * rand(rng, 2.2, 4.6) * (1 + index * 0.004);
    const baseCount = randInt(rng, 2, 4);
    let count = 0;
    for (let i = 0; i < baseCount; i++) if (rng() < 0.4875) count++;
    const spacing = count > 0 ? Math.max(COLS / count + rand(rng, 1, 3), MIN_ROAD_GAP) : 0;
    for (let i = 0; i < count; i++) {
      lane.obstacles.push({
        x: i * spacing + rand(rng, -0.6, 0.6),
        width: rng() < 0.25 ? 2.6 : 1.6,
        speed,
        kind: "snake",
        hue: randInt(rng, 85, 155),
      });
    }
  } else {
    const dir = rng() < 0.5 ? 1 : -1;
    const speed = dir * rand(rng, 1.4, 3.0) * (1 + index * 0.003);
    const count = randInt(rng, 2, 3);
    const spacing = COLS / count + rand(rng, 1.5, 3.5);
    for (let i = 0; i < count; i++) {
      lane.obstacles.push({ x: i * spacing + rand(rng, -0.5, 0.5), width: rand(rng, 2.2, 3.8), speed, kind: "log", hue: 0 });
    }
  }
  if (index >= 1 && (type === "grass" || type === "trail")) {
    const n = type === "grass" ? randInt(rng, 2, 3) : randInt(rng, 1, 2);
    for (let i = 0; i < n; i++) {
      const c = randInt(rng, 0, COLS - 1);
      if (!lane.trees.includes(c) && !lane.coins.includes(c)) lane.coins.push(c);
    }
  }
  return lane;
}

export function createCrossingSim(rng: Rng): CrossingSim {
  const lanes: Lane[] = [];
  for (let i = -LANES_BEHIND; i < LANES_AHEAD; i++) lanes.push(makeLane(rng, i));
  return {
    tick: 0,
    lanes,
    player: { x: PLAYER_COL, y: 0, px: PLAYER_COL, py: 0, hopT: 1, facing: 1 },
    score: 0,
    dead: false,
    deathCause: "",
    onLog: null,
    logOffset: 0,
  };
}

function kill(s: CrossingSim, ev: CrossingEvents, cause: "snake" | "water") {
  if (s.dead) return;
  s.dead = true;
  s.deathCause = cause;
  ev.died = cause;
}

/** Advances one fixed tick, mutating `s`. `dir` is the hop requested this tick (or null). */
export function stepCrossing(s: CrossingSim, rng: Rng, dir: number | null): CrossingEvents {
  const ev: CrossingEvents = { hop: null, coin: null, died: "" };
  if (s.dead) return ev;
  s.tick += 1;
  const dt = TICK_DT;

  // --- input: one hop per press, only when the previous hop has landed ---
  if (dir !== null && s.player.hopT >= 1) {
    const [dx, dy] = DIRS[dir] ?? [0, 0];
    const nx = Math.round(s.player.x + dx);
    const ny = s.player.y + dy;
    const lane = s.lanes.find((l) => l.index === ny);
    const blocked = nx < 0 || nx >= COLS || (lane?.type === "grass" && lane.trees.includes(nx));
    if (!blocked && (dx !== 0 || dy !== 0)) {
      s.player.px = s.player.x;
      s.player.py = s.player.y;
      s.player.x = nx;
      s.player.y = ny;
      s.player.hopT = 0;
      s.onLog = null;
      if (dx !== 0) s.player.facing = dx;
      ev.hop = { x: nx, y: ny, dx, dy };
      if (lane) {
        const ci = lane.coins.indexOf(nx);
        if (ci >= 0) {
          lane.coins.splice(ci, 1);
          s.score += 1;
          ev.coin = { x: nx, y: ny };
        }
      }
    }
  }

  s.player.hopT = Math.min(1, s.player.hopT + dt / HOP_TIME);

  const maxLane = s.lanes[s.lanes.length - 1]?.index ?? 0;
  if (s.player.y + LANES_AHEAD > maxLane) {
    for (let i = maxLane + 1; i <= s.player.y + LANES_AHEAD; i++) s.lanes.push(makeLane(rng, i));
  }
  while (s.lanes.length && s.lanes[0]!.index < s.player.y - LANES_BEHIND - 4) s.lanes.shift();

  for (const lane of s.lanes) {
    for (const ob of lane.obstacles) {
      ob.x += ob.speed * dt;
      const half = ob.width / 2;
      let shift = 0;
      if (ob.speed > 0 && ob.x - half > COLS) shift = -(COLS + ob.width);
      if (ob.speed < 0 && ob.x + half < 0) shift = COLS + ob.width;
      if (shift !== 0) {
        ob.x += shift;
        if (s.onLog === ob) {
          s.player.x += shift;
          s.player.px += shift;
        }
      }
    }
  }

  const lane = s.lanes.find((l) => l.index === s.player.y);
  if (lane) {
    if (lane.type === "trail") {
      for (const ob of lane.obstacles) {
        const overlap =
          Math.min(s.player.x + PLAYER_HALF, ob.x + ob.width / 2) - Math.max(s.player.x - PLAYER_HALF, ob.x - ob.width / 2);
        if (overlap > 0.06) kill(s, ev, "snake");
      }
      s.onLog = null;
    } else if (lane.type === "river") {
      let riding: Obstacle | null = s.onLog && lane.obstacles.includes(s.onLog) ? s.onLog : null;
      if (!riding) {
        for (const ob of lane.obstacles) {
          if (s.player.x > ob.x - ob.width / 2 - 0.3 && s.player.x < ob.x + ob.width / 2 + 0.3) {
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
        kill(s, ev, "water");
      }
    } else {
      s.onLog = null;
    }
  }

  if (s.onLog && !s.dead) {
    s.player.x = s.onLog.x + s.logOffset;
    if (s.player.hopT >= 1) s.player.px = s.player.x;
  }
  return ev;
}

/** Inputs are encoded as `tick * 4 + dir`. */
export function encodeCrossingInput(tick: number, dir: number) {
  return tick * 4 + dir;
}

export function simulateCrossingRun(seed: number, inputs: ReadonlyArray<number>, maxTicks: number = MAX_TICKS) {
  const rng = createRng(seed);
  const byTick = new Map<number, number>();
  for (const code of inputs) {
    const t = Math.floor(code / 4);
    if (!byTick.has(t)) byTick.set(t, code % 4);
  }
  const s = createCrossingSim(rng);
  for (let t = 0; t < maxTicks && !s.dead; t++) stepCrossing(s, rng, byTick.get(t) ?? null);
  return { score: s.score, ticks: s.tick, died: s.dead };
}
