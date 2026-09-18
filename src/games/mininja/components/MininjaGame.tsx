import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

// The canvas is 800px but the camera shows a 1600px world region at 0.5 scale,
// so the action reads as twice as far away.
const CANVAS = 800;
const VIEW = 1600;
const CAMERA_SCALE = CANVAS / VIEW;
const GROUND = 1160;
const PLAYER_X = 210;
const PLAYER_W = 60;
const PLAYER_H = 82;
const GRAVITY = 2200;
const JUMP_FORCE = -820;
const START_SPEED = 664;

type Phase = "ready" | "playing" | "paused" | "gameover";
type EntityKind = "crate" | "barrier" | "laser" | "spikes" | "grunt" | "drone" | "saw" | "tower" | "bat";

type Entity = {
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

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

type Game = {
  phase: Phase;
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
  particles: Particle[];
  nextId: number;
  lastTime: number;
  cityOffset: number;
};

function freshGame(phase: Phase = "ready"): Game {
  return {
    phase,
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
    particles: [],
    nextId: 1,
    lastTime: 0,
    cityOffset: 0,
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function intersects(ax: number, ay: number, aw: number, ah: number, b: Entity) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

function drawCity(ctx: CanvasRenderingContext2D, offset: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW);
  gradient.addColorStop(0, "#080b24");
  gradient.addColorStop(0.62, "#1a1243");
  gradient.addColorStop(1, "#120923");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW, VIEW);

  // Moon sits high in the sky; the distant skyline never reaches it.
  ctx.save();
  ctx.shadowColor = "#ffe93d";
  ctx.shadowBlur = 60;
  ctx.fillStyle = "#ffe83d52";
  ctx.strokeStyle = "#fff36b";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const px = 1230 + Math.cos(angle) * 120;
    const py = 250 + Math.sin(angle) * 120;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Small, low skyline layers hugging the horizon so the city feels far away.
  const layers = [
    { speed: 0.05, base: 1000, color: "#10152f", glow: "#21d4fd18", width: 74, min: 60, span: 110 },
    { speed: 0.11, base: 1065, color: "#141638", glow: "#21d4fd24", width: 64, min: 55, span: 95 },
    { speed: 0.2, base: 1135, color: "#1b153e", glow: "#ff40cc2b", width: 70, min: 50, span: 85 },
  ];
  layers.forEach((layer, layerIndex) => {
    const shift = (offset * layer.speed) % layer.width;
    for (let x = -layer.width - shift; x < VIEW + layer.width; x += layer.width) {
      const seed = Math.floor((x + shift) / layer.width) + 30;
      const h = layer.min + ((seed * 47 + layerIndex * 31) % layer.span);
      ctx.fillStyle = layer.color;
      roundRect(ctx, x, layer.base - h, layer.width - 8, h + 8, 2);
      ctx.fill();
      ctx.fillStyle = layer.glow;
      for (let wy = layer.base - h + 12; wy < layer.base - 12; wy += 18) {
        for (let wx = x + 8; wx < x + layer.width - 14; wx += 15) {
          if ((wx + wy + seed) % 3 > 0.8) ctx.fillRect(wx, wy, 5, 7);
        }
      }
      if (seed % 3 === 0) {
        ctx.strokeStyle = "#37e9ff55";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + layer.width / 2, layer.base - h);
        ctx.lineTo(x + layer.width / 2, layer.base - h - 24);
        ctx.stroke();
      }
    }
  });

  ctx.fillStyle = "#0c102a";
  ctx.fillRect(0, GROUND, VIEW, VIEW - GROUND);
  ctx.strokeStyle = "#2ceaff";
  ctx.lineWidth = 5;
  ctx.shadowColor = "#2ceaff";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(VIEW, GROUND);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "#512b77";
  ctx.lineWidth = 2;
  const floorShift = offset % 110;
  for (let x = -floorShift; x < VIEW + 110; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x - 130, VIEW);
    ctx.stroke();
  }
  for (let y = GROUND + 45; y < VIEW; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW, y);
    ctx.stroke();
  }
}

