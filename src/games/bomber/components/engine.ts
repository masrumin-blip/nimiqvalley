// Nimiq-Bomber game engine: grid, bombs, flames, viruses, CPU bombers, power-ups.
// Supports three modes: virus hunt, battle vs CPU bombers, local multiplayer.

export const COLS = 15;
export const ROWS = 13;
export const TILE = 32;
export const W = COLS * TILE;
export const H = ROWS * TILE;

export type Difficulty = "easy" | "medium" | "hard";
export type Mode = "virus" | "cpu" | "multi";

export type PowerType = "fire" | "bomb" | "speed" | "glove" | "remote" | "vest";

export const POWER_LABEL: Record<PowerType, string> = {
  fire: "Fire",
  bomb: "Bomb",
  speed: "Boots",
  glove: "Glove",
  remote: "Detonator",
  vest: "Vest",
};

export type Cell = 0 | 1 | 2; // empty | hard wall | soft block

export interface BomberSkin {
  body: string;
  trim: string;
  legs: string;
  panel: string;
}

export const BOMBER_SKINS: BomberSkin[] = [
  { body: "#f4c430", trim: "#fff0a3", legs: "#725800", panel: "#b98500" },
  { body: "#4aa8ff", trim: "#d3ecff", legs: "#134b7d", panel: "#1e70b8" },
  { body: "#ff5d8f", trim: "#ffd4e2", legs: "#7d1c3c", panel: "#c23a68" },
  { body: "#5ddb8b", trim: "#d6ffe6", legs: "#1c6b3c", panel: "#2f9c5e" },
];

export const BOMBER_NAMES = ["P1", "P2", "P3", "P4"];
export const CPU_NAMES = ["P1", "CPU-1", "CPU-2", "CPU-3"];

export interface BomberHud {
  id: number;
  name: string;
  color: string;
  alive: boolean;
  lives: number;
  score: number;
  range: number;
  maxBombs: number;
  speedLevel: number;
  glove: boolean;
  remote: boolean;
  vest: boolean;
  cpu: boolean;
}

export interface HudState {
  mode: Mode;
  difficulty: Difficulty;
  status: "playing" | "won" | "lost" | "draw";
  winner: string | null;
  enemiesLeft: number;
  best: number;
  score: number;
  lives: number;
  bombers: BomberHud[];
}

interface Bomb {
  cx: number;
  cy: number;
  timer: number;
  range: number;
  remote: boolean;
  owner: number;
  slide: { dx: number; dy: number } | null;
  px: number;
  py: number;
}

interface Flame {
  cx: number;
  cy: number;
  t: number;
  kind: "center" | "arm";
  dir: number;
}

interface Enemy {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  kind: 0 | 1 | 2;
  alive: boolean;
  wobble: number;
  smart: boolean;
}

interface Item {
  cx: number;
  cy: number;
  type: PowerType;
  t: number;
}

export interface Bomber {
  id: number;
  name: string;
  skin: BomberSkin;
  cpu: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  facing: number;
  walkAnim: number;
  alive: boolean;
  lives: number;
  score: number;
  range: number;
  maxBombs: number;
  speedLevel: number;
  glove: boolean;
  remote: boolean;
  vest: boolean;
  invuln: number;
  spawn: { cx: number; cy: number };
  ignoreBomb: Bomb | null;
  think: number;
  wantBomb: boolean;
}

const DIFF: Record<
  Difficulty,
  { enemies: number; speed: number; smartRatio: number; blockRatio: number }
> = {
  easy: { enemies: 4, speed: 34, smartRatio: 0, blockRatio: 0.55 },
  medium: { enemies: 7, speed: 46, smartRatio: 0.35, blockRatio: 0.65 },
  hard: { enemies: 10, speed: 58, smartRatio: 0.7, blockRatio: 0.75 },
};

const CPU_SKILL: Record<Difficulty, { react: number; aggro: number }> = {
  easy: { react: 0.34, aggro: 0.35 },
  medium: { react: 0.22, aggro: 0.6 },
  hard: { react: 0.14, aggro: 0.85 },
};

const FUSE = 2.4;
const FLAME_TIME = 0.5;
const RADIUS = 11;

const CORNERS: Array<[number, number]> = [
  [1, 1],
  [COLS - 2, ROWS - 2],
  [COLS - 2, 1],
  [1, ROWS - 2],
];

type Sound = (name: "bomb" | "pickup" | "kill" | "hurt" | "win" | "place") => void;

export interface GameOptions {
  mode: Mode;
  difficulty: Difficulty;
  players: number; // human players (1 in virus/cpu mode)
  best: number;
  onHud: (h: HudState) => void;
  sound: Sound;
}

export class BomberGame {
  grid: Cell[][] = [];
  bombs: Bomb[] = [];
  flames: Flame[] = [];
  enemies: Enemy[] = [];
  items: Item[] = [];
  bombers: Bomber[] = [];

  mode: Mode;
  difficulty: Difficulty;
  players: number;
  best = 0;
  shake = 0;
  status: HudState["status"] = "playing";
  winner: string | null = null;
  paused = false;

  private time = 0;
  private onHud: (h: HudState) => void;
  private sound: Sound;
  private hidden = new Map<string, PowerType>();

