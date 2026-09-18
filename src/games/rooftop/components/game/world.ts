export type ObstacleKind = "crate" | "slide" | "pace" | "barrier" | "pillar";

export type Obstacle = {
  id: number;
  kind: ObstacleKind;
  /** base position (centre of movement) */
  x: number;
  z: number;
  /** box dimensions */
  w: number;
  h: number;
  d: number;
  /** movement */
  range: number;
  speed: number;
  phase: number;
};

export type Coin = {
  id: number;
  x: number;
  y: number;
  z: number;
};

export type Platform = {
  id: number;
  x: number;
  z: number;
  len: number;
  w: number;
  top: number;
  tint: number;
  obstacles: Obstacle[];
  coins: Coin[];
};

let nextId = 1;
let nextObs = 1;
let nextCoin = 1;

export const START_PLATFORM: Platform = {
  id: 0,
  x: 0,
  z: -10,
  len: 46,
  w: 14,
  top: 0,
  tint: 0.5,
  obstacles: [],
  coins: [],
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Difficulty ramps from 0 (start) to 1 (hard) over ~1700 units of distance. */
export const difficultyAt = (distance: number) => Math.min(1, Math.max(0, distance) / 1700);

export const speedAt = (distance: number) => 15 + difficultyAt(distance) * 20;

/**
 * Time-based speed boost: every 3 seconds of a run the pace steps up by 5%,
 * capped at +70% (reached after 42 seconds).
 */
export const timeBoostAt = (seconds: number) =>
  1 + Math.min(0.7, Math.floor(Math.max(0, seconds) / 3) * 0.05);

/** Analytic position of an obstacle at time t — shared by render and collision. */
export function obstaclePos(o: Obstacle, t: number): [number, number] {
  if (o.range === 0) return [o.x, o.z];
  const s = Math.sin(t * o.speed + o.phase) * o.range;
  return o.kind === "pace" ? [o.x, o.z + s] : [o.x + s, o.z];
}

function makeObstacle(p: Platform, kind: ObstacleKind, z: number, d: number): Obstacle {
  const base = { id: nextObs++, kind, x: p.x, z, phase: Math.random() * Math.PI * 2 };
  switch (kind) {
    case "crate":
      return {
        ...base,
        x: p.x + rand(-1, 1) * (p.w / 2 - 1.8),
        w: rand(1.8, 2.8),
        h: rand(1.2, 1.8),
        d: rand(1.2, 2.2),
        range: 0,
        speed: 0,
      };
    case "barrier":
      // Spans most of the roof, low enough to clear with a jump.
      return { ...base, w: p.w * 0.78, h: 0.95, d: 0.9, range: 0, speed: 0 };
    case "pillar":
      // Tall and narrow — must be dodged sideways.
      return {
        ...base,
        x: p.x + rand(-1, 1) * (p.w / 2 - 1.2),
        w: 1.5,
        h: 3.4,
        d: 1.5,
        range: 0,
        speed: 0,
      };
    case "pace":
      return {
        ...base,
        w: 2.4,
        h: 1.5,
        d: 1.2,
        range: Math.min(5, p.len * 0.2),
        speed: rand(0.9, 1.4) + d * 1.5,
      };
    case "slide":
    default:
      return {
        ...base,
        w: 2.6,
        h: 1.5,
        d: 1.1,
        range: p.w / 2 - 1.4,
        speed: rand(0.9, 1.4) + d * 1.6,
      };
  }
}

/** Horizontal distance covered by one jump at the current running speed. */
const AIR_TIME = (2 * 14.2) / 34;
export const jumpLengthAt = (d: number) => AIR_TIME * (15 + d * 20);

function pickKind(d: number, barrierAllowed: boolean): ObstacleKind {
  const r = Math.random();
  if (d < 0.18) return r < 0.6 ? "crate" : "slide";
  if (d < 0.45) {
    if (r < 0.3) return "crate";
    if (r < 0.55) return "slide";
    if (r < 0.8) return barrierAllowed ? "barrier" : "crate";
    return "pace";
  }
  if (r < 0.2) return "crate";
  if (r < 0.45) return "slide";
  if (r < 0.65) return barrierAllowed ? "barrier" : "pillar";
  if (r < 0.85) return "pillar";
  return "pace";
}

function makeObstacles(p: Platform, d: number): Obstacle[] {
  if (d < 0.02) return [];
  const roll = Math.random();
  const count = roll < 0.22 ? 0 : roll < 0.62 + d * 0.15 ? 1 : d > 0.4 ? 2 : 1;
  const out: Obstacle[] = [];

  const jump = jumpLengthAt(d);
  // Keep the landing zone and the take-off edge clear.
  const from = p.z + 5;
  const to = p.z + p.len - 4;
  if (to <= from) return out;

  // A full-width barrier must be jumped, so the roof needs a real landing
  // strip behind it — otherwise the jump carries the player into the gap.
  const barrierLatest = p.z + p.len - (jump + 3);
  const barrierWindow = barrierLatest - (p.z + 6);

  let cursor = from;
  for (let i = 0; i < count; i++) {
    if (cursor > to) break;
    const remaining = to - cursor;
    const barrierAllowed = barrierWindow > 1 && cursor <= barrierLatest && remaining > jump + 3;
    const kind = pickKind(d, barrierAllowed);
    const maxZ = kind === "barrier" ? Math.min(to, barrierLatest) : to;
    if (maxZ < cursor) break;
    const z = rand(cursor, Math.min(maxZ, cursor + Math.max(1, (to - cursor) * 0.6)));
    out.push(makeObstacle(p, kind, z, d));
    // Leave enough room after each obstacle to land and react to the next one.
    cursor = z + (kind === "barrier" ? jump + 3 : 6);
  }
  return out;
}

function makeCoins(p: Platform, prev: Platform): Coin[] {
  const out: Coin[] = [];
  // Arc of coins floating over the gap — rewards a well-timed jump.
  const gapStart = prev.z + prev.len;
  const gapLen = p.z - gapStart;
  if (gapLen > 2) {
    const n = Math.max(3, Math.round(gapLen / 2.6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      out.push({
        id: nextCoin++,
        x: prev.x + (p.x - prev.x) * t,
        y:
          Math.max(prev.top, p.top) +
          1.5 +
          Math.sin(t * Math.PI) * 1.6,
        z: gapStart + gapLen * t,
      });
    }
  }
  // A short run of coins along the roof.
  if (Math.random() < 0.75 && p.len > 12) {
    const n = 3 + Math.floor(Math.random() * 3);
    const laneX = p.x + rand(-1, 1) * (p.w / 2 - 2);
    const startZ = p.z + 4 + Math.random() * Math.max(1, p.len - 12);
    for (let i = 0; i < n; i++) {
      out.push({ id: nextCoin++, x: laneX, y: p.top + 1.2, z: startZ + i * 2.4 });
    }
  }
  return out;
}

export function makeNext(prev: Platform, distance: number): Platform {
  const d = difficultyAt(distance);
  // Every rooftop is separated by a real jump — never walkable.
  // Always a real jump, but never longer than the jump the player can make.
  const maxGap = jumpLengthAt(d) * 0.72;
  const gap = Math.min(maxGap, rand(8 + d * 4, 12 + d * 7));
  const len = rand(22 - d * 6, 32 - d * 10);
  const w = rand(11 - d * 3.5, 16 - d * 5);
  const x = Math.max(-11, Math.min(11, prev.x + rand(-4 - d * 5, 4 + d * 5)));
  const top = Math.max(0, Math.min(9, prev.top + rand(-2 - d, 2 + d)));
  const p: Platform = {
    id: nextId++,
    x,
    z: prev.z + prev.len + gap,
    len,
    w,
    top,
    tint: Math.random(),
    obstacles: [],
    coins: [],
  };
  p.obstacles = makeObstacles(p, d);
  p.coins = makeCoins(p, prev);
  return p;
}

export function resetIds() {
  nextId = 1;
  nextObs = 1;
  nextCoin = 1;
}
