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
  sheet: "a" | "b" | "post" | "barn" | "house-windmill";
  crop: [number, number, number, number];
  width: number;
  height: number;
  collider: [number, number, number, number];
  extraColliders?: Array<[number, number, number, number]>;
}
export type AnimalKind = "cow" | "pig" | "sheep" | "chicken" | "frog" | "butterfly";
export interface AnimalSpot { id: string; kind: AnimalKind; x: number; y: number; phase: number; range?: number }
export type NpcSpriteRow = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export interface VillageNpc {
  id: string; name: string; x: number; y: number; spriteRow: NpcSpriteRow;
  speed: number; idleMs: number; path: Array<{ x: number; y: number }>;
}
export type SceneryId = "ocean" | "hill" | "aurora" | "sunrise" | "sunset" | "rain" | "samudra" | "bukit" | "desa";
export type RestSpotKind = "bench" | "gazebo" | "deck" | "picnic" | "campfire" | "swing";
export interface RestSpot {
  id: SceneryId;
  name: string;
  x: number;
  y: number;
  kind: RestSpotKind;
  radius: number;
  /** Islet viewpoints: no furniture drawn and no collider. */
  hidden?: boolean;
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
    footprint: { width: 104, height: 62, bottom: 12 },
  },
  normal: {
    crop: [390, 360, 360, 370],
    width: 164,
    height: 168,
    footprint: { width: 138, height: 78, bottom: 12 },
  },
  cool: {
    crop: [65, 805, 525, 610],
    width: 235,
    height: 273,
    footprint: { width: 200, height: 126, bottom: 12 },
  },
  sultan: {
    crop: [620, 775, 550, 675],
    width: 246,
    height: 302,
    footprint: { width: 212, height: 140, bottom: 12 },
  },
};

export const TREE_SPRITES: Record<Tree["kind"], { crop: [number, number, number, number]; width: number; height: number; footprint: { width: number; height: number } }> = {
  0: { crop: [0, 0, 240, 300], width: 112, height: 159, footprint: { width: 46, height: 24 } },
  1: { crop: [240, 0, 200, 300], width: 91, height: 139, footprint: { width: 30, height: 22 } },
  2: { crop: [455, 0, 135, 150], width: 77, height: 86, footprint: { width: 65, height: 20 } },
};

export const POND = { x: 2050, y: 1370, rx: 300, ry: 180 };

export const REST_SPOTS: RestSpot[] = [
  { id: "desa", name: "Home Yard", x: 1470, y: 1570, kind: "deck", radius: 130, hidden: true },
  { id: "ocean", name: "Open Ocean", x: 650, y: 275, kind: "bench", radius: 210 },
  { id: "hill", name: "Sunset Over the Hills", x: 1300, y: 210, kind: "gazebo", radius: 220 },
  { id: "aurora", name: "Aurora Night", x: 1990, y: 285, kind: "swing", radius: 210 },
  { id: "sunrise", name: "Sunrise Lake", x: 2320, y: 850, kind: "deck", radius: 220 },
  { id: "sunset", name: "Sunset Lake", x: 2000, y: 1680, kind: "picnic", radius: 210 },
  { id: "rain", name: "Misty Forest", x: 650, y: 1680, kind: "campfire", radius: 210 },
  { id: "samudra", name: "Ocean Dusk", x: 100, y: 190, kind: "deck", radius: 110, hidden: true },
  { id: "bukit", name: "Forest Hills at Dusk", x: 2560, y: 1985, kind: "deck", radius: 130, hidden: true },
];

/**
 * Satellite islets in the open-water corners, drawn from pixel-art sprites and linked to the
 * main island by a plank bridge. `img` = sprite draw rect, `walk` = walkable ellipse,
 * `deck` = extra walkable rect, `solid` = blocked buildings, `roof` = part redrawn above characters.
 */