function drawNinja(ctx: CanvasRenderingContext2D, game: Game) {
  const x = PLAYER_X;
  const y = game.y;
  const isRunning = game.grounded && game.phase === "playing";
  const runPhase = game.distance * 0.095;
  const stride = isRunning ? Math.sin(runPhase) : 0;
  const bob = isRunning ? Math.abs(Math.sin(runPhase)) * 4 : 0;
  ctx.save();
  ctx.translate(x + PLAYER_W / 2, y + PLAYER_H / 2 + bob);
  ctx.rotate(isRunning ? -0.07 : 0);
  if (game.hurt > 0 && Math.floor(game.hurt * 20) % 2 === 0) ctx.globalAlpha = 0.35;

  if (isRunning) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const pulse = (game.distance * 0.7 + i * 24) % 82;
      ctx.strokeStyle = i % 2 ? "#ffe83d" : "#34edff";
      ctx.lineWidth = 3 - i * 0.35;
      ctx.beginPath();
      ctx.moveTo(-27 - pulse, -20 + i * 13);
      ctx.lineTo(-48 - pulse, -20 + i * 13);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Scarf and limbs preserve the ninja silhouette around the hexagonal body.
  ctx.strokeStyle = "#ff3ebf";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-18, -20);
  ctx.quadraticCurveTo(-32, -29 + stride * 5, -54, -18 - stride * 7);
  ctx.stroke();

  ctx.strokeStyle = "#ffd91f";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-10, 23);
  ctx.lineTo(-16 + stride * 10, 43);
  ctx.moveTo(10, 23);
  ctx.lineTo(16 - stride * 10, 43);
  ctx.stroke();
  ctx.strokeStyle = "#fff47a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-23 + stride * 10, 45);
  ctx.lineTo(-8 + stride * 10, 45);
  ctx.moveTo(8 - stride * 10, 45);
  ctx.lineTo(23 - stride * 10, 45);
  ctx.stroke();

  // Flat-topped neon-yellow hexagon player body.
  ctx.shadowColor = "#ffe83d";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#ffe83d";
  ctx.strokeStyle = "#fff7a6";
  ctx.lineWidth = 4;
  ctx.beginPath();
  const radius = 36;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Ninja mask, eyes, and belt remain readable inside the geometric body.
  ctx.fillStyle = "#12142d";
  ctx.beginPath();
  ctx.moveTo(-31, -10);
  ctx.lineTo(31, -10);
  ctx.lineTo(35, 7);
  ctx.lineTo(-35, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#45f0ff";
  ctx.shadowColor = "#45f0ff";
  ctx.shadowBlur = 9;
  ctx.fillRect(-19, -5, 13, 4);
  ctx.fillRect(6, -5, 13, 4);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#151633";
  ctx.fillRect(-28, 17, 56, 7);

  if (game.slash > 0) {
    const p = 1 - game.slash / 0.28;
    ctx.save();
    ctx.rotate(-1.3 + p * 2.3);
    ctx.strokeStyle = "#ffe83d";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(32, -1);
    ctx.stroke();
    ctx.strokeStyle = "#45f0ff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(28, -9);
    ctx.lineTo(28, 8);
    ctx.stroke();
    ctx.fillStyle = "#fff4be";
    ctx.shadowColor = "#ffe45b";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(31, -4);
    ctx.lineTo(96, -8);
    ctx.quadraticCurveTo(106, -8, 114, -16);
    ctx.quadraticCurveTo(107, -2, 96, 2);
    ctx.lineTo(31, 3);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  } else {
    ctx.strokeStyle = "#ffe83d";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(24, 5);
    ctx.lineTo(35 + stride * 7, 20 - stride * 5);
    ctx.stroke();
    ctx.strokeStyle = "#f9dd52";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(25, 12);
    ctx.lineTo(42, 38);
    ctx.stroke();
  }
  ctx.restore();
}
function drawEntity(ctx: CanvasRenderingContext2D, e: Entity) {
  ctx.save();
  if (e.kind === "crate") {
    // Crates always spawn as a double stack: two full boxes, never a half one.
    ctx.fillStyle = "#302247";
    ctx.strokeStyle = "#ff4ac8";
    ctx.lineWidth = 4;
    const bh = e.h / 2;
    for (let y = e.y; y < e.y + e.h - 1; y += bh) {
      roundRect(ctx, e.x, y, e.w, bh - 4, 5);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.x + 10, y + 10); ctx.lineTo(e.x + e.w - 10, y + bh - 14); ctx.stroke();
    }
  } else if (e.kind === "barrier") {
    ctx.fillStyle = "#29213f"; ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "#ffd84e";
    for (let y = e.y + 8; y < e.y + e.h; y += 28) ctx.fillRect(e.x + 5, y, e.w - 10, 10);
  } else if (e.kind === "laser") {
    // A compact floor-mounted trip laser: low enough to clear with one jump.
    ctx.fillStyle = "#252442";
    roundRect(ctx, e.x, e.y + 3, 20, e.h - 3, 4); ctx.fill();
    roundRect(ctx, e.x + e.w - 20, e.y + 3, 20, e.h - 3, 4); ctx.fill();
    ctx.fillStyle = "#ffd84e"; ctx.fillRect(e.x + 4, e.y + 8, 12, 6); ctx.fillRect(e.x + e.w - 16, e.y + 8, 12, 6);
    ctx.shadowColor = "#ff2c81"; ctx.shadowBlur = 18; ctx.fillStyle = "#ff387f";
    ctx.fillRect(e.x + 17, e.y + 9, e.w - 34, 7);
  } else if (e.kind === "spikes") {
    ctx.fillStyle = "#ff3e9f"; ctx.shadowColor = "#ff3e9f"; ctx.shadowBlur = 10;
    for (let x = e.x; x < e.x + e.w; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, e.y + e.h); ctx.lineTo(x + 12, e.y); ctx.lineTo(x + 24, e.y + e.h); ctx.fill();
    }
  } else if (e.kind === "grunt") {
    const stride = Math.sin(e.age * 14) * 6;
    ctx.fillStyle = "#361c4c"; ctx.strokeStyle = "#ff42c8"; ctx.lineWidth = 3;
    roundRect(ctx, e.x, e.y, e.w, e.h, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffdd4d"; ctx.fillRect(e.x + 12, e.y + 18, 12, 5); ctx.fillRect(e.x + 34, e.y + 18, 12, 5);
    ctx.strokeStyle = "#15152e"; ctx.lineWidth = 8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(e.x + 18, e.y + e.h - 7); ctx.lineTo(e.x + 14 + stride, e.y + e.h + 5); ctx.moveTo(e.x + 43, e.y + e.h - 7); ctx.lineTo(e.x + 47 - stride, e.y + e.h + 5); ctx.stroke();
    ctx.strokeStyle = e.attacking ? "#fff2a1" : "#c9f8ff"; ctx.lineWidth = 5;
    ctx.shadowColor = "#ffe45b"; ctx.shadowBlur = e.attacking ? 14 : 4;
    ctx.beginPath();
    if (e.attacking) { ctx.moveTo(e.x + 10, e.y + 31); ctx.lineTo(e.x - 43, e.y + 18); }
    else { ctx.moveTo(e.x - 7, e.y + 49); ctx.lineTo(e.x + 18, e.y + 35); }
    ctx.stroke();
  } else if (e.kind === "saw") {
    // Spinning energy saw hovering in the air.
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    const spin = e.age * 9;
    ctx.fillStyle = "#ff7a3e"; ctx.strokeStyle = "#ffd84e"; ctx.lineWidth = 3;
    ctx.shadowColor = "#ff7a3e"; ctx.shadowBlur = 14;
    for (let i = 0; i < 8; i++) {
      const a = spin + (Math.PI / 4) * i;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.22) * 17, cy + Math.sin(a - 0.22) * 17);
      ctx.lineTo(cx + Math.cos(a) * 29, cy + Math.sin(a) * 29);
      ctx.lineTo(cx + Math.cos(a + 0.22) * 17, cy + Math.sin(a + 0.22) * 17);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#20132e"; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffe254"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy + 19); ctx.lineTo(cx, cy + 19 + 6); ctx.stroke();
  } else if (e.kind === "tower") {
    // Tall stacked-crate tower; jump timing has to be exact.
    ctx.fillStyle = "#2c1f44"; ctx.strokeStyle = "#ff4ac8"; ctx.lineWidth = 4;
    for (let y = e.y; y < e.y + e.h; y += 58) {
      const bh = Math.min(58, e.y + e.h - y);
      roundRect(ctx, e.x, y, e.w, bh - 4, 5); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.x + 9, y + 9); ctx.lineTo(e.x + e.w - 9, y + bh - 13); ctx.stroke();
    }
    ctx.fillStyle = "#ffe254"; ctx.shadowColor = "#ffe254"; ctx.shadowBlur = 10;
    ctx.fillRect(e.x + e.w / 2 - 8, e.y - 14, 16, 8);
    ctx.shadowBlur = 0;
  } else if (e.kind === "bat") {
    // Neon bat gliding just above the ninja's head: safe on the ground,
    // deadly mid-jump. Flapping wings make its flight path readable.
    const flap = Math.sin(e.age * 16) * 14;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    ctx.fillStyle = "#2b1a4d"; ctx.strokeStyle = "#b44dff"; ctx.lineWidth = 3;
    ctx.shadowColor = "#b44dff"; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 2);
    ctx.lineTo(cx - e.w / 2 - 6, cy - 12 - flap);
    ctx.lineTo(cx - e.w / 2 + 4, cy + 6);
    ctx.lineTo(cx - 10, cy + 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 8, cy - 2);
    ctx.lineTo(cx + e.w / 2 + 6, cy - 12 - flap);
    ctx.lineTo(cx + e.w / 2 - 4, cy + 6);
    ctx.lineTo(cx + 10, cy + 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#3a2366";
    roundRect(ctx, cx - 13, cy - 11, 26, 24, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 9); ctx.lineTo(cx - 13, cy - 19); ctx.lineTo(cx - 4, cy - 11);
    ctx.moveTo(cx + 10, cy - 9); ctx.lineTo(cx + 13, cy - 19); ctx.lineTo(cx + 4, cy - 11);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ff4ac8"; ctx.shadowColor = "#ff4ac8"; ctx.shadowBlur = 8;
    ctx.fillRect(cx - 8, cy - 4, 5, 4); ctx.fillRect(cx + 3, cy - 4, 5, 4);
    ctx.shadowBlur = 0;
  } else if (e.kind === "drone") {
    const flap = Math.sin(e.age * 18) * 9;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    // Compact flying robot with animated thrusters, metal wings, visor, and antenna.
    ctx.fillStyle = "#202843"; ctx.strokeStyle = "#2ceaff"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 10);
    ctx.lineTo(e.x - 12, cy - 17 - flap * 0.35);
    ctx.lineTo(e.x - 16, cy + 8);
    ctx.lineTo(cx - 17, cy + 5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 18, cy - 10);
    ctx.lineTo(e.x + e.w + 12, cy - 17 - flap * 0.35);
    ctx.lineTo(e.x + e.w + 16, cy + 8);
    ctx.lineTo(cx + 17, cy + 5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#303a5d";
    roundRect(ctx, cx - 22, cy - 20, 44, 38, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#11182f";
    roundRect(ctx, cx - 16, cy - 12, 32, 14, 5); ctx.fill();
    ctx.fillStyle = "#ffe254"; ctx.shadowColor = "#ffe254"; ctx.shadowBlur = 10;
    ctx.fillRect(cx - 11, cy - 8, 8, 5); ctx.fillRect(cx + 3, cy - 8, 8, 5);
    ctx.shadowBlur = 0; ctx.strokeStyle = "#2ceaff"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + 5, cy - 31); ctx.stroke();
    ctx.fillStyle = "#ffdd4d"; ctx.beginPath(); ctx.arc(cx + 6, cy - 33, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#25304d";
    roundRect(ctx, cx - 17, cy + 18, 12, 8, 3); ctx.fill(); ctx.stroke();
    roundRect(ctx, cx + 5, cy + 18, 12, 8, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#35eaff"; ctx.shadowColor = "#35eaff"; ctx.shadowBlur = 12;
    const thrust = 8 + Math.abs(flap) * 0.45;
    ctx.beginPath(); ctx.moveTo(cx - 15, cy + 26); ctx.lineTo(cx - 11, cy + 26 + thrust); ctx.lineTo(cx - 7, cy + 26); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 7, cy + 26); ctx.lineTo(cx + 11, cy + 26 + thrust); ctx.lineTo(cx + 15, cy + 26); ctx.fill();
    if (e.attacking) {
      ctx.strokeStyle = "#ffe254"; ctx.lineWidth = 4; ctx.shadowColor = "#ffe254"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(cx - 20, cy + 4); ctx.lineTo(e.x - 30, cy + 12); ctx.stroke();
    }
  }
  ctx.restore();
}


