export const GAME_W = 778;
export const GAME_H = 972;

// Board play area
export const BOARD_X = 44;
export const BOARD_Y = 176;
export const BOARD_SIZE = 690;
export const BOARD_R = BOARD_X + BOARD_SIZE; // right
export const BOARD_B = BOARD_Y + BOARD_SIZE; // bottom

export const PIECE_R = 15;
export const STRIKER_R = 19;
export const POCKET_R = 30;
export const CPU_STRIKER_LINE_Y = BOARD_Y + 78;
export const STRIKER_LINE_Y = BOARD_B - 78;
export const STRIKER_MIN_X = BOARD_X + 110;
export const STRIKER_MAX_X = BOARD_R - 110;

export const MAX_POWER = 2250;

export type PieceKind = "white" | "orange" | "queen" | "striker" | "block";

export interface Piece {
  id: number;
  kind: PieceKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alive: boolean;
  static?: boolean;
}

export const CX = BOARD_X + BOARD_SIZE / 2;
export const CY = BOARD_Y + BOARD_SIZE / 2;

function ring(count: number, radius: number, kinds: PieceKind[], offset = 0) {
  const out: Omit<Piece, "id" | "vx" | "vy" | "alive">[] = [];
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * Math.PI * 2;
    out.push({
      kind: kinds[i % kinds.length] ?? "white",
      x: CX + Math.cos(a) * radius,
      y: CY + Math.sin(a) * radius,
      r: PIECE_R,
    });
  }
  return out;
}


export const POCKETS = [
  { x: BOARD_X + 34, y: BOARD_Y + 34 },
  { x: BOARD_R - 34, y: BOARD_Y + 34 },
  { x: BOARD_X + 34, y: BOARD_B - 34 },
  { x: BOARD_R - 34, y: BOARD_B - 34 },
];

export function createPieces(): Piece[] {
  let id = 1;
  const layout: Omit<Piece, "id" | "vx" | "vy" | "alive">[] = [
    { kind: "queen", x: CX, y: CY, r: PIECE_R },
    ...ring(6, 34, ["white", "orange"]),
    ...ring(12, 66, ["orange", "white"], Math.PI / 6),
  ];
  const pieces: Piece[] = layout.map((p) => ({ ...p, id: id++, vx: 0, vy: 0, alive: true }));
  pieces.push({
    id: 0,
    kind: "striker",
    x: CX,
    y: STRIKER_LINE_Y,
    vx: 0,
    vy: 0,
    r: STRIKER_R,
    alive: true,
  });
  return pieces;
}

export interface StepResult {
  pocketed: Piece[];
  /** speed = impact strength, wall = rail bounce instead of piece-on-piece */
  hits: { x: number; y: number; speed: number; wall?: boolean }[];
  moving: boolean;
}

const STRIKER_WALL_BOUNCE = 1.62;
const PIECE_WALL_BOUNCE = 0.63;