type Box = { x: number; y: number; w: number; h: number };
export type Islet = {
  id: "nw" | "se";
  img: Box;
  walk: { x: number; y: number; rx: number; ry: number } | null;
  decks: Box[];
  solid: Box[];
  roof: Box;
  bridge: { x1: number; y1: number; x2: number; y2: number };
};
/** Fisherman's island homestead. All shapes are authored in sprite pixels (1123x752) and scaled to world units. */
function seIslet(): Islet {
  const X = 2300, Y = 1690, W = 713, k = W / 1123;
  const b = (x: number, y: number, w: number, h: number): Box => ({ x: X + x * k, y: Y + y * k, w: w * k, h: h * k });
  return {
    id: "se",
    img: { x: X, y: Y, w: W, h: 752 * k },
    walk: { x: X + 650 * k, y: Y + 480 * k, rx: 430 * k, ry: 250 * k },
    decks: [b(70, 480, 200, 100)],
    solid: [
      b(220, 120, 730, 150), b(290, 280, 440, 200), b(860, 250, 115, 80),
      b(720, 350, 50, 90), b(600, 420, 95, 50), b(530, 465, 45, 45), b(315, 445, 95, 65),
      b(770, 345, 150, 80), b(930, 390, 85, 100), b(60, 290, 175, 120), b(880, 550, 210, 150),
      b(620, 530, 210, 120), b(838, 540, 35, 65), b(440, 585, 130, 75), b(285, 595, 140, 100),
    ],
    roof: b(280, 0, 461, 406),
    bridge: { x1: 2130, y1: 1760, x2: X + 80 * k, y2: Y + 530 * k },
  };
}
/** Fisherman's stilt house (sprite 789x690), drawn 30% larger; shapes authored in sprite pixels. */
function nwIslet(): Islet {
  const X = 40, Y = 22, W = 364, k = W / 789;
  const b = (x: number, y: number, w: number, h: number): Box => ({ x: X + x * k, y: Y + y * k, w: w * k, h: h * k });
  return {
    id: "nw",
    img: { x: X, y: Y, w: W, h: 690 * k },
    walk: null,
    // left deck, right deck, front boardwalk
    decks: [b(15, 215, 255, 260), b(615, 225, 165, 250), b(15, 465, 760, 125)],
    solid: [
      b(270, 150, 350, 320), // house walls + interior
      b(20, 185, 175, 95), // fish drying rack
      b(205, 240, 65, 210), // left barrels
      b(650, 215, 90, 120), // right barrels
      b(625, 395, 60, 70), // front-right barrel
      b(45, 490, 105, 70), // crates
    ],
    roof: b(240, 0, 410, 475),
    bridge: { x1: 400, y1: 345, x2: X + 700 * k, y2: Y + 560 * k },
  };
}
export const ISLETS: Islet[] = [
  nwIslet(),
  seIslet(),
];
const BRIDGE_HALF = 22;

function onBridge(x: number, y: number): boolean {
  for (const { bridge: b } of ISLETS) {
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    const t = Math.max(0, Math.min(1, ((x - b.x1) * dx + (y - b.y1) * dy) / (dx * dx + dy * dy)));
    if (Math.hypot(x - (b.x1 + dx * t), y - (b.y1 + dy * t)) <= BRIDGE_HALF) return true;
  }
  return false;
}

export function insideIsland(x: number, y: number, padding = 0): boolean {
  // Islets and bridges are walkable for characters, but never chosen as tree spots (large padding).
  if (padding < 50) {
    for (const i of ISLETS) {
      if (i.walk && ((x - i.walk.x) / i.walk.rx) ** 2 + ((y - i.walk.y) / i.walk.ry) ** 2 <= 1) return true;
      if (i.decks.some((d) => x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h)) return true;
    }
    if (onBridge(x, y)) return true;
  }
  return insideMain(x, y, padding);
}

