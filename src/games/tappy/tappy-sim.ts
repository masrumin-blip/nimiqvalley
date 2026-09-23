/**
 * Deterministic, render-free simulation core for Nimiq Tappy.
 *
 * This file is the single source of truth for anything that affects the
 * score: physics, obstacle spawning, and collisions. The same code runs
 * live in the browser (driving what the player sees) and headless on the
 * server (to verify a finished run). For that to produce identical results
 * both places, this module must never read anything non-deterministic —
 * no `Date.now()`, no `Math.random()`, no wall-clock time. The only inputs
 * are the seed (via `rng`) and the recorded flap ticks.
 */

// ---- Tunables (logical canvas units, matches the renderer's coordinate space) ----
export const W = 400;
export const H = 640;
export const BIRD_X = 96;
export const BIRD_R = 14;
export const GRAVITY = 1500; // px/s^2
export const FLAP = -430; // px/s
export const TREE_W = 68;
export const GAP = 165;
export const GAP_MIN = 112;
export const SPEED = 170; // px/s
export const SPEED_MAX = 330;
export const SPAWN_EVERY = 1.45; // seconds
export const SPAWN_MIN = 0.95;
export const GROUND_H = 70;

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;

/** Longest run the server will ever replay — about 12 minutes at 60Hz. Anything longer is rejected outright. */
export const MAX_TICKS = TICK_RATE * 60 * 12;

export function levelFor(score: number) {
  return Math.floor(score / 5) + 1;
}

export function difficultyFor(score: number) {
  const t = Math.min(1, score / 50); // full difficulty by score 50
  const e = t * t * (3 - 2 * t); // smoothstep
  return {
    speed: SPEED + (SPEED_MAX - SPEED) * e,
    gap: GAP - (GAP - GAP_MIN) * e,
    spawn: SPAWN_EVERY - (SPAWN_EVERY - SPAWN_MIN) * e,
    wobble: e,
  };
}

/** Seeded PRNG (mulberry32) — same seed always produces the same sequence, on any machine. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimTree {
  x: number;
  gapY: number;
  baseY: number;
  gap: number;
  amp: number;
  phase: number;
  variant: number;
  coinY: number;
  coinCollected: boolean;
}

export interface SimState {
  tick: number;
  birdY: number;
  vel: number;
  trees: SimTree[];
  spawnT: number;
  score: number;
  dead: boolean;
  nextVariant: number;
}

/** Cosmetic-only events a tick produced, so the client can play sfx/particles without affecting the score. */
export interface TickEvents {
  coins: { x: number; y: number }[];
  died: boolean;
}

function randomGapY(rng: () => number, gap: number, amp: number) {
  const margin = 60 + amp;
  const span = H - GROUND_H - gap - margin * 2;
  return margin + gap / 2 + rng() * Math.max(20, span);
}

export function createSimState(rng: () => number): SimState {
  return {
    tick: 0,
    birdY: H / 2,
    vel: FLAP * 0.6,
    trees: [],
    spawnT: 0.9,
    score: 0,
    dead: false,
    nextVariant: Math.floor(rng() * 4),
  };
}

/** Advances the simulation by exactly one fixed tick (1/60s). Returns the next state plus cosmetic events. */
export function stepSim(
  state: SimState,
  rng: () => number,
  flap: boolean,
): { state: SimState; events: TickEvents } {
  const events: TickEvents = { coins: [], died: false };
  if (state.dead) return { state, events };

  const dt = TICK_DT;
  const s: SimState = {
    ...state,
    tick: state.tick + 1,
    trees: state.trees.map((t) => ({ ...t })),
  };
  const d = difficultyFor(s.score);

  if (flap) s.vel = FLAP;
  s.vel += GRAVITY * dt;
  s.birdY += s.vel * dt;

  // spawn
  s.spawnT -= dt;
  if (s.spawnT <= 0) {
    const amp = s.score >= 15 ? d.wobble * 42 : 0;
    const baseY = randomGapY(rng, d.gap, amp);
    s.trees.push({
      x: W + TREE_W,
      gapY: baseY,
      baseY,
      gap: d.gap,
      amp,
      phase: rng() * Math.PI * 2,
      variant: s.nextVariant,
      coinY: baseY + (rng() - 0.5) * Math.min(44, d.gap * 0.28),
      coinCollected: false,
    });
    s.nextVariant = (s.nextVariant + 1 + Math.floor(rng() * 3)) % 4;
    s.spawnT = d.spawn;
  }

  // move + settle wobble
  for (const t of s.trees) {
    t.x -= d.speed * dt;
    t.gapY = t.amp > 0 ? t.baseY + Math.sin(s.tick * dt * 1.6 + t.phase) * t.amp : t.baseY;
    t.coinY = t.gapY;
  }
  s.trees = s.trees.filter((t) => t.x + TREE_W > -20);

  // coins are the only source of score
  for (const t of s.trees) {
    if (t.coinCollected) continue;
    const coinX = t.x + TREE_W / 2;
    const dx = BIRD_X - coinX;
    const dy = s.birdY - t.coinY;
    if (dx * dx + dy * dy < (BIRD_R + 15) * (BIRD_R + 15)) {
      t.coinCollected = true;
      s.score += 1;
      events.coins.push({ x: coinX, y: t.coinY });
    }
  }

  // collisions
  if (s.birdY + BIRD_R >= H - GROUND_H || s.birdY - BIRD_R <= 0) {
    s.dead = true;
  } else {
    for (const t of s.trees) {
      const inX = BIRD_X + BIRD_R > t.x && BIRD_X - BIRD_R < t.x + TREE_W;
      if (inX) {
        const top = t.gapY - t.gap / 2;
        const bottom = t.gapY + t.gap / 2;
        if (s.birdY - BIRD_R < top || s.birdY + BIRD_R > bottom) {
          s.dead = true;
          break;
        }
      }
    }
  }
  if (s.dead) events.died = true;

  return { state: s, events };
}

export interface SimResult {
  score: number;
  ticks: number;
  died: boolean;
}

/**
 * Replays a full run headlessly from just a seed and the ticks a flap
 * happened on. This is what the server calls to compute the *real* score —
 * the client's own claimed score is never trusted.
 */
export function simulateRun(
  seed: number,
  flapTicks: ReadonlyArray<number> | ReadonlySet<number>,
  maxTicks: number = MAX_TICKS,
): SimResult {
  const rng = createRng(seed);
  const flapSet = flapTicks instanceof Set ? flapTicks : new Set(flapTicks);
  let state = createSimState(rng);
  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.dead) break;
    const stepped = stepSim(state, rng, flapSet.has(tick));
    state = stepped.state;
  }
  return { score: state.score, ticks: state.tick, died: state.dead };
}