function IconGlyph({ kind }: { kind: EntityKind }) {
  const shapes: Record<EntityKind, ReactElement> = {
    crate: <><rect x="4" y="3" width="16" height="9" fill="#ff4fd8" stroke="#ffe254" strokeWidth="1.2" /><rect x="4" y="13" width="16" height="8" fill="#ff4fd8" stroke="#ffe254" strokeWidth="1.2" /></>,
    barrier: <><rect x="7" y="3" width="10" height="18" fill="#ff4fd8" /><path d="M7 8h10M7 13h10M7 18h10" stroke="#140f2b" strokeWidth="2" /></>,
    spikes: <path d="M2 20l4-8 4 8 4-8 4 8z" fill="#ff4fd8" stroke="#ffe254" strokeWidth="1.2" />,
    laser: <><rect x="2" y="13" width="20" height="3" fill="#ff3b6b" /><circle cx="3" cy="14.5" r="2.5" fill="#ffe254" /><circle cx="21" cy="14.5" r="2.5" fill="#ffe254" /></>,
    tower: <><rect x="6" y="2" width="12" height="8" fill="#ff4fd8" stroke="#ffe254" strokeWidth="1.2" /><rect x="6" y="12" width="12" height="9" fill="#ff4fd8" stroke="#ffe254" strokeWidth="1.2" /></>,
    saw: <><circle cx="12" cy="12" r="7" fill="none" stroke="#ffe254" strokeWidth="2.5" strokeDasharray="3 2.5" /><circle cx="12" cy="12" r="2.5" fill="#ff4fd8" /></>,
    grunt: <><rect x="6" y="6" width="12" height="11" rx="2" fill="#35eaff" /><circle cx="10" cy="11" r="1.6" fill="#140f2b" /><circle cx="14" cy="11" r="1.6" fill="#140f2b" /><path d="M8 17v4M16 17v4" stroke="#35eaff" strokeWidth="2" /></>,
    drone: <><rect x="6" y="9" width="12" height="7" rx="3" fill="#35eaff" /><path d="M3 7h6M15 7h6" stroke="#ffe254" strokeWidth="2" /><circle cx="12" cy="12.5" r="2" fill="#140f2b" /></>,
    bat: <><path d="M2 10c4-4 6 2 10 2s6-6 10-2c-3 1-3 5-6 6-2-2-6-2-8 0-3-1-3-5-6-6z" fill="#a855f7" /><circle cx="10" cy="12" r="1" fill="#ffe254" /><circle cx="14" cy="12" r="1" fill="#ffe254" /></>,
  };
  return <svg className="tut-icon" viewBox="0 0 24 24" aria-hidden="true">{shapes[kind]}</svg>;
}