/** Organic shoreline: gentle coves and headlands around the base superellipse (never shrinks below 97%). */
export function mainShoreScale(theta: number): number {
  const v = 1 + 0.035 * Math.sin(3 * theta + 0.6) + 0.022 * Math.sin(7 * theta + 2.1) + 0.01 * Math.sin(13 * theta + 1.3);
  return Math.max(0.97, v);
}
export const MAIN_RX = 1210;
export const MAIN_RY = 885;

export function insideMain(x: number, y: number, padding: number): boolean {
  const ux = (x - WORLD_W / 2) / MAIN_RX;
  const uy = (y - WORLD_H / 2) / MAIN_RY;
  const sc = mainShoreScale(Math.atan2(uy, ux));
  const rx = MAIN_RX * sc - padding;
  const ry = MAIN_RY * sc - padding;
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
  // The farm is fully fenced in, so the whole paddock is solid ground for the player.
  { id: "barn", x: 410, y: 1400, sheet: "barn", crop: [0, 0, 218, 306], width: 205, height: 288, collider: [-100, -250, 200, 266] },
  { id: "windmill", x: 2240, y: 760, sheet: "house-windmill", crop: [0, 0, 210, 350], width: 190, height: 317, collider: [-27, -72, 58, 86], extraColliders: [[-86, -145, 124, 38], [52, -141, 20, 42]] },
  { id: "market", x: 800, y: 770, sheet: "b", crop: [240, 340, 205, 190], width: 180, height: 167, collider: [-72, -45, 144, 65] },
  { id: "clock", x: 740, y: 1160, sheet: "b", crop: [20, 600, 190, 245], width: 175, height: 226, collider: [-70, -55, 140, 80] },
  { id: "forge", x: 1120, y: 1190, sheet: "b", crop: [245, 610, 205, 225], width: 180, height: 198, collider: [-72, -52, 144, 76] },
  { id: "mill", x: 2150, y: 1120, sheet: "b", crop: [470, 600, 185, 245], width: 170, height: 225, collider: [-56, -55, 112, 78] },
  { id: "post-office", x: 1650, y: 1200, sheet: "post", crop: [0, 0, 411, 506], width: 210, height: 259, collider: [-82, -58, 164, 70] },
];

export const ANIMALS: AnimalSpot[] = [
  { id: "cow-1", kind: "cow", x: 240, y: 1530, phase: 0 }, { id: "cow-2", kind: "cow", x: 360, y: 1600, phase: 740 }, { id: "cow-3", kind: "cow", x: 510, y: 1535, phase: 1310 },
  { id: "pig-1", kind: "pig", x: 640, y: 1510, phase: 210 }, { id: "pig-2", kind: "pig", x: 745, y: 1590, phase: 910 }, { id: "pig-3", kind: "pig", x: 850, y: 1505, phase: 1520 },
  { id: "sheep-1", kind: "sheep", x: 270, y: 1735, phase: 360 }, { id: "sheep-2", kind: "sheep", x: 430, y: 1790, phase: 1080 }, { id: "sheep-3", kind: "sheep", x: 575, y: 1725, phase: 1660 },
  { id: "chicken-1", kind: "chicken", x: 700, y: 1740, phase: 120 }, { id: "chicken-2", kind: "chicken", x: 800, y: 1800, phase: 860 }, { id: "chicken-3", kind: "chicken", x: 905, y: 1715, phase: 1450 },
  { id: "frog-1", kind: "frog", x: 1840, y: 1300, phase: 0, range: 120 }, { id: "frog-2", kind: "frog", x: 2180, y: 1515, phase: 690, range: 115 }, { id: "frog-3", kind: "frog", x: 1990, y: 1170, phase: 1310, range: 100 },
  { id: "butterfly-1", kind: "butterfly", x: 2250, y: 320, phase: 180, range: 150 }, { id: "butterfly-2", kind: "butterfly", x: 2350, y: 520, phase: 820, range: 165 }, { id: "butterfly-3", kind: "butterfly", x: 1750, y: 980, phase: 1490, range: 145 },
];

