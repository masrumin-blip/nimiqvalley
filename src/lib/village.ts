import type { TierId } from "./tiers";

export const WORLD_W = 2600;
export const WORLD_H = 1950;

export interface Rect { x: number; y: number; w: number; h: number }
export interface HouseSpot { x: number; y: number; tier: TierId; owner: string; mine?: boolean }
export interface Neighbor { x: number; y: number; name: string; address: string; hue: number }
export interface Tree { x: number; y: number; scale: number; kind: 0 | 1 | 2; seed: number }
export interface Lantern { x: number; y: number }
export interface BuildingSpot {
  id: string;
  x: number;
  y: number;
  sheet: "a" | "b";
  crop: [number, number, number, number];
  width: number;
  height: number;
  collider: [number, number, number, number];
}
export type AnimalKind = "cow" | "pig" | "sheep" | "chicken" | "frog" | "butterfly";
export interface AnimalSpot { id: string; kind: AnimalKind; x: number; y: number; phase: number; range?: number }
export type NpcSpriteRow = 0 | 1 | 2 | 3 | 4 | 5;
export interface VillageNpc {
  id: string; name: string; x: number; y: number; spriteRow: NpcSpriteRow;
  speed: number; idleMs: number; path: Array<{ x: number; y: number }>;
}
export type SceneryId = "ocean" | "hill" | "aurora" | "sunrise" | "sunset" | "rain";
export type RestSpotKind = "bench" | "gazebo" | "deck" | "picnic" | "campfire" | "swing";
export interface RestSpot {
  id: SceneryId;
  name: string;
  x: number;
  y: number;
  kind: RestSpotKind;
  radius: number;
}

export interface HouseSpriteSpec {
  crop: [number, number, number, number];
  width: number;
  height: number;
  footprint: { width: number; height: number; bottom: number };
}

/** Rendering and solid footprint share one source of truth for every house tier. */
export const HOUSE_SPRITES: Record<TierId, HouseSpriteSpec> = {
  poor: {
    crop: [70, 405, 285, 305],
    width: 128,
    height: 138,
    footprint: { width: 89, height: 42, bottom: 12 },
  },
  normal: {
    crop: [390, 360, 360, 370],
    width: 164,
    height: 168,
    footprint: { width: 149, height: 48, bottom: 12 },
  },
  cool: {
    crop: [65, 805, 525, 610],
    width: 235,
    height: 273,
    footprint: { width: 211, height: 58, bottom: 12 },
  },
  sultan: {
    crop: [620, 775, 550, 675],
    width: 246,
    height: 302,
    footprint: { width: 227, height: 64, bottom: 12 },
  },
};

export const TREE_SPRITES: Record<Tree["kind"], { crop: [number, number, number, number]; width: number; height: number; footprint: { width: number; height: number } }> = {
  0: { crop: [0, 0, 240, 300], width: 112, height: 159, footprint: { width: 46, height: 24 } },
  1: { crop: [240, 0, 200, 300], width: 91, height: 139, footprint: { width: 30, height: 22 } },
  2: { crop: [455, 0, 135, 150], width: 77, height: 86, footprint: { width: 65, height: 20 } },
};

export const POND = { x: 2050, y: 1370, rx: 300, ry: 180 };

export const REST_SPOTS: RestSpot[] = [
  { id: "ocean", name: "Open Ocean", x: 650, y: 275, kind: "bench", radius: 210 },
  { id: "hill", name: "Sunset Over the Hills", x: 1300, y: 210, kind: "gazebo", radius: 220 },
  { id: "aurora", name: "Aurora Night", x: 1990, y: 285, kind: "swing", radius: 210 },
  { id: "sunrise", name: "Sunrise Lake", x: 2320, y: 850, kind: "deck", radius: 220 },
  { id: "sunset", name: "Sunset Lake", x: 2000, y: 1680, kind: "picnic", radius: 210 },
  { id: "rain", name: "Misty Forest", x: 650, y: 1680, kind: "campfire", radius: 210 },
];

export function insideIsland(x: number, y: number, padding = 0): boolean {
  const rx = 1210 - padding;
  const ry = 885 - padding;
  if (rx <= 0 || ry <= 0) return false;
  const nx = Math.abs(x - WORLD_W / 2) / rx;
  const ny = Math.abs(y - WORLD_H / 2) / ry;
  return nx ** 4 + ny ** 4 <= 1;
}

