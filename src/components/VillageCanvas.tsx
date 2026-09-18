import { useEffect, useRef, type MutableRefObject } from "react";
import type { TierId } from "@/lib/tiers";
import {
  buildColliders,
  buildTrees,
  circleBlocked,
  LANTERNS,
  NEIGHBORS,
  NEIGHBOR_HOUSES,
  PLAYER_HOUSE,
  POND,
  WORLD_H,
  WORLD_W,
  type Neighbor,
} from "@/lib/village";

interface Props {
  characterTier: TierId;
  houseTier: TierId;
  moveRef: MutableRefObject<{ x: number; y: number }>;
  onNearbyChange: (n: Neighbor | null) => void;
}

const PALETTE = {
  grassA: "#8ed081",
  grassB: "#6fbf73",
  grassDeep: "#4f9e5d",
  path: "#e6d3a3",
  pathEdge: "#cbb185",
  water: "#63c7e8",
  waterDeep: "#2f9fce",
  ink: "#26402f",
  roofPoor: "#b98a5a",
  roofNormal: "#c9573f",
  roofCool: "#4f6d7a",
  roofGold: "#f2c14e",
  wall: "#f6ecd8",
};

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

function drawHouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tier: TierId,
  mine: boolean,
  t: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = PALETTE.ink;

  // ground shadow
  ctx.fillStyle = "rgba(30,60,40,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 40, 86, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  if (tier === "sultan") {
    // fountain + marble palace
    ctx.fillStyle = "#dff3fb";
    ctx.beginPath();
    ctx.ellipse(-108, 34, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fbf7ee";
    roundRect(ctx, -80, -48, 160, 90, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.roofGold;
    ctx.beginPath();
    ctx.moveTo(-92, -48);
    ctx.lineTo(0, -104);
    ctx.lineTo(92, -48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -104, 20, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f7e6a8";
    for (let i = -1; i <= 1; i++) {
      roundRect(ctx, i * 44 - 13, -30, 26, 40, 12);
      ctx.fill();
      ctx.stroke();
    }
  } else if (tier === "cool") {
    ctx.fillStyle = "#fff8ec";
    roundRect(ctx, -70, -70, 140, 112, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.roofCool;
    ctx.beginPath();
    ctx.moveTo(-82, -70);
    ctx.lineTo(0, -116);
    ctx.lineTo(82, -70);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9fd8ef";
    for (const [wx, wy] of [
      [-40, -48],
      [16, -48],
      [-40, 2],
    ] as const) {
      roundRect(ctx, wx, wy, 34, 28, 6);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#8a5a33";
    roundRect(ctx, 22, -2, 30, 44, 5);
    ctx.fill();
    ctx.stroke();
  } else if (tier === "normal") {
    ctx.fillStyle = PALETTE.wall;
    roundRect(ctx, -62, -40, 124, 82, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.roofNormal;
    ctx.beginPath();
    ctx.moveTo(-74, -40);
    ctx.lineTo(0, -88);
    ctx.lineTo(74, -40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9fd8ef";
    roundRect(ctx, -44, -22, 30, 26, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8a5a33";
    roundRect(ctx, 12, 0, 30, 42, 5);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = "#d9b98c";
    roundRect(ctx, -54, -28, 108, 70, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.roofPoor;
    ctx.beginPath();
    ctx.moveTo(-66, -28);
    ctx.lineTo(0, -70);
    ctx.lineTo(66, -28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7a5233";
    roundRect(ctx, -12, 4, 26, 38, 4);
    ctx.fill();
    ctx.stroke();
  }

  if (mine) {
    const bob = Math.sin(t / 380) * 4;
    ctx.fillStyle = "#ffd66e";
    ctx.strokeStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(0, -132 + bob);
    ctx.lineTo(10, -120 + bob);
    ctx.lineTo(0, -108 + bob);
    ctx.lineTo(-10, -120 + bob);
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

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, s: number) {
  const sway = Math.sin(t / 700 + s) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(30,60,40,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 10, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3.5;
  ctx.fillStyle = "#8a5a33";
  roundRect(ctx, -6, -18, 12, 28, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.grassDeep;
  ctx.beginPath();
  ctx.arc(sway, -34, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#7fc98a";
  ctx.beginPath();
  ctx.arc(sway - r * 0.3, -40, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function VillageCanvas({ characterTier, houseTier, moveRef, onNearbyChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ x: 900, y: 940, walking: false });
  const tiersRef = useRef({ characterTier, houseTier });
  tiersRef.current = { characterTier, houseTier };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const trees = buildTrees();
    const colliders = buildColliders();
    const keys = new Set<string>();
    let nearby: Neighbor | null = null;
    let raf = 0;

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
      const s = stateRef.current;

      let dx = moveRef.current.x;
      let dy = moveRef.current.y;
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;
      if (keys.has("arrowup") || keys.has("w")) dy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dy += 1;
      const len = Math.hypot(dx, dy);
      s.walking = len > 0.05;
      if (s.walking) {
        const speed = 3.4;
        const nx = s.x + (dx / Math.max(len, 1)) * speed;
        const ny = s.y + (dy / Math.max(len, 1)) * speed;
        if (!circleBlocked(nx, s.y, 18, colliders)) s.x = nx;
        if (!circleBlocked(s.x, ny, 18, colliders)) s.y = ny;
      }

      const found = NEIGHBORS.find((n) => Math.hypot(n.x - s.x, n.y - s.y) < 110) ?? null;
      if (found?.name !== nearby?.name) {
        nearby = found;
        onNearbyChange(found);
      }

      const camX = Math.max(0, Math.min(WORLD_W - vw, s.x - vw / 2));
      const camY = Math.max(0, Math.min(WORLD_H - vh, s.y - vh / 2));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      ctx.save();
      ctx.translate(-camX, -camY);

      // grass
      const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      grad.addColorStop(0, PALETTE.grassA);
      grad.addColorStop(1, PALETTE.grassB);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let gx = 0; gx < WORLD_W; gx += 90) {
        for (let gy = 0; gy < WORLD_H; gy += 90) {
          ctx.fillRect(gx + ((gy / 90) % 2) * 45, gy, 44, 44);
        }
      }

      // paths
      ctx.strokeStyle = PALETTE.pathEdge;
      ctx.lineWidth = 78;
      ctx.lineCap = "round";
      const drawPaths = () => {
        ctx.beginPath();
        ctx.moveTo(150, 700);
        ctx.lineTo(1650, 700);
        ctx.moveTo(900, 200);
        ctx.lineTo(900, 1250);
        ctx.moveTo(420, 380);
        ctx.lineTo(900, 700);
        ctx.moveTo(1400, 420);
        ctx.lineTo(900, 700);
        ctx.stroke();
      };
      drawPaths();
      ctx.strokeStyle = PALETTE.path;
      ctx.lineWidth = 66;
      drawPaths();

      // plaza
      ctx.fillStyle = PALETTE.path;
      ctx.beginPath();
      ctx.arc(900, 700, 150, 0, Math.PI * 2);
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
        drawables.push({ y: h.y, draw: () => drawHouse(ctx, h.x, h.y, h.tier, false, t) });
      drawables.push({
        y: PLAYER_HOUSE.y,
        draw: () =>
          drawHouse(ctx, PLAYER_HOUSE.x, PLAYER_HOUSE.y, tiersRef.current.houseTier, true, t),
      });
      for (const tr of trees)
        drawables.push({ y: tr.y, draw: () => drawTree(ctx, tr.x, tr.y, tr.r, t, tr.seed) });
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
      for (const n of NEIGHBORS)
        drawables.push({
          y: n.y,
          draw: () => {
            drawPerson(ctx, n.x, n.y, "normal", t, false, n.hue);
            ctx.font = "600 16px ui-sans-serif, system-ui";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(20,40,30,0.75)";
            ctx.fillText(n.name, n.x, n.y - 48);
          },
        });
      drawables.push({
        y: s.y,
        draw: () => drawPerson(ctx, s.x, s.y, tiersRef.current.characterTier, t, s.walking),
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
  }, [moveRef, onNearbyChange]);

  return <canvas ref={canvasRef} className="h-full w-full touch-none" aria-label="Village map" />;
}