function spawn(game: Game) {
  // Difficulty keeps climbing with survival time: faster, tighter, busier,
  // and new obstacle varieties unlock the longer the run lasts.
  const difficulty = Math.min(1, game.activeTime / 90);
  const roll = Math.random();
  let kind: EntityKind;
  // Obstacles are far more common than enemies (about 3 out of 4 spawns).
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
    crate: [60, 116, GROUND - 116], barrier: [45, 108, GROUND - 108],
    spikes: [76, 36, GROUND - 36],
    laser: [88, 28, GROUND - 28], grunt: [62, 72, GROUND - 72],
    drone: [72, 48, GROUND - 155],
    tower: [60, 120, GROUND - 120],
    saw: [56, 56, GROUND - 150],
    // Bat hovers just above a standing ninja's head: only a jump connects.
    bat: [52, 44, GROUND - 135],
  };
  const [w, h, y] = specs[kind];
  game.entities.push({ id: game.nextId++, kind, x: VIEW + 25, y, w, h, age: 0, baseY: y });
  // Spacing is distance-based, so increasing speed can never create an
  // impossible pair of obstacles. A physics guard guarantees the ninja can
  // always land from one jump and take off again before the next obstacle:
  // tall obstacles (barrier/tower) demand extra runway because the ninja is
  // still rising when the next one arrives.
  const tall = kind === "barrier" || kind === "tower" || kind === "crate";
  const airtime = (2 * -JUMP_FORCE) / GRAVITY; // full jump flight time (~0.75s)
  const guaranteed = Math.max(
    game.speed * 0.3,
    game.speed * (airtime + (tall ? 0.18 : 0.03)) - w + 30,
  );
  const desired = game.speed * (0.44 + (1 - difficulty) * 0.1);
  const recoveryDistance = Math.max(guaranteed, desired);
  const clearDistance = w + recoveryDistance + 12;
  const variationDistance = (10 + Math.random() * 58) * (1 - difficulty * 0.8);
  game.spawnIn = (clearDistance + variationDistance) / game.speed;
}

