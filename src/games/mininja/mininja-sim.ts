/**
 * Deterministic, render-free simulation core for Nimiq Mininja.
 * Runs identically in the browser and on the server (for score verification).
 * Never read Math.random / Date.now here — only the seeded rng and inputs.
 */
import { createRng } from "@/games/tappy/tappy-sim";

export { createRng };

export const VIEW = 1600;
export const GROUND = 1160;
export const PLAYER_X = 210;
export const PLAYER_W = 60;
export const PLAYER_H = 82;
export const GRAVITY = 2200;
export const JUMP_FORCE = -820;
export const START_SPEED = 664;

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;
export const MAX_TICKS = TICK_RATE * 60 * 20;

export type EntityKind = "crate" | "barrier" | "laser" | "spikes" | "grunt" | "drone" | "saw" | "tower" | "bat";

export type Entity = {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  w: number;
  h: number;
  dead?: boolean;
  age: number;
  attacking?: boolean;
  baseY?: number;
};

export interface MininjaSim {
  tick: number;
  over: boolean;
  y: number;
  vy: number;
  grounded: boolean;
  slash: number;
  hurt: number;
  score: number;
  kills: number;
  speed: number;
  distance: number;
  activeTime: number;
  spawnIn: number;
  entities: Entity[];
  nextId: number;
  cityOffset: number;
}

export interface MininjaEvents {
  jumped: boolean;
  slashed: boolean;
  kills: { x: number; y: number }[];
  died: boolean;
}

type Rng = () => number;

export function createMininjaSim(): MininjaSim {
  return {
    tick: 0,
    over: false,
    y: GROUND - PLAYER_H,
    vy: 0,
    grounded: true,
    slash: 0,
    hurt: 0,
    score: 0,
    kills: 0,
    speed: START_SPEED,
    distance: 0,
    activeTime: 0,
    spawnIn: 1.35,
    entities: [],
    nextId: 1,
    cityOffset: 0,
  };
}

function intersects(ax: number, ay: number, aw: number, ah: number, b: Entity) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

function spawn(g: MininjaSim, rng: Rng) {
  const difficulty = Math.min(1, g.activeTime / 90);
  const roll = rng();
  let kind: EntityKind;
  if (roll < 0.2) kind = "crate";
  else if (roll < 0.34) kind = "barrier";
  else if (roll < 0.5) kind = "spikes";
  else if (roll < 0.6) kind = difficulty > 0.08 ? "laser" : "crate";
  else if (roll < 0.68) kind = difficulty > 0.08 ? "tower" : "barrier";
  else if (roll < 0.72) kind = difficulty > 0.14 ? "saw" : "spikes";
  else if (roll < 0.8) kind = difficulty > 0.1 ? "bat" : "spikes";
  else if (roll < 0.9) kind = "grunt";
  else kind = "drone";

  const specs: Record<EntityKind, [number, number, number]> = {
    crate: [60, 116, GROUND - 116],
    barrier: [45, 108, GROUND - 108],
    spikes: [76, 36, GROUND - 36],
    laser: [88, 28, GROUND - 28],
    grunt: [62, 72, GROUND - 72],
    drone: [72, 48, GROUND - 155],
    tower: [60, 120, GROUND - 120],
    saw: [56, 56, GROUND - 150],
    bat: [52, 44, GROUND - 135],
  };
  const [w, h, y] = specs[kind];
  g.entities.push({ id: g.nextId++, kind, x: VIEW + 25, y, w, h, age: 0, baseY: y });
  const tall = kind === "barrier" || kind === "tower" || kind === "crate";
  const airtime = (2 * -JUMP_FORCE) / GRAVITY;
  const guaranteed = Math.max(g.speed * 0.3, g.speed * (airtime + (tall ? 0.18 : 0.03)) - w + 30);
  const desired = g.speed * (0.44 + (1 - difficulty) * 0.1);
  const recoveryDistance = Math.max(guaranteed, desired);
  const clearDistance = w + recoveryDistance + 12;
  const variationDistance = (10 + rng() * 58) * (1 - difficulty * 0.8);
  g.spawnIn = (clearDistance + variationDistance) / g.speed;
}

