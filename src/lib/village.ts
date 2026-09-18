import type { TierId } from "./tiers";

export const WORLD_W = 1800;
export const WORLD_H = 1400;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HouseSpot {
  x: number;
  y: number;
  tier: TierId;
  owner: string;
  mine?: boolean;
}

export interface Neighbor {
  x: number;
  y: number;
  name: string;
  address: string;
  hue: number;
}

export interface Tree {
  x: number;
  y: number;
  r: number;
  seed: number;
}

export interface Lantern {
  x: number;
  y: number;
}

export const POND: { x: number; y: number; rx: number; ry: number } = {
  x: 1320,
  y: 980,
  rx: 250,
  ry: 150,
};

export const NEIGHBOR_HOUSES: HouseSpot[] = [
  { x: 340, y: 320, tier: "normal", owner: "Mira" },
  { x: 700, y: 250, tier: "cool", owner: "Bima" },
  { x: 1120, y: 320, tier: "poor", owner: "Pak Tono" },
  { x: 1520, y: 420, tier: "sultan", owner: "Ratu Ayu" },
  { x: 380, y: 1050, tier: "normal", owner: "Sari" },
  { x: 760, y: 1130, tier: "poor", owner: "Joko" },
];

export const PLAYER_HOUSE: { x: number; y: number } = { x: 1180, y: 1150 };

export const NEIGHBORS: Neighbor[] = [
  {
    x: 620,
    y: 620,
    name: "Mira the Weaver",
    address: "NQ07 0000 0000 0000 0000 0000 0000 0000 0000",
    hue: 340,
  },
  {
    x: 1240,
    y: 700,
    name: "Bima the Farmer",
    address: "NQ07 0000 0000 0000 0000 0000 0000 0000 0000",
    hue: 200,
  },
  {
    x: 500,
    y: 900,
    name: "Pak Tono",
    address: "NQ07 0000 0000 0000 0000 0000 0000 0000 0000",
    hue: 30,
  },
];

/** Deterministic pseudo-random so server and client agree. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildTrees(): Tree[] {
  const rand = rng(20260914);
  const trees: Tree[] = [];
  for (let i = 0; i < 90; i++) {
    const x = 60 + rand() * (WORLD_W - 120);
    const y = 60 + rand() * (WORLD_H - 120);
    const nearPond =
      ((x - POND.x) / (POND.rx + 70)) ** 2 + ((y - POND.y) / (POND.ry + 70)) ** 2 < 1;
    const nearHouse = [...NEIGHBOR_HOUSES, { ...PLAYER_HOUSE }].some(
      (h) => Math.abs(h.x - x) < 190 && Math.abs(h.y - y) < 170,
    );
    const onPlaza = Math.hypot(x - 900, y - 700) < 230;
    if (nearPond || nearHouse || onPlaza) continue;
    trees.push({ x, y, r: 26 + rand() * 16, seed: rand() * 100 });
  }
  return trees;
}

export const LANTERNS: Lantern[] = [
  { x: 760, y: 560 },
  { x: 1040, y: 560 },
  { x: 760, y: 860 },
  { x: 1040, y: 860 },
  { x: 300, y: 700 },
  { x: 1560, y: 760 },
];

/** Blocking rectangles: houses, pond box, world edges handled separately. */
export function buildColliders(): Rect[] {
  const rects: Rect[] = [];
  for (const h of [...NEIGHBOR_HOUSES, { ...PLAYER_HOUSE, tier: "poor", owner: "you" }]) {
    rects.push({ x: h.x - 70, y: h.y - 40, w: 140, h: 90 });
  }
  return rects;
}

export function circleBlocked(x: number, y: number, radius: number, rects: Rect[]): boolean {
  if (x < radius || y < radius || x > WORLD_W - radius || y > WORLD_H - radius) return true;
  for (const r of rects) {
    if (x + radius > r.x && x - radius < r.x + r.w && y + radius > r.y && y - radius < r.y + r.h)
      return true;
  }
  const px = (x - POND.x) / POND.rx;
  const py = (y - POND.y) / POND.ry;
  if (px * px + py * py < 1) return true;
  return false;
}
