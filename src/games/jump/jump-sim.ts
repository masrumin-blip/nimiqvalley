/**
 * Deterministic, render-free simulation core for Jump for Nimiq.
 * Runs identically in the browser and on the server (for score verification).
 * Never read Math.random / Date.now / performance.now here.
 * One tick = one 60 Hz frame (the old frame-based "factor" is always 1).
 */
import { createRng } from "@/games/tappy/tappy-sim";

export { createRng };

export const W = 400;
export const H = 720;
const GRAVITY = 0.35;
export const JUMP_V = -11.5;
const SPRING_V = -25;
export const MOVE_SPEED = 4.7;
const PLAYER_Y = H * 0.66;

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_TICKS = TICK_RATE * 60 * 20;

export type PlatformType = "normal" | "moving" | "vertical" | "break" | "spike" | "spring" | "phase" | "conveyor" | "electric";
export type ItemType = "coin" | "shield" | "magnet" | "jetpack" | "slow" | "multiplier" | "life";
export type HazardType = "drone" | "mine" | "saw" | "hunter";

export interface Platform { id: number; x: number; y: number; originY: number; w: number; h: number; type: PlatformType; vx: number; vy: number; broken: boolean; timer: number; phase: number }
export interface Item { id: number; x: number; y: number; type: ItemType; collected: boolean; phase: number }
export interface Hazard { id: number; x: number; y: number; originX: number; r: number; vx: number; range: number; type: HazardType; alive: boolean; phase: number }
export interface Laser { id: number; y: number; gapX: number; gapW: number; phase: number }
export interface Portal { id: number; x: number; y: number; targetX: number; active: boolean; phase: number }
export interface Buffs { shield: number; magnet: number; jetpack: number; slow: number; multiplier: number; lives: number }

export interface JumpSim {
  tick: number;
  /** Simulated milliseconds (drives laser cycles). */
  clock: number;
  over: boolean;
  nextId: number;
  px: number; py: number; vx: number; vy: number; cameraY: number;
  platforms: Platform[]; items: Item[]; hazards: Hazard[]; lasers: Laser[]; portals: Portal[];
  score: number; coins: number;
  buffs: Buffs;
  shake: number; flash: number; invulnerable: number; portalCooldown: number;
}

export type FxColor = "cyan" | "pink" | "red" | "yellow" | "purple" | ItemType;
export interface JumpEvents {
  sfx: [string, number | undefined][];
  bursts: [number, number, FxColor, number, number][];
  jet: boolean;
  died: boolean;
}

type Rng = () => number;

function makePlatform(s: JumpSim, rng: Rng, y: number, difficulty: number, safe = false): Platform {
  const roll = rng();
  let type: PlatformType = "normal";
  if (!safe) {
    if (difficulty > 0.6 && roll < 0.08) type = "phase";
    else if (difficulty > 0.45 && roll < 0.16) type = "vertical";
    else if (difficulty > 0.72 && roll < 0.14) type = "electric";
    else if (difficulty > 0.52 && roll < 0.22) type = "conveyor";
    else if (difficulty > 0.16 && roll < 0.32) type = "moving";
    else if (difficulty > 0.25 && roll < 0.43) type = "break";
    else if (difficulty > 0.35 && roll < 0.51) type = "spike";
    else if (roll > 0.91) type = "spring";
  }
  const width = type === "spring" ? 58 : 66 + rng() * 26;
  const x = 8 + rng() * (W - width - 16);
  const vx = type === "moving" || type === "conveyor" ? (rng() < 0.5 ? -1 : 1) * (1.1 + difficulty * 1.7) : 0;
  return {
    id: s.nextId++, x, y, originY: y, w: width, h: type === "spring" ? 15 : 12, type, vx,
    vy: type === "vertical" ? 0.8 + difficulty : 0, broken: false, timer: 0, phase: rng() * Math.PI * 2,
  };
}