export function stepPhysics(pieces: Piece[], dt: number): StepResult {
  const pocketed: Piece[] = [];
  const hits: { x: number; y: number; speed: number; wall?: boolean }[] = [];

  for (const p of pieces) {
    if (!p.alive || p.static) continue;
    const wallBounce = p.kind === "striker" ? STRIKER_WALL_BOUNCE : PIECE_WALL_BOUNCE;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const damp = Math.exp(-1.8 * dt);
    p.vx *= damp;
    p.vy *= damp;
    if (Math.hypot(p.vx, p.vy) < 16) {
      p.vx = 0;
      p.vy = 0;
    }

    // walls
    if (p.x - p.r < BOARD_X) {
      p.x = BOARD_X + p.r;
      if (Math.abs(p.vx) > 40) hits.push({ x: p.x, y: p.y, speed: Math.abs(p.vx), wall: true });
      p.vx = Math.abs(p.vx) * wallBounce;
    } else if (p.x + p.r > BOARD_R) {
      p.x = BOARD_R - p.r;
      if (Math.abs(p.vx) > 40) hits.push({ x: p.x, y: p.y, speed: Math.abs(p.vx), wall: true });
      p.vx = -Math.abs(p.vx) * wallBounce;
    }
    if (p.y - p.r < BOARD_Y) {
      p.y = BOARD_Y + p.r;
      if (Math.abs(p.vy) > 40) hits.push({ x: p.x, y: p.y, speed: Math.abs(p.vy), wall: true });
      p.vy = Math.abs(p.vy) * wallBounce;
    } else if (p.y + p.r > BOARD_B) {
      p.y = BOARD_B - p.r;
      if (Math.abs(p.vy) > 40) hits.push({ x: p.x, y: p.y, speed: Math.abs(p.vy), wall: true });
      p.vy = -Math.abs(p.vy) * wallBounce;
    }
  }

  // collisions
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i];
    if (!a) continue;
    if (!a.alive) continue;
    for (let j = i + 1; j < pieces.length; j++) {
      const b = pieces[j];
      if (!b) continue;
      if (!b.alive) continue;
      if (a.static && b.static) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (dist === 0 || dist >= min) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = min - dist;

      if (a.static) {
        b.x += nx * overlap;
        b.y += ny * overlap;
        const vn = b.vx * nx + b.vy * ny;
        b.vx -= 2 * vn * nx * 0.95;
        b.vy -= 2 * vn * ny * 0.95;
      } else if (b.static) {
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        const vn = a.vx * nx + a.vy * ny;
        a.vx -= 2 * vn * nx * 0.95;
        a.vy -= 2 * vn * ny * 0.95;
      } else {
        a.x -= (nx * overlap) / 2;
        a.y -= (ny * overlap) / 2;
        b.x += (nx * overlap) / 2;
        b.y += (ny * overlap) / 2;
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const imp = -(1 + 0.98) * vn * 0.5;
          a.vx -= imp * nx;
          a.vy -= imp * ny;
          b.vx += imp * nx;
          b.vy += imp * ny;
        }
      }
      const relSpeed = Math.abs((b.vx - a.vx) * nx + (b.vy - a.vy) * ny);
      hits.push({ x: a.x + nx * a.r, y: a.y + ny * a.r, speed: relSpeed });
    }
  }

  // pockets
  for (const p of pieces) {
    if (!p.alive || p.static) continue;
    for (const k of POCKETS) {
      if (Math.hypot(p.x - k.x, p.y - k.y) < POCKET_R * 0.85) {
        p.alive = false;
        p.vx = 0;
        p.vy = 0;
        pocketed.push(p);
        break;
      }
    }
  }

  const moving = pieces.some(
    (p) => p.alive && !p.static && (p.vx !== 0 || p.vy !== 0),
  );
  return { pocketed, hits, moving };
}

export function aimPreview(x: number, y: number, dirX: number, dirY: number, r: number) {
  // Ray from striker, one reflection on board walls
  const pts: { x: number; y: number }[] = [{ x, y }];
  let px = x;
  let py = y;
  let dx = dirX;
  let dy = dirY;
  for (let bounce = 0; bounce < 2; bounce++) {
    let t = 900;
    let axis: "x" | "y" = "x";
    if (dx > 0) {
      const tt = (BOARD_R - r - px) / dx;
      if (tt > 0 && tt < t) {
        t = tt;
        axis = "x";
      }
    } else if (dx < 0) {
      const tt = (BOARD_X + r - px) / dx;
      if (tt > 0 && tt < t) {
        t = tt;
        axis = "x";
      }
    }
    if (dy > 0) {
      const tt = (BOARD_B - r - py) / dy;
      if (tt > 0 && tt < t) {
        t = tt;
        axis = "y";
      }
    } else if (dy < 0) {
      const tt = (BOARD_Y + r - py) / dy;
      if (tt > 0 && tt < t) {
        t = tt;
        axis = "y";
      }
    }
    const len = bounce === 0 ? Math.min(t, 420) : Math.min(t, 200);
    px += dx * len;
    py += dy * len;
    pts.push({ x: px, y: py });
    if (len < t) break;
    if (axis === "x") dx = -dx;
    else dy = -dy;
  }
  return pts;
}