function synth(type: "jump" | "slash" | "hit" | "kill", muted: boolean) {
  if (muted || typeof window === "undefined") return;
  const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const audio = new AudioCtx();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  const tones: Record<typeof type, [number, number, number]> = {
    jump: [260, 520, 0.11],
    slash: [760, 180, 0.08],
    hit: [120, 42, 0.2],
    kill: [420, 900, 0.09],
  };
  const config = tones[type];
  osc.type = type === "hit" ? "sawtooth" : "square";
  osc.frequency.setValueAtTime(config[0], now);
  osc.frequency.exponentialRampToValueAtTime(config[1], now + config[2]);
  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + config[2]);
  osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(now + config[2]);
  window.setTimeout(() => audio.close(), 350);
}

export function MininjaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(freshGame());
  const mutedRef = useRef(false);
  const bestRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(false);

  const start = useCallback(() => {
    if (typeof window !== "undefined") {
      bestRef.current = Number(window.localStorage.getItem("neon-ninja-best") ?? 0);
    }
    gameRef.current = freshGame("playing");
    setScore(0);
    setPhase("playing");
  }, []);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (g.phase === "ready" || g.phase === "gameover") { start(); return; }
    if (g.phase !== "playing" || !g.grounded) return;
    g.vy = JUMP_FORCE; g.grounded = false;
    synth("jump", mutedRef.current);
  }, [start]);

  const slash = useCallback(() => {
    const g = gameRef.current;
    if (g.phase === "ready" || g.phase === "gameover") { start(); return; }
    if (g.phase !== "playing" || g.slash > 0.05) return;
    g.slash = 0.28;
    synth("slash", mutedRef.current);
  }, [start]);

  const exitToMenu = useCallback(() => {
    gameRef.current = freshGame("ready");
    setScore(0);
    setPhase("ready");
  }, []);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (g.phase === "playing") { g.phase = "paused"; setPhase("paused"); }
    else if (g.phase === "paused") { g.phase = "playing"; g.lastTime = 0; setPhase("playing"); }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "KeyX", "KeyP"].includes(e.code)) e.preventDefault();
      if (e.code === "Space" || e.code === "ArrowUp") jump();
      if (e.code === "KeyX") slash();
      if (e.code === "KeyP") togglePause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump, slash, togglePause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let hudTick = 0;

    const drawOverlay = (g: Game) => {
      if (g.phase === "playing") return;
      ctx.fillStyle = "#050615b8"; ctx.fillRect(0, 0, CANVAS, CANVAS);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe83d"; ctx.font = "800 40px sans-serif";
      const title = g.phase === "ready" ? "NIMIQ MININJA" : g.phase === "paused" ? "PAUSED" : "MISSION FAILED";
      ctx.fillText(title, CANVAS / 2, 315);
      ctx.fillStyle = "#55efff"; ctx.font = "700 20px sans-serif";
      ctx.fillText(g.phase === "ready" ? "Run. Jump. Slash." : g.phase === "paused" ? "Press P to resume" : `Score ${Math.floor(g.score)}`, CANVAS / 2, 355);

      if (g.phase === "gameover") {
        ctx.fillStyle = "#ffe83d"; ctx.font = "700 18px sans-serif";
        ctx.fillText(`Best Score ${bestRef.current}`, CANVAS / 2, 385);
      }
      ctx.fillStyle = "#ffffffaa"; ctx.font = "600 16px sans-serif";
      ctx.fillText(g.phase === "gameover" ? "Press RETRY to run again" : g.phase === "ready" ? "Press START below the arena" : "", CANVAS / 2, 418);
    };

    const loop = (time: number) => {
      const g = gameRef.current;
      const dt = g.lastTime ? Math.min((time - g.lastTime) / 1000, 0.035) : 0;
      g.lastTime = time;
      if (g.phase === "playing") {
        g.activeTime += dt;
        // Speed ramps up continuously the longer the run lasts.
        g.speed = START_SPEED * Math.min(2.8, 1 + Math.floor(g.activeTime / 2.4) * 0.3);
        g.distance += g.speed * dt;
        g.cityOffset += g.speed * dt;
        g.score += dt * (12 + g.speed / 40);
        g.spawnIn -= dt;
        if (g.spawnIn <= 0) spawn(g);
        if (!g.grounded) {
          g.vy += GRAVITY * dt;
          g.y += g.vy * dt;
          if (g.y >= GROUND - PLAYER_H) { g.y = GROUND - PLAYER_H; g.vy = 0; g.grounded = true; }
        }
        g.slash = Math.max(0, g.slash - dt);
        g.hurt = Math.max(0, g.hurt - dt);
        g.entities.forEach((e) => {
          e.x -= g.speed * dt;
          e.age += dt;
          if (e.kind === "saw" && e.baseY !== undefined) {
            // The saw bobs up and down, forcing tighter jump timing.
            e.y = e.baseY + Math.sin(e.age * 3.1) * 42;
            e.x -= 40 * dt;
          }
          if (e.kind === "bat" && e.baseY !== undefined) {
            // Gentle glide with small bobs, always staying above head height
            // so running under it is safe and jumping is not.
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
            const blade = { x: PLAYER_X + 35, y: g.y - 10, w: 115, h: PLAYER_H + 28 };
            if (intersects(blade.x, blade.y, blade.w, blade.h, e)) {
              e.dead = true; g.kills += 1; g.score += 75; synth("kill", mutedRef.current);
              for (let i = 0; i < 13; i++) g.particles.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: -120 + Math.random() * 250, vy: -180 + Math.random() * 260, life: 0.45, color: i % 2 ? "#ff43c7" : "#34edff", size: 3 + Math.random() * 5 });
            }
          }
          const hitSolid = intersects(PLAYER_X + 9, g.y + 8, PLAYER_W - 18, PLAYER_H - 8, e);
          if (!e.dead && hitSolid) {
            g.phase = "gameover"; g.hurt = 0.6; synth("hit", mutedRef.current);
            const finalScore = Math.floor(g.score);
            const savedBest = Number(window.localStorage.getItem("neon-ninja-best") ?? 0);
            const nextBest = Math.max(savedBest, finalScore);
            window.localStorage.setItem("neon-ninja-best", String(nextBest));
            bestRef.current = nextBest;
            setScore(finalScore); setPhase("gameover");
          }
        });
        g.entities = g.entities.filter((e) => e.x + e.w > -30 && !e.dead);
        g.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; });
        g.particles = g.particles.filter((p) => p.life > 0).slice(-60);
        hudTick += dt;
        if (hudTick > 0.12) { setScore(Math.floor(g.score)); hudTick = 0; }
      }

      // World is drawn zoomed out; HUD and overlays stay in canvas pixel space.
      ctx.setTransform(CAMERA_SCALE, 0, 0, CAMERA_SCALE, 0, 0);
      drawCity(ctx, g.cityOffset);
      g.entities.forEach((e) => drawEntity(ctx, e));
      g.particles.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1; });
      drawNinja(ctx, g);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = "left"; ctx.fillStyle = "#eafbff"; ctx.font = "800 24px sans-serif"; ctx.fillText(String(Math.floor(g.score)).padStart(6, "0"), 30, 48);
      ctx.fillStyle = "#44ebff"; ctx.font = "700 14px sans-serif"; ctx.fillText(`LEVEL ${1 + Math.floor(g.activeTime / 15)}`, 31, 71);
      drawOverlay(g);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const setSound = () => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); };

  return (
    <main className="game-shell">
      <header className="game-header">
        <div>
          <p className="eyebrow">SECTOR 09 // NIGHT RUN</p>
          <h1>NIMIQ MININJA</h1>
        </div>
        <div className="header-actions">
          
          <button className="icon-button" type="button" onClick={setSound} aria-label={muted ? "Unmute sound" : "Mute sound"} title={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button className="icon-button" type="button" onClick={togglePause} aria-label={phase === "paused" ? "Resume game" : "Pause game"} title={phase === "paused" ? "Resume" : "Pause"} disabled={phase === "ready" || phase === "gameover"}>
            {phase === "paused" ? <Play /> : <Pause />}
          </button>
        </div>
      </header>

      <section className="arena-wrap" aria-label="Nimiq Mininja play area" hidden={phase === "ready"}>
        <canvas ref={canvasRef} width={CANVAS} height={CANVAS} className="game-canvas" />
      </section>

      {phase === "ready" && (
        <section className="tutorial-panel" aria-label="How to play, obstacles and enemies">
          <div className="tutorial-block">
            <h2>OBSTACLES — JUMP THEM!</h2>
            <ul>
              <li><IconGlyph kind="crate" /><span className="tag pink">CRATE</span> Double neon box stack — always two full boxes, never half. How to beat: jump over it with a full jump.</li>
              <li><IconGlyph kind="barrier" /><span className="tag pink">BARRIER</span> Tall striped block. How to beat: jump earlier than you think.</li>
              <li><IconGlyph kind="spikes" /><span className="tag pink">SPIKES</span> Low jagged mine. How to beat: a quick short jump.</li>
              <li><IconGlyph kind="laser" /><span className="tag pink">LASER</span> Thin beam on the floor. How to beat: jump over the beam.</li>
              <li><IconGlyph kind="tower" /><span className="tag pink">TOWER</span> High crate stack. How to beat: jump at the last moment for full height.</li>
              <li><IconGlyph kind="saw" /><span className="tag pink">SAW</span> Flying saw bobbing up and down. How to beat: time your jump when it rises — or simply stay on the ground and it passes safely.</li>
            </ul>
          </div>
          <div className="tutorial-block">
            <h2>ENEMIES — SLASH THEM!</h2>
            <ul>
              <li><IconGlyph kind="grunt" /><span className="tag cyan">GRUNT</span> Ground robot charging at you. How to beat: slash as it closes in — or jump it.</li>
              <li><IconGlyph kind="drone" /><span className="tag cyan">DRONE</span> Flying robot that matches your height. How to beat: slash it mid-air or stay low and run under.</li>
            </ul>
            <h2>WATCH OUT!</h2>
            <ul>
              <li><IconGlyph kind="bat" /><span className="tag purple">BAT</span> Flies just above your head. How to beat: <b>do NOT jump</b> — keep running and it passes overhead!</li>
            </ul>
          </div>
        </section>
      )}

      <section className="controls" aria-label="Game controls">
        {phase === "ready" ? (
          <button type="button" className="start-button" onClick={start}><Play aria-hidden="true" /> START MISSION</button>
        ) : phase === "gameover" ? (
          <>
            <button type="button" className="start-button restart" onClick={start}><RotateCcw aria-hidden="true" /> RETRY</button>
            <button type="button" className="start-button exit" onClick={exitToMenu}>EXIT TO MENU</button>
          </>
        ) : (
          <>
            <button type="button" className="control-button jump" onPointerDown={(e) => { e.preventDefault(); jump(); }}>
              <span className="control-icon">↑</span><span><b>JUMP</b><small>SPACE</small></span>
            </button>
            <button type="button" className="control-button slash" onPointerDown={(e) => { e.preventDefault(); slash(); }}>
              <span className="control-icon">⚔</span><span><b>SLASH</b><small>X</small></span>
            </button>
          </>
        )}
      </section>
      <p className="mission-line"><span /> Dodge obstacles · Slash enemies · Survive as long as you can <span /></p>
    </main>
  );
}