export function createJumpSim(rng: Rng): JumpSim {
  const s: JumpSim = {
    tick: 0, clock: 0, over: false, nextId: 1,
    px: W / 2, py: H - 120, vx: 0, vy: JUMP_V, cameraY: 0,
    platforms: [], items: [], hazards: [], lasers: [], portals: [],
    score: 0, coins: 0,
    buffs: { shield: 0, magnet: 0, jetpack: 0, slow: 0, multiplier: 0, lives: 0 },
    shake: 0, flash: 0, invulnerable: 0, portalCooldown: 0,
  };
  s.platforms.push({ ...makePlatform(s, rng, H - 60, 0, true), x: W / 2 - 48, w: 96 });
  let y = H - 145;
  let count = 0;
  while (y > -700) {
    const p = makePlatform(s, rng, y, Math.min(0.18, count / 50), count < 4);
    s.platforms.push(p);
    if (rng() < 0.62) s.items.push({ id: s.nextId++, x: p.x + p.w / 2, y: y - 34, type: "coin", collected: false, phase: rng() * 6 });
    y -= 72 + rng() * 30;
    count++;
  }
  return s;
}

/** dir: 0 none, 1 left, 2 right. Mutates `w`. */
export function stepJump(w: JumpSim, rng: Rng, dir: number): JumpEvents {
  const ev: JumpEvents = { sfx: [], bursts: [], jet: false, died: false };
  if (w.over) return ev;
  w.tick += 1;
  w.clock += TICK_MS;
  const factor = 1;
  const burst = (x: number, y: number, c: FxColor, n: number, f = 3.5) => ev.bursts.push([x, y, c, n, f]);
  const sfx = (name: string, vol?: number) => ev.sfx.push([name, vol]);

  const damage = () => {
    if (w.invulnerable > 0) return false;
    sfx("collision");
    if (w.buffs.jetpack > 0) { w.invulnerable = 24; w.shake = 5; w.flash = 6; burst(w.px, w.py, "cyan", 16, 4); return false; }
    if (w.buffs.shield > 0) { w.buffs.shield = 0; w.invulnerable = 90; w.shake = 10; w.flash = 12; burst(w.px, w.py, "cyan", 28, 5); return false; }
    if (w.buffs.lives > 0) {
      w.buffs.lives -= 1; w.invulnerable = 120; w.vy = SPRING_V * 0.72; w.py -= 34; w.shake = 12; w.flash = 16;
      burst(w.px, w.py, "pink", 32, 5); return false;
    }
    w.over = true; ev.died = true; sfx("gameover");
    return true;
  };

  const addItem = (p: Platform) => {
    if (p.type === "spike") return;
    const roll = rng();
    let type: ItemType = "coin";
    if (roll > 0.985) type = "life";
    else if (roll > 0.94) type = "jetpack";
    else if (roll > 0.9) type = "shield";
    else if (roll > 0.86) type = "magnet";
    else if (roll > 0.82) type = "slow";
    else if (roll > 0.77) type = "multiplier";
    w.items.push({ id: w.nextId++, x: p.x + p.w / 2, y: p.y - 34, type, collected: false, phase: rng() * 6 });
  };

  const spawnUpward = (difficulty: number) => {
    let topY = Math.min(...w.platforms.map((p) => p.y));
    while (topY > w.cameraY - 240) {
      topY -= 70 + rng() * (28 + difficulty * 24);
      const p = makePlatform(w, rng, topY, difficulty);
      w.platforms.push(p);
      if (rng() < 0.68) addItem(p);
      if (difficulty > 0.12 && rng() < 0.14 + difficulty * 0.15) {
        const x = 34 + rng() * (W - 68);
        const hr = rng();
        const type: HazardType = difficulty > 0.7 && hr < 0.2 ? "hunter" : difficulty > 0.42 && hr < 0.46 ? "saw" : hr < 0.68 ? "mine" : "drone";
        const vx = (rng() < 0.5 ? -1 : 1) * (1.1 + difficulty * 1.5);
        const range = 42 + rng() * 65;
        w.hazards.push({ id: w.nextId++, x, y: topY - 58, originX: x, r: type === "saw" ? 15 : 13, vx, range, type, alive: true, phase: rng() * 6 });
      }
      if (difficulty > 0.42 && rng() < 0.045 + difficulty * 0.035) {
        const gapX = 75 + rng() * 250;
        w.lasers.push({ id: w.nextId++, y: topY - 42, gapX, gapW: 88, phase: rng() * 240 });
      }
      if (difficulty > 0.52 && rng() < 0.035) {
        const x = 42 + rng() * (W - 84);
        const targetX = 42 + rng() * (W - 84);
        w.portals.push({ id: w.nextId++, x, y: topY - 46, targetX, active: true, phase: rng() * 6 });
      }
    }
  };

  const collect = (item: Item) => {
    item.collected = true;
    const mult = w.buffs.multiplier > 0 ? 2 : 1;
    if (item.type === "coin") { w.coins += 1; w.score += 25 * mult; sfx("coin", 0.5); }
    else sfx("powerup");
    if (item.type === "shield") w.buffs.shield = 1;
    if (item.type === "magnet") w.buffs.magnet = 600;
    if (item.type === "jetpack") { w.buffs.jetpack = 120; w.vy = -16; }
    if (item.type === "slow") w.buffs.slow = 520;
    if (item.type === "multiplier") w.buffs.multiplier = 600;
    if (item.type === "life") w.buffs.lives = Math.min(2, w.buffs.lives + 1);
    burst(item.x, item.y, item.type, item.type === "coin" ? 14 : 25, item.type === "coin" ? 3 : 5);
  };

  const slowFactor = w.buffs.slow > 0 ? 0.55 : 1;
  const target = (dir === 2 ? MOVE_SPEED : 0) - (dir === 1 ? MOVE_SPEED : 0);
  w.vx += (target - w.vx) * 0.22 * factor;
  if (w.buffs.jetpack > 0) { w.vy = Math.max(-17, w.vy - 0.36 * factor); ev.jet = true; }
  else w.vy += GRAVITY * factor;
  w.py += w.vy * factor; w.px += w.vx * factor;
  if (w.px < -16) w.px = W + 16;
  if (w.px > W + 16) w.px = -16;
  if (w.py - w.cameraY < PLAYER_Y) w.cameraY = w.py - PLAYER_Y;
  const altitude = Math.max(0, -w.cameraY);
  const difficulty = Math.min(1, altitude / 10500);
  w.score = Math.max(w.score, Math.floor(altitude / 9));

  for (const key of ["magnet", "jetpack", "slow", "multiplier"] as const) w.buffs[key] = Math.max(0, w.buffs[key] - factor);
  w.invulnerable = Math.max(0, w.invulnerable - factor); w.portalCooldown = Math.max(0, w.portalCooldown - factor);
  w.shake *= 0.88; w.flash = Math.max(0, w.flash - factor);

  for (const p of w.platforms) {
    if (p.type === "moving") { p.x += p.vx * slowFactor * factor; if (p.x < 4 || p.x + p.w > W - 4) p.vx *= -1; }
    if (p.type === "vertical") { p.timer += 0.025 * slowFactor * factor; p.y = p.originY + Math.sin(p.timer + p.phase) * 34; }
    if (p.type === "break" && p.broken) { p.timer += factor; p.y += p.timer * 0.035 * factor; }
    if (p.type === "phase") p.timer += 0.025 * slowFactor * factor;
    if (p.type === "electric") p.timer += 0.035 * slowFactor * factor;
  }

  if (w.vy > 0) {
    for (const p of w.platforms) {
      const phaseVisible = p.type !== "phase" || Math.sin(p.timer + p.phase) > -0.18;
      if (p.broken || !phaseVisible) continue;
      const previousBottom = w.py - w.vy * factor + 16;
      const bottom = w.py + 16;
      if (w.px + 12 > p.x && w.px - 12 < p.x + p.w && previousBottom <= p.y && bottom >= p.y && bottom <= p.y + p.h + 15) {
        if (p.type === "spike" || (p.type === "electric" && Math.sin(p.timer + p.phase) > -0.15)) { if (damage()) return ev; w.vy = JUMP_V; }
        else if (p.type === "spring") { w.vy = SPRING_V; w.shake = 7; burst(w.px, p.y, "yellow", 22, 5); sfx("jump", 1); }
        else { w.vy = JUMP_V; if (p.type === "conveyor") w.vx += Math.sign(p.vx) * 4.5; burst(w.px, p.y, p.type === "break" ? "red" : "cyan", 8); if (p.type === "break") p.broken = true; sfx("land", 0.5); }
        break;
      }
    }
  }

  for (const item of w.items) {
    if (item.collected) continue;
    let dx = w.px - item.x, dy = w.py - item.y;
    if (w.buffs.magnet > 0 && dx * dx + dy * dy < 145 * 145) { item.x += dx * 0.1 * factor; item.y += dy * 0.1 * factor; dx = w.px - item.x; dy = w.py - item.y; }
    if (dx * dx + dy * dy < 25 * 25) collect(item);
  }

  for (const hz of w.hazards) {
    if (!hz.alive) continue;
    if (hz.type === "hunter") {
      hz.vx += Math.sign(w.px - hz.x) * 0.025 * slowFactor * factor;
      hz.vx = Math.max(-2.8, Math.min(2.8, hz.vx));
      hz.y += Math.sign(w.py - hz.y) * 0.28 * slowFactor * factor;
    }
    hz.x += hz.vx * slowFactor * factor;
    if (Math.abs(hz.x - hz.originX) > hz.range || hz.x < 20 || hz.x > W - 20) hz.vx *= -1;
    const dx = w.px - hz.x, dy = w.py - hz.y;
    if (dx * dx + dy * dy < (hz.r + 13) ** 2) {
      if (w.vy > 0 && dy < -2) { hz.alive = false; w.vy = JUMP_V; w.score += 75 * (w.buffs.multiplier > 0 ? 2 : 1); burst(hz.x, hz.y, "pink", 24, 5); sfx("score", 0.6); }
      else if (damage()) return ev;
    }
  }

  for (const laser of w.lasers) {
    const cycle = ((w.clock * slowFactor) / 16 + laser.phase) % 240;
    if (cycle > 105 && cycle < 190 && Math.abs(w.py - laser.y) < 13 && Math.abs(w.px - laser.gapX) > laser.gapW / 2) {
      if (damage()) return ev;
    }
  }
  for (const portal of w.portals) {
    if (!portal.active || w.portalCooldown > 0) continue;
    const dx = w.px - portal.x, dy = w.py - portal.y;
    if (dx * dx + dy * dy < 28 * 28) {
      burst(w.px, w.py, "purple", 24, 5); w.px = portal.targetX; w.py -= 75; w.vy = -13; w.portalCooldown = 100;
      burst(w.px, w.py, "cyan", 24, 5); sfx("whoosh", 0.6);
    }
  }

  spawnUpward(difficulty);
  const limit = w.cameraY + H + 160;
  w.platforms = w.platforms.filter((p) => p.y < limit);
  w.items = w.items.filter((i) => i.y < limit && !i.collected);
  w.hazards = w.hazards.filter((h) => h.y < limit && h.alive);
  w.lasers = w.lasers.filter((l) => l.y < limit);
  w.portals = w.portals.filter((p) => p.y < limit);
  if (w.py - w.cameraY > H + 48) damage();
  return ev;
}

/** Inputs are encoded as `tick * 3 + dir`, recorded only when the held direction changes. */
export function encodeJumpInput(tick: number, dir: number) {
  return tick * 3 + dir;
}

export function finalJumpScore(w: JumpSim) {
  return Math.floor(w.score);
}

export function simulateJumpRun(seed: number, inputs: ReadonlyArray<number>, maxTicks: number = MAX_TICKS) {
  const rng = createRng(seed);
  const changes = new Map<number, number>();
  for (const code of inputs) changes.set(Math.floor(code / 3), code % 3);
  const w = createJumpSim(rng);
  let dir = 0;
  for (let t = 0; t < maxTicks && !w.over; t++) {
    const next = changes.get(t);
    if (next !== undefined) dir = next;
    stepJump(w, rng, dir);
  }
  return { score: finalJumpScore(w), ticks: w.tick, died: w.over };
}