export const NEIGHBOR_HOUSES: HouseSpot[] = [
  { x: 480, y: 410, tier: "normal", owner: "Sari" },
  { x: 1100, y: 340, tier: "cool", owner: "Joko" },
  { x: 2020, y: 430, tier: "poor", owner: "Queen Ayu" },
];
export const PLAYER_HOUSE = { x: 1470, y: 1540 };
export const NEIGHBORS: Neighbor[] = [];

export const BUILDINGS: BuildingSpot[] = [
  { id: "chapel", x: 1820, y: 390, sheet: "a", crop: [485, 80, 180, 225], width: 150, height: 188, collider: [-58, -55, 116, 75] },
  { id: "hall", x: 1280, y: 720, sheet: "a", crop: [330, 330, 240, 255], width: 210, height: 223, collider: [-82, -62, 164, 88] },
  { id: "shop", x: 1980, y: 760, sheet: "a", crop: [610, 335, 230, 245], width: 205, height: 218, collider: [-82, -55, 164, 78] },
  { id: "barn", x: 410, y: 1400, sheet: "a", crop: [100, 730, 235, 305], width: 205, height: 266, collider: [-82, -62, 164, 90] },
  { id: "windmill", x: 2240, y: 760, sheet: "a", crop: [620, 650, 175, 280], width: 158, height: 252, collider: [-52, -58, 104, 82] },
  { id: "market", x: 800, y: 770, sheet: "b", crop: [240, 340, 205, 190], width: 180, height: 167, collider: [-72, -45, 144, 65] },
  { id: "clock", x: 740, y: 1160, sheet: "b", crop: [20, 600, 190, 245], width: 175, height: 226, collider: [-70, -55, 140, 80] },
  { id: "forge", x: 1120, y: 1190, sheet: "b", crop: [245, 610, 205, 225], width: 180, height: 198, collider: [-72, -52, 144, 76] },
  { id: "mill", x: 2150, y: 1120, sheet: "b", crop: [470, 600, 185, 245], width: 170, height: 225, collider: [-56, -55, 112, 78] },
  { id: "shed", x: 330, y: 820, sheet: "b", crop: [660, 355, 150, 180], width: 135, height: 162, collider: [-54, -42, 108, 60] },
];

export const ANIMALS: AnimalSpot[] = [
  { id: "cow-1", kind: "cow", x: 240, y: 1530, phase: 0 }, { id: "cow-2", kind: "cow", x: 360, y: 1600, phase: 740 }, { id: "cow-3", kind: "cow", x: 510, y: 1535, phase: 1310 },
  { id: "pig-1", kind: "pig", x: 640, y: 1510, phase: 210 }, { id: "pig-2", kind: "pig", x: 745, y: 1590, phase: 910 }, { id: "pig-3", kind: "pig", x: 850, y: 1505, phase: 1520 },
  { id: "sheep-1", kind: "sheep", x: 270, y: 1735, phase: 360 }, { id: "sheep-2", kind: "sheep", x: 430, y: 1790, phase: 1080 }, { id: "sheep-3", kind: "sheep", x: 575, y: 1725, phase: 1660 },
  { id: "chicken-1", kind: "chicken", x: 700, y: 1740, phase: 120 }, { id: "chicken-2", kind: "chicken", x: 800, y: 1800, phase: 860 }, { id: "chicken-3", kind: "chicken", x: 905, y: 1715, phase: 1450 },
  { id: "frog-1", kind: "frog", x: 1840, y: 1300, phase: 0, range: 120 }, { id: "frog-2", kind: "frog", x: 2180, y: 1515, phase: 690, range: 115 }, { id: "frog-3", kind: "frog", x: 1990, y: 1170, phase: 1310, range: 100 },
  { id: "butterfly-1", kind: "butterfly", x: 2250, y: 320, phase: 180, range: 150 }, { id: "butterfly-2", kind: "butterfly", x: 2350, y: 520, phase: 820, range: 165 }, { id: "butterfly-3", kind: "butterfly", x: 1750, y: 980, phase: 1490, range: 145 },
];

