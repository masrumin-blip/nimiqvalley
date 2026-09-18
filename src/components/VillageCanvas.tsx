import { useEffect, useRef, type MutableRefObject } from "react";
import type { TierId } from "@/lib/tiers";
import playerSpritesAsset from "@/assets/player-sprites.png.asset.json";
const playerSprites = playerSpritesAsset.url;
import npcSpritesAsset from "@/assets/npc-sprites-final.png.asset.json";
const npcSprites = npcSpritesAsset.url;
import animalSpritesAsset from "@/assets/village-animals.png.asset.json";
const animalSprites = animalSpritesAsset.url;
import buildingSpritesAAsset from "@/assets/village-buildings-a.png.asset.json";
const buildingSpritesA = buildingSpritesAAsset.url;
import buildingSpritesBAsset from "@/assets/village-buildings-b.png.asset.json";
const buildingSpritesB = buildingSpritesBAsset.url;
import objectSpritesAsset from "@/assets/village-objects.png.asset.json";
const objectSprites = objectSpritesAsset.url;
import houseTierSpritesAsset from "@/assets/village-house-tiers.png.asset.json";
const houseTierSprites = houseTierSpritesAsset.url;
import {
  ANIMALS,
  BUILDINGS,
  buildColliders,
  buildTrees,
  circleBlocked,
  LANTERNS,
  NEIGHBORS,
  NEIGHBOR_HOUSES,
  PLAYER_HOUSE,
  POND,
  REST_SPOTS,
  WORLD_H,
  WORLD_W,
  VILLAGE_NPCS,
  type Neighbor,
  type AnimalSpot,
  type BuildingSpot,
  type VillageNpc,
  type RestSpot,
} from "@/lib/village";

type Direction = "down" | "left" | "right" | "up";

const SPRITE_COLS = 16;
const SPRITE_ROWS = 4;
const NPC_SPRITE_ROWS = 6;
const CAMERA_ZOOM = 0.85;
const TIER_ROW: Record<TierId, number> = { poor: 0, normal: 1, cool: 2, sultan: 3 };
const DIRECTION_COL: Record<Direction, number> = { down: 0, left: 4, right: 8, up: 12 };

interface Props {
  characterTier: TierId;
  houseTier: TierId;
  moveRef: MutableRefObject<{ x: number; y: number }>;
  onNearbyChange: (n: Neighbor | null) => void;
  onViewpointChange: (spot: RestSpot | null) => void;
  paused?: boolean;
}

interface NpcState extends VillageNpc {
  targetIndex: number;
  walking: boolean;
  direction: Direction;
  waitUntil: number;
}

const PALETTE = {
  grassA: "#8ed081",
  grassB: "#6fbf73",
  grassDeep: "#4f9e5d",
  path: "#e6d3a3",
  pathEdge: "#cbb185",
  water: "#63c7e8",
  waterDeep: "#2f9fce",
  ocean: "#277da1",
  oceanLight: "#53b3cb",
  sand: "#f0d39a",
  wetSand: "#d6b77d",
  ink: "#26402f",
  roofPoor: "#b98a5a",
  roofNormal: "#c9573f",
  roofCool: "#4f6d7a",
  roofGold: "#f2c14e",
  wall: "#f6ecd8",
};

