import * as THREE from "three";

export const TRACK_HALF_WIDTH = 9;
export const SAMPLES = 624;
export const TRACK_LENGTH_SCALE = 1.3;

const BASE_CONTROL: [number, number][] = [
  [0, 90],
  [46, 84],
  [72, 54],
  [66, 18],
  [36, 2],
  [10, -18],
  [22, -52],
  [62, -70],
  [64, -104],
  [26, -122],
  [-22, -118],
  [-52, -94],
  [-48, -58],
  [-20, -40],
  [-30, -8],
  [-70, 4],
  [-84, 40],
  [-58, 78],
];

const CONTROL: [number, number][] = BASE_CONTROL.map(([x, z]) => [
  x * TRACK_LENGTH_SCALE,
  z * TRACK_LENGTH_SCALE,
]);

export type TrackData = {
  points: THREE.Vector2[];
  rights: THREE.Vector2[];
  tangents: THREE.Vector2[];
  count: number;
};

let cached: TrackData | null = null;

export function getTrack(): TrackData {
  if (cached) return cached;

  const curve = new THREE.CatmullRomCurve3(
    CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    "catmullrom",
    0.5,
  );

  const points: THREE.Vector2[] = [];
  const tangents: THREE.Vector2[] = [];
  const rights: THREE.Vector2[] = [];

  for (let i = 0; i < SAMPLES; i++) {
    const t = i / SAMPLES;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    points.push(new THREE.Vector2(p.x, p.z));
    const tv = new THREE.Vector2(tan.x, tan.z).normalize();
    tangents.push(tv);
    rights.push(new THREE.Vector2(tv.y, -tv.x));
  }

  cached = { points, rights, tangents, count: SAMPLES };
  return cached;
}

/** Nearest centerline sample, searched locally around a hint index. */
export function nearestIndex(px: number, pz: number, hint: number): number {
  const { points, count } = getTrack();
  let best = hint;
  let bestDist = Infinity;
  for (let k = -14; k <= 26; k++) {
    const j = ((hint + k) % count + count) % count;
    const p = points[j]!;
    const dx = px - p.x;
    const dz = pz - p.y;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = j;
    }
  }
  return best;
}

export function globalNearestIndex(px: number, pz: number): number {
  const { points, count } = getTrack();
  let best = 0;
  let bestDist = Infinity;
  for (let j = 0; j < count; j++) {
    const p = points[j]!;
    const d = (px - p.x) ** 2 + (pz - p.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = j;
    }
  }
  return best;
}

export type TrackHit = {
  index: number;
  lateral: number;
  offTrack: boolean;
  pushX: number;
  pushZ: number;
};

export function trackCollide(px: number, pz: number, hint: number): TrackHit {
  const { points, rights } = getTrack();
  const index = nearestIndex(px, pz, hint);
  const p = points[index]!;
  const r = rights[index]!;
  const lateral = (px - p.x) * r.x + (pz - p.y) * r.y;
  const limit = TRACK_HALF_WIDTH - 1.2;
  if (Math.abs(lateral) > limit) {
    const sign = Math.sign(lateral);
    const push = Math.abs(lateral) - limit;
    return {
      index,
      lateral,
      offTrack: true,
      pushX: -sign * r.x * push,
      pushZ: -sign * r.y * push,
    };
  }
  return { index, lateral, offTrack: false, pushX: 0, pushZ: 0 };
}

/** Spawn pose on the grid, a little before the start line. */
export function gridPose(slot: number) {
  const { points, tangents, rights } = getTrack();
  const row = Math.floor(slot / 2);
  const side = slot % 2 === 0 ? -1 : 1;
  const idx = (SAMPLES - 12 - row * 9 + SAMPLES) % SAMPLES;
  const p = points[idx]!;
  const r = rights[idx]!;
  const t = tangents[idx]!;
  return {
    x: p.x + r.x * side * 3.4,
    z: p.y + r.y * side * 3.4,
    yaw: Math.atan2(t.x, t.y),
    index: idx,
  };
}