export const VILLAGE_NPCS: VillageNpc[] = [
  { id: "blue-runner", name: "Kai", x: 300, y: 960, spriteRow: 0, speed: 58, idleMs: 900, path: [{x:300,y:960},{x:900,y:960},{x:1300,y:800},{x:1780,y:960},{x:2320,y:960}] },
  { id: "farmer-market", name: "Lani", x: 820, y: 650, spriteRow: 1, speed: 46, idleMs: 1300, path: [{x:820,y:650},{x:1300,y:960},{x:820,y:1220},{x:520,y:960}] },
  { id: "pastel-stroll", name: "Pipi", x: 1300, y: 270, spriteRow: 2, speed: 42, idleMs: 1600, path: [{x:1300,y:270},{x:1300,y:700},{x:1100,y:960},{x:1300,y:1260},{x:1300,y:1680}] },
  { id: "headphones-loop", name: "Momo", x: 1530, y: 720, spriteRow: 3, speed: 50, idleMs: 1100, path: [{x:1530,y:720},{x:1760,y:960},{x:1530,y:1210},{x:1280,y:960}] },
  { id: "elder-walk", name: "Elder Nuo", x: 570, y: 520, spriteRow: 4, speed: 34, idleMs: 1900, path: [{x:570,y:520},{x:950,y:730},{x:1300,y:960},{x:840,y:1190},{x:560,y:1380}] },
  { id: "queen-parade", name: "Queen Aya", x: 2070, y: 570, spriteRow: 5, speed: 38, idleMs: 1800, path: [{x:2070,y:570},{x:1740,y:760},{x:1450,y:960},{x:1830,y:1160},{x:2290,y:1020}] },
];

function rng(seed: number) { let s=seed; return () => ((s=(s*1664525+1013904223)%4294967296)/4294967296); }
export function buildTrees(): Tree[] {
  const rand=rng(20260919), trees:Tree[]=[];
  for(let i=0;i<155;i++) {
    const x=60+rand()*(WORLD_W-120), y=60+rand()*(WORLD_H-120);
    const nearPond=((x-POND.x)/(POND.rx+90))**2+((y-POND.y)/(POND.ry+90))**2<1;
    const nearBuilding=[...NEIGHBOR_HOUSES,{...PLAYER_HOUSE},...BUILDINGS].some(h=>Math.abs(h.x-x)<180&&Math.abs(h.y-y)<155);
    const onRoad=Math.abs(y-960)<85||Math.abs(x-1300)<85||Math.hypot(x-1300,y-960)<260;
    const inFarm=x<1000&&y>1300;
    const nearRest=REST_SPOTS.some(spot=>Math.hypot(spot.x-x,spot.y-y)<145);
    if(nearPond||nearBuilding||onRoad||inFarm||nearRest||!insideIsland(x,y,65)) continue;
    trees.push({x,y,scale:.76+rand()*.34,kind:(Math.floor(rand()*3) as 0|1|2),seed:rand()*100});
  }
  return trees;
}

export const LANTERNS: Lantern[]=[{x:1120,y:800},{x:1480,y:800},{x:1120,y:1120},{x:1480,y:1120},{x:420,y:960},{x:2250,y:960}];

export function buildColliders(playerHouseTier: TierId, trees: Tree[]):Rect[]{
  const rects:Rect[]=[];
  for(const h of [...NEIGHBOR_HOUSES,{...PLAYER_HOUSE,tier:playerHouseTier,owner:"you"}]) {
    const { footprint } = HOUSE_SPRITES[h.tier];
    rects.push({
      x: h.x - footprint.width / 2,
      y: h.y + footprint.bottom - footprint.height,
      w: footprint.width,
      h: footprint.height,
    });
  }
  for(const b of BUILDINGS){const [ox,oy,w,h]=b.collider;rects.push({x:b.x+ox,y:b.y+oy,w,h});}
  for(const spot of REST_SPOTS) rects.push({x:spot.x-46,y:spot.y-38,w:92,h:62});
  for (const tree of trees) {
    const { footprint } = TREE_SPRITES[tree.kind];
    const width = footprint.width * tree.scale;
    const height = footprint.height * tree.scale;
    rects.push({ x: tree.x - width / 2, y: tree.y - height, w: width, h: height });
  }
  return rects;
}
export function circleBlocked(x:number,y:number,radius:number,rects:Rect[]):boolean{
  if(!insideIsland(x,y,radius+18))return true;
  for(const r of rects)if(x+radius>r.x&&x-radius<r.x+r.w&&y+radius>r.y&&y-radius<r.y+r.h)return true;
  const px=(x-POND.x)/POND.rx,py=(y-POND.y)/POND.ry;
  return px*px+py*py<1;
}