function islandPath(ctx: CanvasRenderingContext2D, inset: number) {
  const cx = WORLD_W / 2;
  const cy = WORLD_H / 2;
  const rx = 1210 - inset;
  const ry = 885 - inset;
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) {
    const angle = (i / 96) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = cx + rx * Math.sign(cos) * Math.abs(cos) ** 0.5;
    const y = cy + ry * Math.sign(sin) * Math.abs(sin) ** 0.5;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
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

function drawHouseSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  tier: TierId,
  mine: boolean,
  t: number,
) {
  const crops: Record<TierId, [number, number, number, number, number, number]> = {
    poor: [70, 405, 285, 305, 128, 138],
    normal: [390, 360, 360, 370, 164, 168],
    cool: [65, 805, 525, 610, 235, 273],
    sultan: [620, 775, 550, 675, 246, 302],
  };
  const [sx, sy, sw, sh, dw, dh] = crops[tier];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "rgba(30,60,40,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, dw * 0.38, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(image, sx, sy, sw, sh, x - dw / 2, y - dh + 12, dw, dh);
  if (mine) {
    const bob = Math.sin(t / 380) * 4;
    ctx.fillStyle = "#ffd66e";
    ctx.strokeStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(x, y - dh - 12 + bob);
    ctx.lineTo(x + 10, y - dh + bob);
    ctx.lineTo(x, y - dh + 12 + bob);
    ctx.lineTo(x - 10, y - dh + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tier: TierId,
  t: number,
  walking: boolean,
  hue?: number,
) {
  const step = walking ? Math.sin(t / 90) * 5 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 3.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = PALETTE.ink;

  ctx.fillStyle = "rgba(30,60,40,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 22, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (tier === "sultan") {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ffe49a";
    ctx.beginPath();
    ctx.arc(0, -6, 34 + Math.sin(t / 250) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (tier === "cool") {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#9be7ff";
    ctx.beginPath();
    ctx.arc(0, -4, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // legs
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 10);
  ctx.lineTo(-6 - step, 22);
  ctx.moveTo(6, 10);
  ctx.lineTo(6 + step, 22);
  ctx.stroke();

  // body
  const body =
    hue !== undefined
      ? `hsl(${hue} 70% 62%)`
      : tier === "sultan"
        ? "#f2c14e"
        : tier === "cool"
          ? "#3f7d8c"
          : tier === "normal"
            ? "#6fa8dc"
            : "#a89272";
  ctx.fillStyle = body;
  roundRect(ctx, -14, -10, 28, 26, 9);
  ctx.fill();
  ctx.stroke();

  if (tier === "sultan") {
    ctx.fillStyle = "#ffe9a8";
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(0, 16);
    ctx.lineTo(14, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (tier === "poor" && hue === undefined) {
    ctx.strokeStyle = "#7a6a4d";
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(-2, 8);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.ink;
  }

  // head
  ctx.fillStyle = "#f6cfa8";
  ctx.beginPath();
  ctx.arc(0, -20, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // hair / headwear
  if (tier === "sultan" && hue === undefined) {
    ctx.fillStyle = "#ffd763";
    ctx.beginPath();
    ctx.moveTo(-13, -28);
    ctx.lineTo(-8, -40);
    ctx.lineTo(-2, -30);
    ctx.lineTo(4, -42);
    ctx.lineTo(10, -30);
    ctx.lineTo(13, -28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = "#3d2b1f";
    ctx.beginPath();
    ctx.arc(0, -24, 12, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
  }
  if (tier === "cool" && hue === undefined) {
    ctx.fillStyle = "#1d2b33";
    roundRect(ctx, -11, -23, 22, 7, 3);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayerSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  tier: TierId,
  direction: Direction,
  t: number,
  walking: boolean,
) {
  const cellW = image.naturalWidth / SPRITE_COLS;
  const cellH = image.naturalHeight / SPRITE_ROWS;
  const idleFrame = direction === "left" || direction === "right" ? 3 : 0;
  const frame = walking ? Math.floor(t / 150) % 4 : idleFrame;
  const sourceX = (DIRECTION_COL[direction] + frame) * cellW;
  const sourceY = TIER_ROW[tier] * cellH;
  const bob = walking ? Math.abs(Math.sin(t / 150)) * 2 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "rgba(30,60,40,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(image, sourceX, sourceY, cellW, cellH, x - 25, y - 60 - bob, 50, 66);
  ctx.restore();
}

function drawNpcSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  row: number,
  direction: Direction,
  t: number,
  walking: boolean,
) {
  const drawWidth = 45;
  const drawHeight = 59.4;
  const groundY = y + 5;
  const cellW = image.naturalWidth / SPRITE_COLS;
  const cellH = image.naturalHeight / NPC_SPRITE_ROWS;
  const idleFrame = direction === "left" || direction === "right" ? 3 : 0;
  const frame = walking ? Math.floor(t / 150) % 4 : idleFrame;
  const safeRow = Math.max(0, Math.min(NPC_SPRITE_ROWS - 1, row));
  const sourceX = (DIRECTION_COL[direction] + frame) * cellW;
  const sourceY = safeRow * cellH;
  const phase = walking ? Math.floor(t / 150) % 4 : 0;
  const bob = walking && phase % 2 === 1 ? 1 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "rgba(30,60,40,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, groundY + 1, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, groundY - bob);
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    cellW,
    cellH,
    -drawWidth / 2,
    -drawHeight,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
}

function directionFromDelta(dx: number, dy: number, fallback: Direction): Direction {
  if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

function updateNpcState(npc: NpcState, t: number, dt: number, colliders: ReturnType<typeof buildColliders>) {
  if (t < npc.waitUntil) {
    npc.walking = false;
    return;
  }

  const target = npc.path[npc.targetIndex];
  if (!target) {
    npc.targetIndex = 0;
    npc.walking = false;
    return;
  }

  const dx = target.x - npc.x;
  const dy = target.y - npc.y;
  const dist = Math.hypot(dx, dy);
  npc.direction = directionFromDelta(dx, dy, npc.direction);

  if (dist < 2) {
    npc.x = target.x;
    npc.y = target.y;
    npc.targetIndex = (npc.targetIndex + 1) % npc.path.length;
    npc.waitUntil = t + npc.idleMs;
    npc.walking = false;
    return;
  }

  const step = Math.min(dist, (npc.speed * dt) / 1000);
  const nx = npc.x + (dx / Math.max(dist, 1)) * step;
  const ny = npc.y + (dy / Math.max(dist, 1)) * step;
  let moved = false;

  if (!circleBlocked(nx, npc.y, 14, colliders)) {
    npc.x = nx;
    moved = true;
  }
  if (!circleBlocked(npc.x, ny, 14, colliders)) {
    npc.y = ny;
    moved = true;
  }

  npc.walking = moved;
  if (!moved) {
    npc.targetIndex = (npc.targetIndex + 1) % npc.path.length;
    npc.waitUntil = t + npc.idleMs;
  }
}

function drawTreeSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, scale: number, kind: 0 | 1 | 2) {
  const crops: Array<[number, number, number, number]> = [
    [0, 0, 240, 300],
    [240, 0, 200, 300],
    [455, 0, 135, 150],
  ];
  const crop = crops[kind];
  if (!crop) return;
  const [sx, sy, sw, sh] = crop;
  const sizes: Array<[number, number]> = [
    [112, 159],
    [91, 139],
    [77, 86],
  ];
  const size = sizes[kind];
  if (!size) return;
  const [baseWidth, baseHeight] = size;
  const width = baseWidth * scale;
  const height = baseHeight * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sx, sy, sw, sh, x - width / 2, y - height, width, height);
  ctx.restore();
}

function drawBuildingSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, building: BuildingSpot) {
  const [sx, sy, sw, sh] = building.crop;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sx, sy, sw, sh, building.x - building.width / 2, building.y - building.height + 18, building.width, building.height);
  ctx.restore();
}

function drawAnimalSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, animal: AnimalSpot, t: number) {
  const frames: Record<AnimalSpot["kind"], Array<[number, number, number, number]>> = {
    cow: [[10,20,180,155],[200,20,180,155],[390,20,180,155],[580,20,180,155]],
    frog: [[18,270,165,145],[205,270,165,145],[395,250,175,165],[580,270,175,145]],
    butterfly: [[15,465,170,135],[205,465,165,135],[395,465,170,135],[585,465,165,135]],
    pig: [[10,715,180,150],[200,715,180,150],[390,715,180,150],[580,715,180,150]],
    sheep: [[10,950,180,170],[200,950,180,170],[390,950,180,170],[580,950,180,170]],
    chicken: [[5,1195,150,155],[155,1195,150,155],[305,1195,150,155],[455,1195,150,155]],
  };
  const stationary = animal.kind !== "frog" && animal.kind !== "butterfly";
  const interval = stationary ? 1100 : 230;
  const animalFrames = frames[animal.kind];
  const frame = Math.floor((t + animal.phase) / interval) % animalFrames.length;
  const crop = animalFrames[frame];
  if (!crop) return;
  const [sx, sy, sw, sh] = crop;
  const range = animal.range ?? 0;
  const moving = !stationary;
  const ox = moving ? Math.sin((t + animal.phase) / 1250) * range : 0;
  const oy = animal.kind === "butterfly" ? Math.sin((t + animal.phase) / 420) * 24 : animal.kind === "frog" ? -Math.max(0, Math.sin((t + animal.phase) / 520)) * 22 : 0;
  const sizes: Record<AnimalSpot["kind"], [number, number]> = { cow:[74,64], pig:[63,50], sheep:[62,56], chicken:[42,43], frog:[38,34], butterfly:[36,31] };
  const [dw, dh] = sizes[animal.kind];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sx, sy, sw, sh, animal.x + ox - dw / 2, animal.y + oy - dh, dw, dh);
  ctx.restore();
}

function drawRestSpot(ctx: CanvasRenderingContext2D, spot: RestSpot, t: number) {
  ctx.save();
  ctx.translate(spot.x, spot.y);
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = PALETTE.ink;
  const wood = "#9b633f";
  const woodLight = "#c9905e";
  const cloth = "#e66f70";

  ctx.fillStyle = "rgba(30,60,40,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 46, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  if (spot.kind === "bench") {
    ctx.fillStyle = woodLight;
    roundRect(ctx, -36, -18, 72, 13, 3); ctx.fill(); ctx.stroke();
    roundRect(ctx, -40, -2, 80, 12, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-29, 10); ctx.lineTo(-33, 24); ctx.moveTo(29, 10); ctx.lineTo(33, 24); ctx.stroke();
  } else if (spot.kind === "gazebo") {
    ctx.fillStyle = wood;
    ctx.fillRect(-38, -55, 7, 65); ctx.fillRect(31, -55, 7, 65);
    ctx.beginPath(); ctx.moveTo(-52, -53); ctx.lineTo(0, -86); ctx.lineTo(52, -53); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = woodLight; roundRect(ctx, -37, 0, 74, 12, 3); ctx.fill(); ctx.stroke();
  } else if (spot.kind === "deck") {
    ctx.fillStyle = woodLight;
    ctx.fillRect(-48, -10, 96, 38); ctx.strokeRect(-48, -10, 96, 38);
    ctx.strokeStyle = wood; for (let x = -34; x <= 34; x += 17) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x, 26); ctx.stroke(); }
    ctx.strokeStyle = PALETTE.ink; ctx.beginPath(); ctx.moveTo(-46, -10); ctx.lineTo(-46, -39); ctx.moveTo(46, -10); ctx.lineTo(46, -39); ctx.stroke();
  } else if (spot.kind === "picnic") {
    ctx.fillStyle = cloth; ctx.beginPath(); ctx.moveTo(-42, -6); ctx.lineTo(32, -15); ctx.lineTo(45, 24); ctx.lineTo(-34, 29); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#f7e4b4"; ctx.lineWidth = 3; for (let x = -25; x < 35; x += 18) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x + 8, 25); ctx.stroke(); }
    ctx.fillStyle = "#f0c96a"; ctx.beginPath(); ctx.arc(12, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (spot.kind === "campfire") {
    ctx.strokeStyle = wood; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-22, 18); ctx.lineTo(22, -2); ctx.moveTo(-22, -2); ctx.lineTo(22, 18); ctx.stroke();
    const flame = 9 + Math.sin(t / 170) * 3;
    ctx.fillStyle = "#f6b44b"; ctx.beginPath(); ctx.moveTo(0, 7); ctx.quadraticCurveTo(-16, -7, -3, -25 - flame); ctx.quadraticCurveTo(18, -6, 0, 7); ctx.fill();
  } else {
    ctx.strokeStyle = wood; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-38, 18); ctx.lineTo(-30, -58); ctx.lineTo(30, -58); ctx.lineTo(38, 18); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -56); ctx.lineTo(-14, 2); ctx.moveTo(18, -56); ctx.lineTo(14, 2); ctx.stroke();
    ctx.fillStyle = woodLight; roundRect(ctx, -24, -2, 48, 11, 3); ctx.fill(); ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,230,155,0.75)";
  ctx.beginPath();
  ctx.arc(0, -68 + Math.sin(t / 420 + spot.x) * 3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function VillageCanvas({ characterTier, houseTier, moveRef, onNearbyChange, onViewpointChange, paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    x: 1300,
    y: 1030,
    walking: false,
    direction: "down" as Direction,
    lastSide: "right" as "left" | "right",
  });
  const tiersRef = useRef({ characterTier, houseTier });
  tiersRef.current = { characterTier, houseTier };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const trees = buildTrees();
    const playerImage = new Image();
    playerImage.src = playerSprites;
    const npcImage = new Image();
    npcImage.src = npcSprites;
    const animalImage = new Image();
    animalImage.src = animalSprites;
    const buildingImageA = new Image();
    buildingImageA.src = buildingSpritesA;
    const buildingImageB = new Image();
    buildingImageB.src = buildingSpritesB;
    const objectImage = new Image();
    objectImage.src = objectSprites;
    const houseImage = new Image();
    houseImage.src = houseTierSprites;
    const colliders = buildColliders();
    const keys = new Set<string>();
    let nearby: Neighbor | null = null;
    let nearbyViewpoint: RestSpot | null = null;
    let raf = 0;
    let lastTime = 0;
    const npcStates: NpcState[] = VILLAGE_NPCS.map((npc) => ({
      ...npc,
      targetIndex: npc.path.length > 1 ? 1 : 0,
      walking: false,
      direction: "down",
      waitUntil: 0,
    }));

    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase()))
        e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (t: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = canvas.width / dpr;
      const vh = canvas.height / dpr;
      const viewW = vw / CAMERA_ZOOM;
      const viewH = vh / CAMERA_ZOOM;
      const s = stateRef.current;
      const dt = lastTime === 0 ? 16 : Math.min(t - lastTime, 50);
      lastTime = t;

      let dx = paused ? 0 : moveRef.current.x;
      let dy = paused ? 0 : moveRef.current.y;
      if (!paused && (keys.has("arrowleft") || keys.has("a"))) dx -= 1;
      if (!paused && (keys.has("arrowright") || keys.has("d"))) dx += 1;
      if (!paused && (keys.has("arrowup") || keys.has("w"))) dy -= 1;
      if (!paused && (keys.has("arrowdown") || keys.has("s"))) dy += 1;
      const len = Math.hypot(dx, dy);
      s.walking = len > 0.05;
      if (s.walking) {
        if (dy < 0 && Math.abs(dy) >= Math.abs(dx)) {
          s.direction = "up";
        } else if (dy > 0 && Math.abs(dy) >= Math.abs(dx)) {
          if (Math.abs(dx) > 0.05) s.lastSide = dx < 0 ? "left" : "right";
          s.direction = s.lastSide;
        } else {
          s.direction = dx < 0 ? "left" : "right";
          s.lastSide = s.direction;
        }
        const speed = 3.4;
        const nx = s.x + (dx / Math.max(len, 1)) * speed;
        const ny = s.y + (dy / Math.max(len, 1)) * speed;
        if (!circleBlocked(nx, s.y, 18, colliders)) s.x = nx;
        if (!circleBlocked(s.x, ny, 18, colliders)) s.y = ny;
      }

      for (const npc of npcStates) updateNpcState(npc, t, dt, colliders);

      const found = NEIGHBORS.find((n) => Math.hypot(n.x - s.x, n.y - s.y) < 110) ?? null;
      if (found?.name !== nearby?.name) {
        nearby = found;
        onNearbyChange(found);
      }
      const foundViewpoint = REST_SPOTS.find((spot) => Math.hypot(spot.x - s.x, spot.y - s.y) < spot.radius) ?? null;
      if (foundViewpoint?.id !== nearbyViewpoint?.id) {
        nearbyViewpoint = foundViewpoint;
        onViewpointChange(foundViewpoint);
      }

      const camX = Math.max(0, Math.min(WORLD_W - viewW, s.x - viewW / 2));
      const camY = Math.max(0, Math.min(WORLD_H - viewH, s.y - viewH / 2));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      ctx.save();
      ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
      ctx.translate(-camX, -camY);

      // ocean and layered island shore
      ctx.fillStyle = PALETTE.ocean;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.strokeStyle = PALETTE.oceanLight;
      ctx.lineWidth = 3;
      for (let wy = 55; wy < WORLD_H; wy += 70) {
        const waveShift = Math.sin(t / 900 + wy) * 15;
        for (let wx = 35; wx < WORLD_W; wx += 130) {
          ctx.beginPath();
          ctx.arc(wx + waveShift, wy, 20, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        }
      }
      islandPath(ctx, 0);
      ctx.fillStyle = PALETTE.wetSand;
      ctx.fill();
      islandPath(ctx, 28);
      ctx.fillStyle = PALETTE.sand;
      ctx.fill();

      // grass
      const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      grad.addColorStop(0, PALETTE.grassA);
      grad.addColorStop(1, PALETTE.grassB);
      ctx.fillStyle = grad;
      islandPath(ctx, 72);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let gx = 0; gx < WORLD_W; gx += 90) {
        for (let gy = 0; gy < WORLD_H; gy += 90) {
          const px = gx + ((gy / 90) % 2) * 45;
          if (((Math.abs(px - WORLD_W / 2) / 1138) ** 4 + (Math.abs(gy - WORLD_H / 2) / 813) ** 4) <= 1) ctx.fillRect(px, gy, 44, 44);
        }
      }

      // paths
      ctx.strokeStyle = PALETTE.pathEdge;
      ctx.lineWidth = 78;
      ctx.lineCap = "round";
      const drawPaths = () => {
        ctx.beginPath();
        ctx.moveTo(120, 960);
        ctx.lineTo(2480, 960);
        ctx.moveTo(1300, 120);
        ctx.lineTo(1300, 1840);
        ctx.moveTo(480, 410);
        ctx.lineTo(1300, 960);
        ctx.moveTo(2020, 430);
        ctx.lineTo(1300, 960);
        ctx.moveTo(410, 1400);
        ctx.lineTo(1300, 960);
        ctx.moveTo(2050, 1370);
        ctx.lineTo(1300, 960);
        ctx.moveTo(650, 275);
        ctx.lineTo(900, 520);
        ctx.lineTo(1300, 960);
        ctx.moveTo(1300, 210);
        ctx.lineTo(1300, 960);
        ctx.moveTo(1990, 285);
        ctx.lineTo(1700, 570);
        ctx.lineTo(1300, 960);
        ctx.moveTo(2320, 850);
        ctx.lineTo(1900, 900);
        ctx.lineTo(1300, 960);
        ctx.moveTo(2000, 1680);
        ctx.lineTo(1740, 1440);
        ctx.lineTo(1300, 960);
        ctx.moveTo(650, 1680);
        ctx.lineTo(900, 1420);
        ctx.lineTo(1300, 960);
        ctx.stroke();
      };
      drawPaths();
      ctx.strokeStyle = PALETTE.path;
      ctx.lineWidth = 66;
      drawPaths();

      // plaza
      ctx.fillStyle = PALETTE.path;
      ctx.beginPath();
      ctx.arc(1300, 960, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.pathEdge;
      ctx.lineWidth = 8;
      ctx.stroke();

      // pond
      ctx.fillStyle = PALETTE.waterDeep;
      ctx.beginPath();
      ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.water;
      ctx.beginPath();
      ctx.ellipse(POND.x, POND.y - 6, POND.rx - 10, POND.ry - 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const off = Math.sin(t / 600 + i) * 12;
        ctx.beginPath();
        ctx.ellipse(POND.x + off, POND.y - 50 + i * 34, 70 - i * 8, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // houses (neighbors + player)
      const drawables: Array<{ y: number; draw: () => void }> = [];
      for (const h of NEIGHBOR_HOUSES)
        drawables.push({ y: h.y, draw: () => drawHouseSprite(ctx, houseImage, h.x, h.y, h.tier, false, t) });
      drawables.push({
        y: PLAYER_HOUSE.y,
        draw: () =>
          drawHouseSprite(ctx, houseImage, PLAYER_HOUSE.x, PLAYER_HOUSE.y, tiersRef.current.houseTier, true, t),
      });
      for (const building of BUILDINGS)
        drawables.push({ y: building.y, draw: () => drawBuildingSprite(ctx, building.sheet === "a" ? buildingImageA : buildingImageB, building) });
      for (const tr of trees)
        drawables.push({ y: tr.y, draw: () => drawTreeSprite(ctx, objectImage, tr.x, tr.y, tr.scale, tr.kind) });
      for (const animal of ANIMALS)
        drawables.push({ y: animal.y + (animal.kind === "butterfly" ? 30 : 0), draw: () => drawAnimalSprite(ctx, animalImage, animal, t) });
      for (const spot of REST_SPOTS)
        drawables.push({ y: spot.y, draw: () => drawRestSpot(ctx, spot, t) });
      for (const l of LANTERNS)
        drawables.push({
          y: l.y,
          draw: () => {
            ctx.save();
            ctx.strokeStyle = PALETTE.ink;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(l.x, l.y);
            ctx.lineTo(l.x, l.y - 46);
            ctx.stroke();
            const glow = 0.55 + Math.sin(t / 400 + l.x) * 0.18;
            ctx.globalAlpha = glow * 0.5;
            ctx.fillStyle = "#ffe9a8";
            ctx.beginPath();
            ctx.arc(l.x, l.y - 54, 26, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#ffd66e";
            ctx.beginPath();
            ctx.arc(l.x, l.y - 54, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          },
        });
      for (const npc of npcStates)
        drawables.push({
          y: npc.y,
          draw: () => {
            if (npcImage.complete && npcImage.naturalWidth > 0) {
              drawNpcSprite(ctx, npcImage, npc.x, npc.y, npc.spriteRow, npc.direction, t, npc.walking);
            } else {
              drawPerson(ctx, npc.x, npc.y, "normal", t, npc.walking);
            }
          },
        });
      drawables.push({
        y: s.y,
        draw: () => {
          if (playerImage.complete && playerImage.naturalWidth > 0) {
            drawPlayerSprite(
              ctx,
              playerImage,
              s.x,
              s.y,
              tiersRef.current.characterTier,
              s.direction,
              t,
              s.walking,
            );
          } else {
            drawPerson(ctx, s.x, s.y, tiersRef.current.characterTier, t, s.walking);
          }
        },
      });
      drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
    };
  }, [moveRef, onNearbyChange, onViewpointChange, paused]);

  return <canvas ref={canvasRef} className="h-full w-full touch-none" aria-label="Village map" />;
}