function ribbon(
  inner: (i: number) => [number, number],
  outer: (i: number) => [number, number],
  colorAt: (i: number) => [number, number, number],
  y: number,
) {
  const { count } = getTrack();
  const pos: number[] = [];
  const col: number[] = [];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const [ax, az] = inner(i);
    const [bx, bz] = outer(i);
    const [cx, cz] = inner(j);
    const [dx, dz] = outer(j);
    const c = colorAt(i);
    const push = (x: number, z: number) => {
      pos.push(x, y, z);
      col.push(c[0], c[1], c[2]);
    };
    push(ax, az);
    push(bx, bz);
    push(dx, dz);
    push(ax, az);
    push(dx, dz);
    push(cx, cz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return geo;
}

export function buildRoadGeometry() {
  const { points, rights } = getTrack();
  const at = (i: number, off: number): [number, number] => {
    const p = points[i]!;
    const r = rights[i]!;
    return [p.x + r.x * off, p.y + r.y * off];
  };
  return ribbon(
    (i) => at(i, -TRACK_HALF_WIDTH),
    (i) => at(i, TRACK_HALF_WIDTH),
    (i) => (i % 2 === 0 ? [0.075, 0.09, 0.12] : [0.06, 0.07, 0.1]),
    0.02,
  );
}

export function buildCurbGeometry(side: 1 | -1) {
  const { points, rights } = getTrack();
  const at = (i: number, off: number): [number, number] => {
    const p = points[i]!;
    const r = rights[i]!;
    return [p.x + r.x * off, p.y + r.y * off];
  };
  return ribbon(
    (i) => at(i, side * TRACK_HALF_WIDTH),
    (i) => at(i, side * (TRACK_HALF_WIDTH + 1.6)),
    (i) =>
      Math.floor(i / 5) % 2 === 0
        ? [0.02, 0.9, 1]
        : [1, 0.34, 0.08],
    0.06,
  );
}

export function buildCenterLineGeometry() {
  const { points, rights } = getTrack();
  const pos: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    if (Math.floor(i / 4) % 2 !== 0) continue;
    const j = (i + 1) % SAMPLES;
    const p = points[i]!;
    const r = rights[i]!;
    const q = points[j]!;
    const r2 = rights[j]!;
    const w = 0.22;
    const a = [p.x - r.x * w, p.y - r.y * w];
    const b = [p.x + r.x * w, p.y + r.y * w];
    const c = [q.x - r2.x * w, q.y - r2.y * w];
    const d = [q.x + r2.x * w, q.y + r2.y * w];
    pos.push(a[0]!, 0, a[1]!, b[0]!, 0, b[1]!, d[0]!, 0, d[1]!);
    pos.push(a[0]!, 0, a[1]!, d[0]!, 0, d[1]!, c[0]!, 0, c[1]!);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Deterministic scenery placement outside the track. */
export function buildScenery() {
  const { points, rights } = getTrack();
  const trees: { x: number; z: number; s: number; kind: number }[] = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const clear = TRACK_HALF_WIDTH + 5;
  const onTrack = (x: number, z: number) => {
    for (let j = 0; j < SAMPLES; j += 2) {
      const q = points[j]!;
      if ((x - q.x) ** 2 + (z - q.y) ** 2 < clear * clear) return true;
    }
    return false;
  };
  for (let i = 0; i < SAMPLES; i += 6) {
    const p = points[i]!;
    const r = rights[i]!;
    for (const side of [-1, 1]) {
      if (rand() > 0.55) continue;
      const off = side * (TRACK_HALF_WIDTH + 8 + rand() * 22);
      const x = p.x + r.x * off + (rand() - 0.5) * 4;
      const z = p.y + r.y * off + (rand() - 0.5) * 4;
      // never let scenery land on any part of the circuit
      if (onTrack(x, z)) continue;
      trees.push({
        x,
        z,
        s: 0.7 + rand() * 0.9,
        kind: rand() > 0.7 ? 1 : 0,
      });
    }
  }
  return trees;
}