  constructor(opts: GameOptions) {
    this.mode = opts.mode;
    this.difficulty = opts.difficulty;
    this.players = opts.players;
    this.best = opts.best;
    this.onHud = opts.onHud;
    this.sound = opts.sound;
    this.buildLevel();
    this.pushHud();
  }

  get me() {
    return this.bombers[0]!;
  }

  private bomberCount() {
    if (this.mode === "virus") return 1;
    if (this.mode === "cpu") return 4; // player + 3 CPU
    return this.players;
  }

  private buildLevel() {
    const cfg = DIFF[this.difficulty];
    this.grid = [];
    for (let y = 0; y < ROWS; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < COLS; x++) {
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) row.push(1);
        else if (x % 2 === 0 && y % 2 === 0) row.push(1);
        else row.push(0);
      }
      this.grid.push(row);
    }

    const count = this.bomberCount();
    const safe = new Set<string>();
    for (let i = 0; i < count; i++) {
      const [sx, sy] = CORNERS[i]!;
      safe.add(`${sx},${sy}`);
      safe.add(`${sx + (sx === 1 ? 1 : -1)},${sy}`);
      safe.add(`${sx},${sy + (sy === 1 ? 1 : -1)}`);
      safe.add(`${sx + (sx === 1 ? 2 : -2)},${sy}`);
      safe.add(`${sx},${sy + (sy === 1 ? 2 : -2)}`);
    }

    const blockRatio = this.mode === "virus" ? cfg.blockRatio : 0.6;
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (this.grid[y]![x] !== 0) continue;
        if (safe.has(`${x},${y}`)) continue;
        if (Math.random() < blockRatio) this.grid[y]![x] = 2;
      }
    }

    const soft: Array<[number, number]> = [];
    for (let y = 1; y < ROWS - 1; y++)
      for (let x = 1; x < COLS - 1; x++)
        if (this.grid[y]![x] === 2) soft.push([x, y]);
    shuffle(soft);
    const pool: PowerType[] = [
      "fire",
      "fire",
      "fire",
      "fire",
      "bomb",
      "bomb",
      "bomb",
      "bomb",
      "speed",
      "speed",
      "glove",
      "remote",
      "vest",
    ];
    shuffle(pool);
    this.hidden = new Map();
    pool.slice(0, Math.min(pool.length, soft.length)).forEach((type, i) => {
      this.hidden.set(`${soft[i]![0]},${soft[i]![1]}`, type);
    });

    // Bombers
    this.bombers = [];
    const names = this.mode === "cpu" ? CPU_NAMES : BOMBER_NAMES;
    const humans = this.mode === "multi" ? this.players : 1;
    for (let i = 0; i < count; i++) {
      const [cx, cy] = CORNERS[i]!;
      this.bombers.push({
        id: i,
        name: names[i]!,
        skin: BOMBER_SKINS[i]!,
        cpu: i >= humans,
        x: cx * TILE + TILE / 2,
        y: cy * TILE + TILE / 2,
        dx: 0,
        dy: 0,
        facing: 2,
        walkAnim: 0,
        alive: true,
        lives: this.mode === "virus" ? 3 : 1,
        score: 0,
        range: 1,
        maxBombs: 1,
        speedLevel: 0,
        glove: false,
        remote: false,
        vest: false,
        invuln: 1.2,
        spawn: { cx, cy },
        ignoreBomb: null,
        think: 0,
        wantBomb: false,
      });
    }

    // Viruses only in virus mode.
    this.enemies = [];
    if (this.mode === "virus") {
      const spots: Array<[number, number]> = [];
      for (let y = 1; y < ROWS - 1; y++)
        for (let x = 1; x < COLS - 1; x++)
          if (this.grid[y]![x] === 0 && x + y > 6) spots.push([x, y]);
      shuffle(spots);
      for (let i = 0; i < cfg.enemies && i < spots.length; i++) {
        const [x, y] = spots[i]!;
        this.enemies.push({
          x: x * TILE + TILE / 2,
          y: y * TILE + TILE / 2,
          dx: Math.random() < 0.5 ? 1 : -1,
          dy: 0,
          speed: cfg.speed + Math.random() * 10,
          kind: (i % 3) as 0 | 1 | 2,
          alive: true,
          wobble: Math.random() * 6,
          smart: Math.random() < cfg.smartRatio,
        });
      }
    }

    this.bombs = [];
    this.flames = [];
    this.items = [];
  }

  bomberSpeed(b: Bomber) {
    return 72 + b.speedLevel * 16;
  }

  pushHud() {
    const me = this.me;
    this.onHud({
      mode: this.mode,
      difficulty: this.difficulty,
      status: this.status,
      winner: this.winner,
      enemiesLeft: this.enemies.filter((e) => e.alive).length,
      best: this.best,
      score: me.score,
      lives: me.lives,
      bombers: this.bombers.map((b) => ({
        id: b.id,
        name: b.name,
        color: b.skin.body,
        alive: b.alive,
        lives: b.lives,
        score: b.score,
        range: b.range,
        maxBombs: b.maxBombs,
        speedLevel: b.speedLevel,
        glove: b.glove,
        remote: b.remote,
        vest: b.vest,
        cpu: b.cpu,
      })),
    });
  }

  private solidAt(
    cx: number,
    cy: number,
    ignore: Bomb | Bomb[] | null = null,
  ) {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    if (this.grid[cy]![cx] !== 0) return true;
    const skip = (b: Bomb) =>
      Array.isArray(ignore) ? ignore.includes(b) : b === ignore;
    return this.bombs.some((b) => !skip(b) && b.cx === cx && b.cy === cy);
  }

  private canStand(x: number, y: number, ignore: Bomb | Bomb[] | null) {
    const r = RADIUS;
    const cells: Array<[number, number]> = [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
    ];
    return cells.every(
      ([ax, ay]) =>
        !this.solidAt(Math.floor(ax / TILE), Math.floor(ay / TILE), ignore),
    );
  }

  // Every bomb the bomber's body currently overlaps (any owner) is passable,
  // otherwise it would be trapped inside the bomb tile and unable to step out.
  private overlappedBombs(b: Bomber) {
    const r = RADIUS;
    const x0 = Math.floor((b.x - r) / TILE);
    const x1 = Math.floor((b.x + r) / TILE);
    const y0 = Math.floor((b.y - r) / TILE);
    const y1 = Math.floor((b.y + r) / TILE);
    return this.bombs.filter(
      (bo) => bo.cx >= x0 && bo.cx <= x1 && bo.cy >= y0 && bo.cy <= y1,
    );
  }

  setInput(id: number, dx: number, dy: number) {
    const b = this.bombers[id];
    if (!b || b.cpu) return;
    b.dx = dx;
    b.dy = dy;
    if (dx > 0) b.facing = 1;
    else if (dx < 0) b.facing = 3;
    else if (dy < 0) b.facing = 0;
    else if (dy > 0) b.facing = 2;
  }

  placeBomb(id = 0) {
    if (this.status !== "playing" || this.paused) return;
    const b = this.bombers[id];
    if (!b || !b.alive) return;
    this.dropBomb(b);
  }

  private dropBomb(b: Bomber) {
    const own = this.bombs.filter((x) => x.owner === b.id).length;
    if (own >= b.maxBombs) return;
    const cx = Math.floor(b.x / TILE);
    const cy = Math.floor(b.y / TILE);
    if (this.bombs.some((x) => x.cx === cx && x.cy === cy)) return;
    const bomb: Bomb = {
      cx,
      cy,
      timer: FUSE,
      range: b.range,
      remote: b.remote,
      owner: b.id,
      slide: null,
      px: cx * TILE + TILE / 2,
      py: cy * TILE + TILE / 2,
    };
    this.bombs.push(bomb);
    b.ignoreBomb = bomb;
    this.sound("place");
  }

  detonate(id = 0) {
    const b = this.bombers[id];
    if (!b || !b.remote) return;
    const bomb = this.bombs.find((x) => x.owner === id && x.remote);
    if (bomb) bomb.timer = 0;
  }

  update(dtRaw: number) {
    if (this.paused || this.status !== "playing") return;
    const dt = Math.min(dtRaw, 0.05);
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);

    for (const b of this.bombers) {
      if (!b.alive) continue;
      if (b.invuln > 0) b.invuln -= dt;
      if (b.cpu) this.thinkCpu(b, dt);
      this.moveBomber(b, dt);
    }

    this.moveBombs(dt);
    this.moveEnemies(dt);

    for (const b of [...this.bombs]) {
      b.timer -= dt;
      if (b.timer <= 0) this.explode(b);
    }

    for (const f of this.flames) f.t -= dt;
    this.flames = this.flames.filter((f) => f.t > 0);
    for (const it of this.items) it.t += dt;

    this.checkHits();
    this.pushHud();
  }

  private moveBomber(b: Bomber, dt: number) {
    const sp = this.bomberSpeed(b) * dt;
    const ign = this.overlappedBombs(b);
    if (b.dx !== 0 || b.dy !== 0) b.walkAnim += dt * 10;

    if (b.dx !== 0) {
      const nx = b.x + b.dx * sp;
      if (this.canStand(nx, b.y, ign)) b.x = nx;
      else if (!this.tryKick(b, b.dx, 0)) this.slideAssist(b, 0, nx, ign);
    }
    if (b.dy !== 0) {
      const ny = b.y + b.dy * sp;
      if (this.canStand(b.x, ny, ign)) b.y = ny;
      else if (!this.tryKick(b, 0, b.dy)) this.slideAssist(b, 1, ny, ign);
    }

    if (b.ignoreBomb) {
      const still = this.overlappedBombs(b).includes(b.ignoreBomb);
      if (!still || !this.bombs.includes(b.ignoreBomb)) b.ignoreBomb = null;
    }


    const cx = Math.floor(b.x / TILE);
    const cy = Math.floor(b.y / TILE);
    const idx = this.items.findIndex((i) => i.cx === cx && i.cy === cy);
    if (idx >= 0) {
      const it = this.items.splice(idx, 1)[0]!;
      this.applyPower(b, it.type);
      b.score += 100;
      if (!b.cpu) this.sound("pickup");
    }
  }

  private slideAssist(b: Bomber, axis: 0 | 1, target: number, ign: Bomb | Bomb[] | null) {
    const nudge = 90 * 0.016;
    if (axis === 0) {
      const cy = Math.floor(b.y / TILE);
      const center = cy * TILE + TILE / 2;
      const dir = Math.sign(center - b.y);
      if (dir !== 0 && this.canStand(target, b.y + dir * nudge * 2, ign)) {
        b.y += dir * Math.min(Math.abs(center - b.y), nudge * 2);
      }
    } else {
      const cx = Math.floor(b.x / TILE);
      const center = cx * TILE + TILE / 2;
      const dir = Math.sign(center - b.x);
      if (dir !== 0 && this.canStand(b.x + dir * nudge * 2, target, ign)) {
        b.x += dir * Math.min(Math.abs(center - b.x), nudge * 2);
      }
    }
  }

  private tryKick(b: Bomber, dx: number, dy: number) {
    if (!b.glove) return false;
    const cx = Math.floor((b.x + dx * (RADIUS + 6)) / TILE);
    const cy = Math.floor((b.y + dy * (RADIUS + 6)) / TILE);
    const bomb = this.bombs.find((x) => x.cx === cx && x.cy === cy && !x.slide);
    if (!bomb) return false;
    if (this.solidAt(cx + dx, cy + dy)) return false;
    bomb.slide = { dx, dy };
    return true;
  }

  // ----- CPU bomber brain -----
  private dangerMap() {
    const danger: boolean[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => false),
    );
    for (const f of this.flames) danger[f.cy]![f.cx] = true;
    for (const b of this.bombs) {
      danger[b.cy]![b.cx] = true;
      const dirs: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of dirs) {
        for (let s = 1; s <= b.range; s++) {
          const cx = b.cx + dx * s;
          const cy = b.cy + dy * s;
          if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) break;
          const cell = this.grid[cy]![cx];
          if (cell === 1) break;
          danger[cy]![cx] = true;
          if (cell === 2) break;
        }
      }
    }
    return danger;
  }

  // BFS returning first step direction toward a cell matching `goal`.
  private bfsStep(
    sx: number,
    sy: number,
    goal: (cx: number, cy: number) => boolean,
    passable: (cx: number, cy: number) => boolean,
    maxDepth = 60,
  ): [number, number] | null {
    const seen = new Set<string>([`${sx},${sy}`]);
    const queue: Array<{ cx: number; cy: number; first: [number, number] | null; d: number }> =
      [{ cx: sx, cy: sy, first: null, d: 0 }];
    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (queue.length) {
      const node = queue.shift()!;
      if (node.first && goal(node.cx, node.cy)) return node.first;
      if (node.d >= maxDepth) continue;
      for (const [dx, dy] of dirs) {
        const cx = node.cx + dx;
        const cy = node.cy + dy;
        const key = `${cx},${cy}`;
        if (seen.has(key)) continue;
        if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
        seen.add(key);
        if (!passable(cx, cy)) {
          if (node.first && goal(cx, cy)) return node.first;
          continue;
        }
        queue.push({
          cx,
          cy,
          first: node.first ?? [dx, dy],
          d: node.d + 1,
        });
      }
    }
    return null;
  }

  private thinkCpu(b: Bomber, dt: number) {
    b.think -= dt;
    const cx = Math.floor(b.x / TILE);
    const cy = Math.floor(b.y / TILE);
    const atCenter =
      Math.abs(b.x - (cx * TILE + TILE / 2)) < 3 &&
      Math.abs(b.y - (cy * TILE + TILE / 2)) < 3;
    if (!atCenter || b.think > 0) return;

    const skill = CPU_SKILL[this.difficulty];
    b.think = skill.react;
    b.x = cx * TILE + TILE / 2;
    b.y = cy * TILE + TILE / 2;

    const danger = this.dangerMap();
    const walkable = (x: number, y: number) =>
      this.grid[y]![x] === 0 && !this.bombs.some((bb) => bb.cx === x && bb.cy === y);
    const overlap = this.overlappedBombs(b);
    const walkableSelf = (x: number, y: number) =>
      this.grid[y]![x] === 0 &&
      !this.bombs.some(
        (bb) => bb.cx === x && bb.cy === y && !overlap.includes(bb),
      );

    // 1. Escape danger.
    if (danger[cy]![cx]) {
      const step = this.bfsStep(
        cx,
        cy,
        (x, y) => !danger[y]![x] && walkable(x, y),
        walkableSelf,
        14,
      );
      if (step) {
        this.applyCpuDir(b, step);
        return;
      }
    }

    // 2. Consider dropping a bomb (only if an escape exists).
    const targets = this.bombers.filter((o) => o.id !== b.id && o.alive);
    const nearFoe = targets.some(
      (o) =>
        Math.abs(Math.floor(o.x / TILE) - cx) +
          Math.abs(Math.floor(o.y / TILE) - cy) <=
        Math.max(2, b.range),
    );
    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const nearBlock = dirs.some(([dx, dy]) => {
      const x = cx + dx;
      const y = cy + dy;
      return x > 0 && y > 0 && x < COLS && y < ROWS && this.grid[y]![x] === 2;
    });

    if (
      (nearFoe || nearBlock) &&
      this.bombs.filter((x) => x.owner === b.id).length < b.maxBombs &&
      !this.bombs.some((x) => x.cx === cx && x.cy === cy) &&
      Math.random() < (nearFoe ? skill.aggro : 0.7)
    ) {
      // Simulate: mark this cell's blast and check for an escape route.
      const blast = new Set<string>([`${cx},${cy}`]);
      for (const [dx, dy] of dirs) {
        for (let s = 1; s <= b.range; s++) {
          const x = cx + dx * s;
          const y = cy + dy * s;
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
          const cell = this.grid[y]![x];
          if (cell === 1) break;
          blast.add(`${x},${y}`);
          if (cell === 2) break;
        }
      }
      const escape = this.bfsStep(
        cx,
        cy,
        (x, y) => !blast.has(`${x},${y}`) && !danger[y]![x] && walkable(x, y),
        walkableSelf,
        10,
      );
      if (escape) {
        this.dropBomb(b);
        this.applyCpuDir(b, escape);
        return;
      }
    }

    // 3. Hunt: move toward nearest foe, else nearest soft block, else wander.
    const foeCells = new Set(
      targets.map((o) => `${Math.floor(o.x / TILE)},${Math.floor(o.y / TILE)}`),
    );
    let step: [number, number] | null = null;
    if (foeCells.size && Math.random() < skill.aggro) {
      step = this.bfsStep(
        cx,
        cy,
        (x, y) => foeCells.has(`${x},${y}`),
        (x, y) => walkableSelf(x, y) && !danger[y]![x],
        40,
      );
    }
    if (!step) {
      step = this.bfsStep(
        cx,
        cy,
        (x, y) => this.grid[y]![x] === 2 || this.items.some((i) => i.cx === x && i.cy === y),
        (x, y) => walkableSelf(x, y) && !danger[y]![x],
        30,
      );
    }
    if (!step) {
      const options = dirs.filter(
        ([dx, dy]) =>
          walkableSelf(cx + dx, cy + dy) && !danger[cy + dy]![cx + dx],
      );
      if (options.length)
        step = options[Math.floor(Math.random() * options.length)]!;
    }
    if (step) this.applyCpuDir(b, step);
    else {
      b.dx = 0;
      b.dy = 0;
    }
  }

  private applyCpuDir(b: Bomber, [dx, dy]: [number, number]) {
    b.dx = dx;
    b.dy = dy;
    if (dx > 0) b.facing = 1;
    else if (dx < 0) b.facing = 3;
    else if (dy < 0) b.facing = 0;
    else if (dy > 0) b.facing = 2;
  }

  private moveBombs(dt: number) {
    for (const b of this.bombs) {
      if (!b.slide) {
        b.px = b.cx * TILE + TILE / 2;
        b.py = b.cy * TILE + TILE / 2;
        continue;
      }
      const sp = 150 * dt;
      b.px += b.slide.dx * sp;
      b.py += b.slide.dy * sp;
      const ncx = Math.floor(b.px / TILE);
      const ncy = Math.floor(b.py / TILE);
      if (ncx !== b.cx || ncy !== b.cy) {
        if (this.solidAt(ncx, ncy, b)) {
          b.px = b.cx * TILE + TILE / 2;
          b.py = b.cy * TILE + TILE / 2;
          b.slide = null;
        } else {
          b.cx = ncx;
          b.cy = ncy;
          if (this.solidAt(ncx + b.slide.dx, ncy + b.slide.dy, b)) {
            const atCenter =
              Math.abs(b.px - (ncx * TILE + TILE / 2)) < 4 &&
              Math.abs(b.py - (ncy * TILE + TILE / 2)) < 4;
            if (atCenter) {
              b.px = ncx * TILE + TILE / 2;
              b.py = ncy * TILE + TILE / 2;
              b.slide = null;
            }
          }
        }
      }
    }
  }

  private moveEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.wobble += dt * 8;
      const sp = e.speed * dt;
      const nx = e.x + e.dx * sp;
      const ny = e.y + e.dy * sp;
      const fits = this.enemyFits(nx, ny);
      const atCenter =
        Math.abs((e.x % TILE) - TILE / 2) < 3 &&
        Math.abs((e.y % TILE) - TILE / 2) < 3;

      if (!fits) {
        this.turnEnemy(e);
      } else {
        e.x = nx;
        e.y = ny;
        if (atCenter && Math.random() < (e.smart ? 0.12 : 0.03))
          this.turnEnemy(e, true);
      }
    }
  }

  private enemyFits(x: number, y: number) {
    const r = 10;
    const pts: Array<[number, number]> = [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
    ];
    return pts.every(([ax, ay]) => {
      const cx = Math.floor(ax / TILE);
      const cy = Math.floor(ay / TILE);
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
      if (this.grid[cy]![cx] !== 0) return false;
      return !this.bombs.some((b) => b.cx === cx && b.cy === cy);
    });
  }

  private turnEnemy(e: Enemy, random = false) {
    const cx = Math.floor(e.x / TILE);
    const cy = Math.floor(e.y / TILE);
    e.x = cx * TILE + TILE / 2;
    e.y = cy * TILE + TILE / 2;
    const dirs: Array<[number, number]> = (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as Array<[number, number]>
    ).filter(([dx, dy]) => !this.solidAt(cx + dx, cy + dy));
    if (dirs.length === 0) return;
    let pick = dirs[Math.floor(Math.random() * dirs.length)]!;
    if (e.smart && !random) {
      const target = this.me;
      dirs.sort((a, b) => {
        const da =
          Math.abs(cx + a[0] - target.x / TILE) +
          Math.abs(cy + a[1] - target.y / TILE);
        const db =
          Math.abs(cx + b[0] - target.x / TILE) +
          Math.abs(cy + b[1] - target.y / TILE);
        return da - db;
      });
      pick = Math.random() < 0.7 ? dirs[0]! : pick;
    }
    e.dx = pick[0];
    e.dy = pick[1];
  }

  private explode(bomb: Bomb) {
    const i = this.bombs.indexOf(bomb);
    if (i === -1) return;
    this.bombs.splice(i, 1);
    for (const b of this.bombers) if (b.ignoreBomb === bomb) b.ignoreBomb = null;
    this.sound("bomb");
    this.shake = 1;
    this.addFlame(bomb.cx, bomb.cy, "center", 0);

    const owner = this.bombers[bomb.owner];
    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      for (let s = 1; s <= bomb.range; s++) {
        const cx = bomb.cx + dx * s;
        const cy = bomb.cy + dy * s;
        if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) break;
        const cell = this.grid[cy]![cx];
        if (cell === 1) break;
        this.addFlame(cx, cy, "arm", dx !== 0 ? 0 : 1);
        const chained = this.bombs.find((b) => b.cx === cx && b.cy === cy);
        if (chained) chained.timer = Math.min(chained.timer, 0.05);
        if (cell === 2) {
          this.grid[cy]![cx] = 0;
          if (owner) owner.score += 20;
          const hid = this.hidden.get(`${cx},${cy}`);
          if (hid) {
            this.items.push({ cx, cy, type: hid, t: 0 });
            this.hidden.delete(`${cx},${cy}`);
          }
          break;
        }
      }
    }
  }

  private addFlame(cx: number, cy: number, kind: Flame["kind"], dir: number) {
    this.flames.push({ cx, cy, t: FLAME_TIME, kind, dir });
    const idx = this.items.findIndex((i) => i.cx === cx && i.cy === cy);
    if (idx >= 0) this.items.splice(idx, 1);
  }

  private checkHits() {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ecx = Math.floor(e.x / TILE);
      const ecy = Math.floor(e.y / TILE);
      if (this.flames.some((f) => f.cx === ecx && f.cy === ecy)) {
        e.alive = false;
        this.me.score += 200;
        this.sound("kill");
        continue;
      }
      for (const b of this.bombers) {
        if (!b.alive || b.invuln > 0) continue;
        if (Math.abs(e.x - b.x) < 18 && Math.abs(e.y - b.y) < 18) this.hurt(b);
      }
    }

    for (const b of this.bombers) {
      if (!b.alive || b.invuln > 0) continue;
      const cx = Math.floor(b.x / TILE);
      const cy = Math.floor(b.y / TILE);
      if (this.flames.some((f) => f.cx === cx && f.cy === cy)) this.hurt(b);
    }

    if (this.status !== "playing") return;

    if (this.mode === "virus") {
      if (this.enemies.every((e) => !e.alive)) {
        this.status = "won";
        this.winner = null;
        this.me.score += 500 + this.me.lives * 250;
        this.sound("win");
        this.saveBest();
      }
      return;
    }

    const alive = this.bombers.filter((b) => b.alive);
    if (alive.length === 1) {
      const last = alive[0]!;
      this.winner = last.name;
      this.status = this.mode === "cpu" && last.cpu ? "lost" : "won";
      last.score += 500;
      this.sound(this.status === "won" ? "win" : "hurt");
      this.saveBest();
    } else if (alive.length === 0) {
      this.status = "draw";
      this.winner = null;
      this.saveBest();
    }
  }

  private hurt(b: Bomber) {
    if (b.vest) {
      b.vest = false;
      b.invuln = 2;
      this.sound("hurt");
      return;
    }
    b.lives -= 1;
    b.invuln = 2.2;
    this.sound("hurt");
    b.x = b.spawn.cx * TILE + TILE / 2;
    b.y = b.spawn.cy * TILE + TILE / 2;
    b.dx = 0;
    b.dy = 0;
    if (b.lives <= 0) {
      b.lives = 0;
      b.alive = false;
      if (this.mode === "virus" && b.id === 0) {
        this.status = "lost";
        this.saveBest();
      }
    }
  }

  private saveBest() {
    if (this.me.score > this.best) {
      this.best = this.me.score;
      try {
        localStorage.setItem("nimiq-bomber-best", String(this.best));
      } catch {
        /* storage unavailable */
      }
    }
  }

  private applyPower(b: Bomber, type: PowerType) {
    switch (type) {
      case "fire":
        b.range = Math.min(8, b.range + 1);
        break;
      case "bomb":
        b.maxBombs = Math.min(8, b.maxBombs + 1);
        break;
      case "speed":
        b.speedLevel = Math.min(4, b.speedLevel + 1);
        break;
      case "glove":
        b.glove = true;
        break;
      case "remote":
        b.remote = true;
        break;
      case "vest":
        b.vest = true;
        break;
    }
  }

  // ----- rendering -----
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 3;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    ctx.fillStyle = "#10131f";
    ctx.fillRect(-8, -8, W + 16, H + 16);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = x * TILE;
        const py = y * TILE;
        const cell = this.grid[y]![x];
        this.drawFloor(ctx, px, py, (x + y) % 2 === 0);
        if (cell === 1) this.drawHardWall(ctx, px, py);
        else if (cell === 2) this.drawSoftBlock(ctx, px, py);
      }
    }

    for (const it of this.items) this.drawItem(ctx, it);
    for (const b of this.bombs) this.drawBomb(ctx, b);
    for (const f of this.flames) this.drawFlame(ctx, f);
    for (const e of this.enemies) if (e.alive) this.drawEnemy(ctx, e);
    for (const b of this.bombers) if (b.alive) this.drawBomber(ctx, b);
    ctx.restore();
  }

  private drawFloor(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    alt: boolean,
  ) {
    ctx.fillStyle = alt ? "#1c7a4b" : "#18693f";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x + 4, y + 4, 4, 4);
    ctx.fillRect(x + 20, y + 18, 3, 3);
  }

  private drawHardWall(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const hexagon = (inset: number) => {
      const shoulder = 7;
      const mid = TILE / 2;
      ctx.beginPath();
      ctx.moveTo(x + inset + shoulder, y + inset);
      ctx.lineTo(x + TILE - inset - shoulder, y + inset);
      ctx.lineTo(x + TILE - inset, y + mid);
      ctx.lineTo(x + TILE - inset - shoulder, y + TILE - inset);
      ctx.lineTo(x + inset + shoulder, y + TILE - inset);
      ctx.lineTo(x + inset, y + mid);
      ctx.closePath();
    };

    hexagon(1);
    ctx.fillStyle = "#7a4b00";
    ctx.fill();
    hexagon(3);
    ctx.fillStyle = "#d89200";
    ctx.fill();

    ctx.fillStyle = "#ffd83d";
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 5);
    ctx.lineTo(x + TILE - 10, y + 5);
    ctx.lineTo(x + TILE - 5, y + 14);
    ctx.lineTo(x + 8, y + 14);
    ctx.lineTo(x + 5, y + 16);
    ctx.lineTo(x + 5, y + 13);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f4b800";
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 16);
    ctx.lineTo(x + 9, y + 8);
    ctx.lineTo(x + TILE - 9, y + 8);
    ctx.lineTo(x + TILE - 5, y + 16);
    ctx.lineTo(x + TILE - 10, y + TILE - 5);
    ctx.lineTo(x + 10, y + TILE - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a96300";
    ctx.beginPath();
    ctx.moveTo(x + 10, y + TILE - 8);
    ctx.lineTo(x + TILE - 10, y + TILE - 8);
    ctx.lineTo(x + TILE - 7, y + TILE - 13);
    ctx.lineTo(x + TILE - 10, y + TILE - 5);
    ctx.lineTo(x + 10, y + TILE - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe777";
    ctx.fillRect(x + 10, y + 7, TILE - 20, 2);
  }

  private drawSoftBlock(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const hexagon = (inset: number) => {
      const shoulder = 7;
      const mid = TILE / 2;
      ctx.beginPath();
      ctx.moveTo(x + inset + shoulder, y + inset);
      ctx.lineTo(x + TILE - inset - shoulder, y + inset);
      ctx.lineTo(x + TILE - inset, y + mid);
      ctx.lineTo(x + TILE - inset - shoulder, y + TILE - inset);
      ctx.lineTo(x + inset + shoulder, y + TILE - inset);
      ctx.lineTo(x + inset, y + mid);
      ctx.closePath();
    };

    hexagon(1);
    ctx.fillStyle = "#402617";
    ctx.fill();
    hexagon(3);
    ctx.fillStyle = "#7a4323";
    ctx.fill();
    ctx.fillStyle = "#a96232";
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 6);
    ctx.lineTo(x + TILE - 10, y + 6);
    ctx.lineTo(x + TILE - 5, y + 16);
    ctx.lineTo(x + TILE - 10, y + TILE - 6);
    ctx.lineTo(x + 10, y + TILE - 6);
    ctx.lineTo(x + 5, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d08a4b";
    ctx.fillRect(x + 10, y + 7, TILE - 20, 3);
    ctx.fillStyle = "#61351f";
    ctx.fillRect(x + 6, y + 16, 9, 2);
    ctx.fillRect(x + 19, y + 16, 7, 2);
    ctx.fillRect(x + 14, y + 9, 2, 7);
    ctx.fillRect(x + 21, y + 18, 2, 7);
    ctx.fillRect(x + 9, y + 24, 12, 2);
    ctx.fillStyle = "#c0783d";
    ctx.fillRect(x + 16, y + 10, 8, 5);
    ctx.fillRect(x + 8, y + 19, 11, 4);
  }

  private drawBomb(ctx: CanvasRenderingContext2D, b: Bomb) {
    const pulse = 1 + Math.sin(this.time * 14) * 0.07;
    const r = 11 * pulse;
    ctx.fillStyle = "#101218";
    ctx.beginPath();
    ctx.arc(b.px, b.py + 2, r, 0, Math.PI * 2);
    ctx.fill();
    const owner = this.bombers[b.owner];
    if (owner) {
      ctx.strokeStyle = owner.skin.body;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.px, b.py + 2, r - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(b.px - 4, b.py - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.px + 3, b.py - r + 2);
    ctx.lineTo(b.px + 7, b.py - r - 4);
    ctx.stroke();
    if (Math.sin(this.time * 20) > 0) {
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(b.px + 8, b.py - r - 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFlame(ctx: CanvasRenderingContext2D, f: Flame) {
    const x = f.cx * TILE;
    const y = f.cy * TILE;
    const k = f.t / FLAME_TIME;
    const inset = 2 + (1 - k) * 6;
    ctx.fillStyle = "#ff6b2c";
    ctx.fillRect(x + inset, y + inset, TILE - inset * 2, TILE - inset * 2);
    ctx.fillStyle = "#ffb703";
    ctx.fillRect(
      x + inset + 4,
      y + inset + 4,
      TILE - inset * 2 - 8,
      TILE - inset * 2 - 8,
    );
    if (Math.sin(this.time * 30) > -0.2) {
      ctx.fillStyle = "#fff3c4";
      ctx.fillRect(x + TILE / 2 - 4, y + TILE / 2 - 4, 8, 8);
    }
  }

  private drawItem(ctx: CanvasRenderingContext2D, it: Item) {
    const x = it.cx * TILE + TILE / 2;
    const y = it.cy * TILE + TILE / 2 + Math.sin(it.t * 4) * 2;
    ctx.fillStyle = "#20263a";
    ctx.fillRect(x - 12, y - 12, 24, 24);
    ctx.strokeStyle = "#8ce0ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 11, y - 11, 22, 22);
    ctx.fillStyle = itemColor(it.type);
    switch (it.type) {
      case "fire":
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x + 6, y + 7);
        ctx.lineTo(x - 6, y + 7);
        ctx.closePath();
        ctx.fill();
        break;
      case "bomb":
        ctx.beginPath();
        ctx.arc(x, y + 1, 7, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "speed":
        ctx.fillRect(x - 8, y - 2, 12, 8);
        ctx.fillRect(x - 8, y - 7, 5, 6);
        break;
      case "glove":
        ctx.fillRect(x - 6, y - 5, 10, 11);
        ctx.fillRect(x + 4, y - 1, 4, 5);
        break;
      case "remote":
        ctx.fillRect(x - 5, y - 4, 10, 11);
        ctx.fillRect(x - 1, y - 9, 2, 5);
        break;
      case "vest":
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x + 7, y - 4);
        ctx.lineTo(x + 5, y + 8);
        ctx.lineTo(x - 5, y + 8);
        ctx.lineTo(x - 7, y - 4);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    const palette = ["#e05c8a", "#7c5cff", "#3fbf7f"];
    const body = palette[e.kind]!;
    const bob = Math.sin(e.wobble) * 2;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 12, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    const horns = 8;
    for (let i = 0; i < horns; i++) {
      const a = (i / horns) * Math.PI * 2;
      const px = e.x + Math.cos(a) * 10;
      const py = e.y + bob + Math.sin(a) * 10;
      const side = 3;
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6);
      ctx.lineTo(
        px + Math.cos(a + Math.PI / 2) * side,
        py + Math.sin(a + Math.PI / 2) * side,
      );
      ctx.lineTo(
        px + Math.cos(a - Math.PI / 2) * side,
        py + Math.sin(a - Math.PI / 2) * side,
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(e.x, e.y + bob, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(e.x - 4, e.y - 5 + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(e.x - 7, e.y - 2 + bob, 5, 6);
    ctx.fillRect(e.x + 2, e.y - 2 + bob, 5, 6);
    ctx.fillStyle = "#141824";
    ctx.fillRect(e.x - 6 + e.dx * 1.5, e.y + bob, 3, 3);
    ctx.fillRect(e.x + 3 + e.dx * 1.5, e.y + bob, 3, 3);
    if (e.smart) {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(e.x - 7, e.y + 6 + bob, 14, 2);
    }
  }

  private drawBomber(ctx: CanvasRenderingContext2D, b: Bomber) {
    if (b.invuln > 0 && Math.floor(this.time * 12) % 2 === 0) return;
    const x = b.x;
    const y = b.y;
    const step = Math.sin(b.walkAnim) * 2;
    const skin = b.skin;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - 7, y - 11);
    ctx.lineTo(x + 7, y - 11);
    ctx.lineTo(x + 12, y);
    ctx.lineTo(x + 7, y + 11);
    ctx.lineTo(x - 7, y + 11);
    ctx.lineTo(x - 12, y);
    ctx.closePath();
    ctx.fillStyle = b.vest ? "#4fd1c5" : skin.body;
    ctx.fill();
    ctx.strokeStyle = b.vest ? "#d8fffb" : skin.trim;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = skin.legs;
    ctx.fillRect(x - 8, y + 9 + step, 5, 4);
    ctx.fillRect(x + 3, y + 9 - step, 5, 4);
    ctx.fillStyle = skin.trim;
    ctx.fillRect(x - 8, y - 9, 16, 3);
    ctx.fillStyle = skin.panel;
    ctx.fillRect(x - 5, y + 4, 10, 4);
    ctx.fillStyle = "#101a2e";
    if (b.facing === 2) ctx.fillRect(x - 6, y - 6, 12, 5);
    else if (b.facing === 0) ctx.fillRect(x - 6, y - 7, 12, 3);
    else if (b.facing === 1) ctx.fillRect(x, y - 6, 7, 5);
    else ctx.fillRect(x - 7, y - 6, 7, 5);
    ctx.fillStyle = "#8ce0ff";
    ctx.fillRect(x - 4, y - 5, 3, 2);
    ctx.fillStyle = b.cpu ? "#ff5d5d" : "#ffffff";
    ctx.fillRect(x - 1, y - 16, 2, 5);
    ctx.fillRect(x - 2, y - 17, 4, 2);
  }
}

function itemColor(t: PowerType) {
  switch (t) {
    case "fire":
      return "#ff7a45";
    case "bomb":
      return "#f4f4f5";
    case "speed":
      return "#7ee787";
    case "glove":
      return "#ffd166";
    case "remote":
      return "#8ce0ff";
    case "vest":
      return "#4fd1c5";
  }
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}