/** Solid ground footprint for the farm animals. Frogs and butterflies stay walk-through. */
export const ANIMAL_FOOTPRINTS: Partial<Record<AnimalKind, { width: number; height: number }>> = {
  cow: { width: 66, height: 26 },
  pig: { width: 56, height: 22 },
  sheep: { width: 55, height: 24 },
  chicken: { width: 36, height: 18 },
};

export const VILLAGE_NPCS: VillageNpc[] = [
  { id: "blue-runner", name: "Kai", x: 300, y: 960, spriteRow: 0, speed: 58, idleMs: 900, path: [{x:300,y:960},{x:900,y:960},{x:1300,y:800},{x:1780,y:960},{x:2320,y:960}] },
  { id: "farmer-market", name: "Lani", x: 820, y: 650, spriteRow: 1, speed: 46, idleMs: 1300, path: [{x:820,y:650},{x:1300,y:960},{x:820,y:1220},{x:520,y:960}] },
  // Route skirts the town hall (its walls sit right on the north road) and follows the north-west road for sideways strolls.
  { id: "pastel-stroll", name: "Pipi", x: 1300, y: 300, spriteRow: 2, speed: 42, idleMs: 1600, path: [{x:1300,y:300},{x:1300,y:590},{x:1060,y:590},{x:900,y:520},{x:700,y:325},{x:900,y:520},{x:1300,y:960},{x:1750,y:960},{x:1300,y:960},{x:1060,y:590},{x:1300,y:590}] },
  { id: "headphones-loop", name: "Momo", x: 1530, y: 720, spriteRow: 3, speed: 50, idleMs: 1100, path: [{x:1530,y:720},{x:1760,y:960},{x:1530,y:1210},{x:1280,y:960}] },
  { id: "elder-walk", name: "Elder Nuo", x: 690, y: 650, spriteRow: 4, speed: 34, idleMs: 1900, path: [{x:690,y:650},{x:850,y:650},{x:930,y:650},{x:930,y:750},{x:950,y:760},{x:1300,y:960},{x:840,y:1190},{x:560,y:1380},{x:520,y:900},{x:640,y:900},{x:690,y:890}] },
  // Queen Aya patrols the eastern plaza.
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
  const rects:Rect[]=[{ x: MONUMENT.x - 36, y: MONUMENT.y - 34, w: 72, h: 40 }];
  for(const h of [...NEIGHBOR_HOUSES,{...PLAYER_HOUSE,tier:playerHouseTier,owner:"you"}]) {
    const { footprint } = HOUSE_SPRITES[h.tier];
    rects.push({
      x: h.x - footprint.width / 2,
      y: h.y + footprint.bottom - footprint.height,
      w: footprint.width,
      h: footprint.height,
    });
  }
  for(const b of BUILDINGS){
    for(const [ox,oy,w,h] of [b.collider,...(b.extraColliders??[])]) rects.push({x:b.x+ox,y:b.y+oy,w,h});
  }
  for(const i of ISLETS) for(const s of i.solid) rects.push({...s});
  for(const spot of REST_SPOTS) if(!spot.hidden) rects.push({x:spot.x-46,y:spot.y-38,w:92,h:62});
  for(const animal of ANIMALS){
    const size = ANIMAL_FOOTPRINTS[animal.kind];
    if(!size) continue;
    rects.push({ x: animal.x - size.width / 2, y: animal.y - size.height, w: size.width, h: size.height });
  }
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
/** The post office sits beside the player's home, with its entrance accessible from the south. */
/** Hero statue in the plaza; reading it opens the Nimiq Chronicle. */
export const MONUMENT = { x: 1300, y: 975, width: 78, height: 226, radius: 120 };
export const POST_OFFICE = { buildingId: "post-office", x: 1650, y: 1200, door: { x: 1650, y: 1240 }, radius: 130 };