/** Advances one fixed tick, mutating `g`. */
export function stepMininja(g: MininjaSim, rng: Rng, jump: boolean, slash: boolean): MininjaEvents {
  const ev: MininjaEvents = { jumped: false, slashed: false, kills: [], died: false };
  if (g.over) return ev;
  g.tick += 1;
  const dt = TICK_DT;

  if (jump && g.grounded) {
    g.vy = JUMP_FORCE;
    g.grounded = false;
    ev.jumped = true;
  }
  if (slash && g.slash <= 0.05) {
    g.slash = 0.28;
    ev.slashed = true;
  }

  g.activeTime += dt;
  g.speed = START_SPEED * Math.min(2.8, 1 + Math.floor(g.activeTime / 2.4) * 0.3);
  g.distance += g.speed * dt;
  g.cityOffset += g.speed * dt;
  g.score += dt * (12 + g.speed / 40);
  g.spawnIn -= dt;
  if (g.spawnIn <= 0) spawn(g, rng);
  if (!g.grounded) {
    g.vy += GRAVITY * dt;
    g.y += g.vy * dt;
    if (g.y >= GROUND - PLAYER_H) {
      g.y = GROUND - PLAYER_H;
      g.vy = 0;
      g.grounded = true;
    }
  }
  g.slash = Math.max(0, g.slash - dt);
  g.hurt = Math.max(0, g.hurt - dt);

  for (const e of g.entities) {
    e.x -= g.speed * dt;
    e.age += dt;
    if (e.kind === "saw" && e.baseY !== undefined) {
      e.y = e.baseY + Math.sin(e.age * 3.1) * 42;
      e.x -= 40 * dt;
    }
    if (e.kind === "bat" && e.baseY !== undefined) {
      e.y = e.baseY + Math.sin(e.age * 4.2) * 14;
      e.x -= 30 * dt;
    }
    if (e.kind === "grunt" || e.kind === "drone") {
      const closingIn = e.x < 510 && e.x > PLAYER_X + 45;
      e.attacking = e.x < 330;
      if (closingIn) e.x -= (e.kind === "grunt" ? 105 : 78) * dt;
      if (e.kind === "drone") {
        const targetY = e.attacking ? g.y + 12 : GROUND - 155;
        e.y += (targetY - e.y) * Math.min(1, dt * 3.4);
      }
    }
    if ((e.kind === "grunt" || e.kind === "drone") && g.slash > 0 && !e.dead) {
      if (intersects(PLAYER_X + 35, g.y - 10, 115, PLAYER_H + 28, e)) {
        e.dead = true;
        g.kills += 1;
        g.score += 75;
        ev.kills.push({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
      }
    }
    if (!g.over && !e.dead && intersects(PLAYER_X + 9, g.y + 8, PLAYER_W - 18, PLAYER_H - 8, e)) {
      g.over = true;
      g.hurt = 0.6;
      ev.died = true;
    }
  }
  g.entities = g.entities.filter((e) => e.x + e.w > -30 && !e.dead);
  return ev;
}

/** Inputs are encoded as `tick * 2 + action` (0 = jump, 1 = slash). */
export function encodeMininjaInput(tick: number, action: 0 | 1) {
  return tick * 2 + action;
}

export function finalMininjaScore(g: MininjaSim) {
  return Math.floor(g.score);
}

export function simulateMininjaRun(seed: number, inputs: ReadonlyArray<number>, maxTicks: number = MAX_TICKS) {
  const rng = createRng(seed);
  const set = new Set(inputs);
  const g = createMininjaSim();
  for (let t = 0; t < maxTicks && !g.over; t++) stepMininja(g, rng, set.has(t * 2), set.has(t * 2 + 1));
  return { score: finalMininjaScore(g), ticks: g.tick, died: g.over };
}
