export const W = 960;
export const H = 960;

type Vec = { x: number; y: number };

export const MAX_AMMO = 5;

export type Hud = {
  hp: number;
  maxHp: number;
  score: number;
  wave: number;
  enemies: number;
  ammo: number;
  maxAmmo: number;
  rapid: number;
  shield: number;
  double: number;
  /** true once the double shot has been picked up (permanent from then on) */
  doublePermanent: boolean;
  /** waves remaining until the next boss wave (0 = boss wave is now) */
  wavesToBoss: number;
  /** a boss is on the field right now */
  bossActive: boolean;
  /** 0..1 health of the current boss */
  bossHp: number;
  bossName: string;
};

export type PlayerColor = "yellow" | "orange" | "magenta" | "lime";

type Obstacle = { x: number; y: number; w: number; h: number };

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  dmg: number;
  foe: boolean;
};

type EnemyKind = "chaser" | "shooter" | "brute" | "darter" | "bomber" | "sniper" | "boss";

type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  kind: EnemyKind;
  speed: number;
  cd: number;
  hit: number;
  phase: number;
  boss?: boolean;
  name?: string;
  tier?: number;
  burstCd?: number;
  spin?: number;
};

type PowerKind = "rapid" | "shield" | "double" | "repair";

type Pickup = {
  x: number;
  y: number;
  kind: PowerKind;
  life: number;
};


type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
};

type Ring = {
  x: number;
  y: number;
  r: number;
  vr: number;
  life: number;
  max: number;
  hue: number;
};

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
};

import { playSfx } from "@/lib/sfx";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Bosses rotate every boss wave. */
const BOSS_WAVE_EVERY = 3;
/* Bosses mirror the CosNimiq Shooter roster (same names, colours and sprites). */
const BOSSES = [
  { name: "VOID MOTHER", hp: 720, r: 46, speed: 52, col: "#ff1f6b" },
  { name: "HEX HIVE", hp: 920, r: 44, speed: 46, col: "#c46bff" },
  { name: "CRIMSON FORTRESS", hp: 1160, r: 50, speed: 40, col: "#ff5a3c" },
];

/**
 * Enemy look-and-feel is taken from CosNimiq Shooter: same colour palette and
 * the same sprite sheet in /games/shooter, mapped onto this game's enemy kinds.
 */
const ENEMY_COL: Record<EnemyKind, string> = {
  chaser: "#ff4d4d", // grunt
  shooter: "#c46bff", // shooter
  brute: "#ffd84d", // tank
  darter: "#4db4ff", // dasher
  bomber: "#5cff9b", // zig
  sniper: "#8be9ff", // orbiter
  boss: "#ff1f6b",
};

const ENEMY_SPRITE: Record<EnemyKind, string> = {
  chaser: "/games/shooter/enemy-red.png",
  shooter: "/games/shooter/enemy-purple.png",
  brute: "/games/shooter/enemy-yellow.png",
  darter: "/games/shooter/enemy-blue.png",
  bomber: "/games/shooter/enemy-green.png",
  sniper: "/games/shooter/enemy-ufo.png",
  boss: "/games/shooter/enemy-ufo.png",
};

const BOSS_SPRITE = [
  "/games/shooter/enemy-ufo.png",
  "/games/shooter/boss-hive.png",
  "/games/shooter/boss-fortress.png",
];

const enemyImgs: Record<string, HTMLImageElement> = {};
function enemyImg(src: string): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  let img = enemyImgs[src];
  if (!img) {
    img = new Image();
    img.src = src;
    enemyImgs[src] = img;
  }
  return img;
}

const OBSTACLES: Obstacle[] = [
  { x: 160, y: 150, w: 28, h: 120 },
  { x: 772, y: 150, w: 28, h: 120 },
  { x: 160, y: 690, w: 28, h: 120 },
  { x: 772, y: 690, w: 28, h: 120 },
  { x: 110, y: 452, w: 160, h: 56 },
  { x: 690, y: 452, w: 160, h: 56 },
  { x: 460, y: 260, w: 40, h: 80 },
  { x: 460, y: 620, w: 40, h: 80 },
];

export class Game {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private t = 0;

  running = false;
  paused = false;
  over = false;

  score = 0;
  wave = 0;
  hp = 120;
  maxHp = 120;

  private px = W / 2;
  private py = H / 2;

  get playerX() {
    return this.px;
  }
  get playerY() {
    return this.py;
  }
  private pvx = 0;
  private pvy = 0;
  private pr = 14;
  private aim = 0;
  private fireCd = 0;
  private ammo = MAX_AMMO;
  private reloadCd = 0;
  private iframe = 0;
  private dash = 0;

  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private motes: Mote[] = [];
  private pickups: Pickup[] = [];
  private rapidT = 0;
  private shieldT = 0;
  private doubleT = 0;
  private playerColor: PlayerColor = "yellow";
  private shake = 0;
  private waveBreak = 1.5;
  private toSpawn = 0;
  private spawnCd = 0;
  /** Double shot becomes permanent once collected. */
  private doublePermanent = false;
  private bossCount = 0;
  private lastEngineSfx = -10;
  private lastKillSfx = -10;

  move: Vec = { x: 0, y: 0 };
  shoot: Vec = { x: 0, y: 0 };
  shooting = false;
  keys = new Set<string>();

  onHud: (h: Hud) => void = () => {};
  onOver: (score: number) => void = () => {};
  /** Run summary for server-side plausibility checks. */
  kills: Record<string, number> = {};
  private startT = 0;
  get playSeconds() {
    return this.t - this.startT;
  }

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    /* Preload every enemy/boss sprite up front so enemies never flash the
     * simple fallback shape while their artwork is still downloading. */
    for (const src of Object.values(ENEMY_SPRITE)) enemyImg(src);
    for (const src of BOSS_SPRITE) enemyImg(src);
    for (let i = 0; i < 26; i++) {
      this.motes.push({
        x: rand(0, W),
        y: rand(0, H),
        vx: rand(-14, 14),
        vy: rand(-20, -6),
        size: rand(0.8, 2.2),
        alpha: rand(0.08, 0.3),
      });
    }
  }

  private get ammoCap() {
    return this.rapidT > 0 ? MAX_AMMO + 5 : MAX_AMMO;
  }

  setPlayerColor(color: PlayerColor) {
    this.playerColor = color;
  }


  start() {
    this.score = 0;
    this.kills = {};
    this.startT = this.t;
    this.wave = 0;
    this.hp = this.maxHp;
    this.px = W / 2;
    this.py = H / 2;
    this.pvx = this.pvy = 0;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.rings = [];
    this.pickups = [];
    this.rapidT = 0;
    this.shieldT = 0;
    this.doubleT = 0;
    this.ammo = MAX_AMMO;
    this.reloadCd = 0;
    this.toSpawn = 0;
    this.waveBreak = 1.2;
    this.doublePermanent = false;
    this.bossCount = 0;
    this.over = false;
    this.paused = false;
    this.running = true;
    this.last = performance.now();
    this.pushHud();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Waves left before the next boss shows up (0 = this wave has one). */
  private wavesToBoss() {
    if (this.wave <= 0) return BOSS_WAVE_EVERY - 1;
    const r = this.wave % BOSS_WAVE_EVERY;
    return r === 0 ? 0 : BOSS_WAVE_EVERY - r;
  }

  private pushHud() {
    const boss = this.enemies.find((e) => e.boss);
    this.onHud({
      hp: Math.max(0, Math.round(this.hp)),
      maxHp: this.maxHp,
      score: this.score,
      wave: this.wave,
      enemies: this.enemies.length + this.toSpawn,
      ammo: this.ammo,
      maxAmmo: this.ammoCap,
      rapid: this.rapidT,
      shield: this.shieldT,
      double: this.doubleT,
      doublePermanent: this.doublePermanent,
      wavesToBoss: this.wavesToBoss(),
      bossActive: !!boss,
      bossHp: boss ? Math.max(0, boss.hp / boss.maxHp) : 0,
      bossName: boss?.name ?? "",
    });
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused && !this.over) this.update(dt);
    this.draw();
  };

  private keyVec(): Vec {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has("a") || k.has("arrowleft")) x -= 1;
    if (k.has("d") || k.has("arrowright")) x += 1;
    if (k.has("w") || k.has("arrowup")) y -= 1;
    if (k.has("s") || k.has("arrowdown")) y += 1;
    return { x, y };
  }

  private collideRects(x: number, y: number, r: number) {
    for (const o of OBSTACLES) {
      const cx = clamp(x, o.x, o.x + o.w);
      const cy = clamp(y, o.y, o.y + o.h);
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return { o, cx, cy };
    }
    return null;
  }

  private moveEntity(e: { x: number; y: number; r: number }, dx: number, dy: number) {
    const nx = clamp(e.x + dx, e.r, W - e.r);
    if (!this.collideRects(nx, e.y, e.r)) e.x = nx;
    const ny = clamp(e.y + dy, e.r, H - e.r);
    if (!this.collideRects(e.x, ny, e.r)) e.y = ny;
  }

  private burst(x: number, y: number, hue: number, n: number, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 260) * power;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.7),
        max: 0.7,
        size: rand(1.5, 3.5),
        hue,
      });
    }
  }

  private drawEnemyHealth(e: Enemy, col: string) {
    const c = this.ctx;
    if (e.boss) {
      const bw = W * 0.6;
      c.fillStyle = "rgba(0,0,0,0.55)";
      c.fillRect(W / 2 - bw / 2, 26, bw, 10);
      c.shadowBlur = 16;
      c.shadowColor = col;
      c.fillStyle = col;
      c.fillRect(W / 2 - bw / 2, 26, bw * Math.max(0, e.hp / e.maxHp), 10);
      c.shadowBlur = 0;
      c.fillStyle = "#ffd9e4";
      c.font = "bold 18px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(e.name ?? "BOSS", W / 2, 18);
      c.textAlign = "left";
    } else if (e.hp < e.maxHp) {
      c.fillStyle = "rgba(0,0,0,0.6)";
      c.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2, 3);
      c.fillStyle = col;
      c.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2 * (e.hp / e.maxHp), 3);
    }
  }

  private spawnEnemy() {
    const side = Math.floor(rand(0, 4));
    let x = 0;
    let y = 0;
    if (side === 0) (x = rand(30, W - 30)), (y = -20);
    else if (side === 1) (x = W + 20), (y = rand(30, H - 30));
    else if (side === 2) (x = rand(30, W - 30)), (y = H + 20);
    else (x = -20), (y = rand(30, H - 30));

    const pool: EnemyKind[] = ["chaser", "chaser"];
    if (this.wave >= 2) pool.push("shooter", "darter");
    if (this.wave >= 3) pool.push("bomber");
    if (this.wave >= 4) pool.push("brute");
    if (this.wave >= 5) pool.push("sniper", "darter");
    const kind = pool[Math.floor(rand(0, pool.length))]!;

    const scale = 1 + this.wave * 0.08;
    const STATS: Record<EnemyKind, { r: number; hp: number; speed: number }> = {
      chaser: { r: 13, hp: 20, speed: 120 },
      shooter: { r: 14, hp: 26, speed: 85 },
      brute: { r: 24, hp: 90, speed: 62 },
      darter: { r: 10, hp: 12, speed: 175 },
      bomber: { r: 17, hp: 34, speed: 96 },
      sniper: { r: 12, hp: 22, speed: 60 },
      boss: { r: 46, hp: 720, speed: 50 }, // never picked from the pool
    };
    const base = STATS[kind];

    this.enemies.push({
      x,
      y,
      vx: 0,
      vy: 0,
      r: base.r,
      hp: base.hp * scale,
      maxHp: base.hp * scale,
      kind,
      speed:
        kind === "darter"
          ? Math.min(base.speed * (1 + this.wave * 0.02), 195)
          : base.speed * (1 + this.wave * 0.02),
      cd: rand(0.5, 2),
      hit: 0,
      phase: rand(0, Math.PI * 2),
    });
  }

  private spawnBoss() {
    const spec = BOSSES[this.bossCount % BOSSES.length]!;
    const tier = Math.floor(this.bossCount / BOSSES.length);
    const hp = spec.hp * 0.45 * (1 + this.wave * 0.06) * (1 + tier * 0.45);
    this.enemies.push({
      x: W / 2,
      y: -40,
      vx: 0,
      vy: 0,
      r: spec.r,
      hp,
      maxHp: hp,
      kind: "boss",
      speed: spec.speed * (1 + tier * 0.08),
      cd: 1.4,
      hit: 0,
      phase: 0,
      boss: true,
      name: spec.name,
      tier: this.bossCount % BOSSES.length,
      burstCd: 3,
      spin: 0,
    });
    this.bossCount++;
    this.shake = Math.min(18, this.shake + 14);
    this.rings.push({ x: W / 2, y: 40, r: 20, vr: 620, life: 0.7, max: 0.7, hue: 350 });
  }

  private dropPickup(x: number, y: number) {
    if (Math.random() > 0.16) return;
    const roll = Math.random();
    this.pickups.push({
      x: clamp(x, 24, W - 24),
      y: clamp(y, 24, H - 24),
      kind: roll < 0.25 ? "rapid" : roll < 0.5 ? "shield" : roll < 0.75 ? "double" : "repair",
      life: 12,
    });
  }

  private explode(x: number, y: number) {
    this.burst(x, y, 45, 34, 1.5);
    this.rings.push({ x, y, r: 8, vr: 460, life: 0.35, max: 0.35, hue: 45 });
    this.shake = Math.min(14, this.shake + 8);
    const d = Math.hypot(this.px - x, this.py - y);
    if (d < 96) this.damagePlayer(18);
    for (const e of this.enemies) {
      if (Math.hypot(e.x - x, e.y - y) < 96) {
        e.hp -= 20;
        e.hit = 0.12;
      }
    }
  }


  private update(dt: number) {
    this.t += dt;
    this.iframe = Math.max(0, this.iframe - dt);
    this.shake = Math.max(0, this.shake - dt * 22);
    const hadBuff = this.rapidT > 0 || this.shieldT > 0 || (this.doubleT > 0 && !this.doublePermanent);
    this.rapidT = Math.max(0, this.rapidT - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    if (!this.doublePermanent) this.doubleT = Math.max(0, this.doubleT - dt);
    if (this.ammo > this.ammoCap) this.ammo = this.ammoCap;
    if (hadBuff) this.pushHud();

    // pickups
    for (const p of this.pickups) {
      p.life -= dt;
      if (Math.hypot(p.x - this.px, p.y - this.py) < this.pr + 16) {
        p.life = 0;
        if (p.kind === "rapid") this.rapidT = 10;
        else if (p.kind === "shield") this.shieldT = 8;
        else if (p.kind === "repair") {
          // Repair kit: restores 15% of max hull.
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15);
        } else {
          // Double shot is permanent once collected.
          this.doublePermanent = true;
          this.doubleT = Number.POSITIVE_INFINITY;
        }
        const hue = p.kind === "rapid" ? 55 : p.kind === "shield" ? 190 : p.kind === "repair" ? 130 : 325;
        this.burst(p.x, p.y, hue, 18, 0.9);
        this.rings.push({
          x: p.x,
          y: p.y,
          r: 6,
          vr: 260,
          life: 0.3,
          max: 0.3,
          hue,
        });
        this.pushHud();
      }
    }
    this.pickups = this.pickups.filter((p) => p.life > 0);


    // waves
    if (this.toSpawn <= 0 && this.enemies.length === 0) {
      this.waveBreak -= dt;
      if (this.waveBreak <= 0) {
        this.wave++;
        this.toSpawn = 4 + Math.floor(this.wave * 1.8);
        this.spawnCd = 0;
        this.waveBreak = 2.4;
        this.hp = Math.min(this.maxHp, this.hp + 12);
        // A boss joins the field every third wave.
        if (this.wave % BOSS_WAVE_EVERY === 0) {
          this.spawnBoss();
          this.toSpawn = Math.floor(this.toSpawn * 0.55);
        }
        this.pushHud();
      }
    }
    if (this.toSpawn > 0) {
      this.spawnCd -= dt;
      if (this.spawnCd <= 0) {
        this.spawnEnemy();
        this.toSpawn--;
        this.spawnCd = Math.max(0.14, 0.6 - this.wave * 0.03);
        this.pushHud();
      }
    }

    // player movement
    const k = this.keyVec();
    let mx = this.move.x + k.x;
    let my = this.move.y + k.y;
    const ml = Math.hypot(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    const speed = 235;
    if (ml > 0.15 && this.t - this.lastEngineSfx > 0.6) {
      this.lastEngineSfx = this.t;
      playSfx("engine", 0.25);
    }
    this.pvx += (mx * speed - this.pvx) * Math.min(1, dt * 14);
    this.pvy += (my * speed - this.pvy) * Math.min(1, dt * 14);
    const self = { x: this.px, y: this.py, r: this.pr };
    this.moveEntity(self, this.pvx * dt, this.pvy * dt);
    this.px = self.x;
    this.py = self.y;

    // aim + fire
    const sl = Math.hypot(this.shoot.x, this.shoot.y);
    if (sl > 0.2) this.aim = Math.atan2(this.shoot.y, this.shoot.x);
    else if (ml > 0.2) this.aim = Math.atan2(my, mx);
    this.fireCd -= dt;
    if (this.ammo < this.ammoCap) {
      this.reloadCd -= dt;
      if (this.reloadCd <= 0) {
        this.ammo++;
        this.reloadCd = this.rapidT > 0 ? 0.16 : 0.36;
      }
    }
    if (
      (sl > 0.35 || this.shooting) &&
      this.fireCd <= 0 &&
      this.ammo > 0
    ) {
      this.fireCd = this.rapidT > 0 ? 0.055 : 0.11;
      this.ammo--;
      this.reloadCd = this.rapidT > 0 ? 0.16 : 0.36;
      const spread = rand(-0.035, 0.035);
      const shotAngles = this.doubleT > 0 ? [-0.055, 0.055] : [0];
      for (const offset of shotAngles) {
        const a = this.aim + spread + offset;
        const side = offset === 0 ? 0 : Math.sign(offset) * 7;
        this.bullets.push({
          x: this.px + Math.cos(a) * 20 - Math.sin(this.aim) * side,
          y: this.py + Math.sin(a) * 20 + Math.cos(this.aim) * side,
          vx: Math.cos(a) * 620,
          vy: Math.sin(a) * 620,
          r: 3.5,
          life: 1.3,
          dmg: 12,
          foe: false,
        });
      }
      playSfx("shoot", 0.35);
      this.burst(this.px + Math.cos(this.aim) * 20, this.py + Math.sin(this.aim) * 20, 185, 3, 0.35);
      this.rings.push({
        x: this.px + Math.cos(this.aim) * 22,
        y: this.py + Math.sin(this.aim) * 22,
        r: 4,
        vr: 150,
        life: 0.14,
        max: 0.14,
        hue: 185,
      });
      this.shake = Math.min(4, this.shake + 1.4);
    }

    // enemies
    for (const e of this.enemies) {
      e.hit = Math.max(0, e.hit - dt);
      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let tx = dx / d;
      let ty = dy / d;

      if (e.kind === "shooter") {
        if (d < 230) {
          tx = -tx;
          ty = -ty;
        } else if (d < 330) {
          const p = Math.atan2(dy, dx) + Math.PI / 2;
          tx = Math.cos(p);
          ty = Math.sin(p);
        }
        e.cd -= dt;
        if (e.cd <= 0 && d < 460) {
          e.cd = rand(1.3, 2.2);
          const a = Math.atan2(dy, dx) + rand(-0.08, 0.08);
          this.bullets.push({
            x: e.x + Math.cos(a) * 16,
            y: e.y + Math.sin(a) * 16,
            vx: Math.cos(a) * 330,
            vy: Math.sin(a) * 330,
            r: 4.5,
            life: 2,
            dmg: 9,
            foe: true,
          });
        }
      }

      if (e.kind === "darter") {
        // fast zigzag rusher
        const p = Math.atan2(dy, dx) + Math.sin(this.t * 7 + e.phase) * 0.7;
        tx = Math.cos(p);
        ty = Math.sin(p);
      }

      if (e.kind === "boss") {
        e.spin = (e.spin ?? 0) + dt * 1.2;
        // Hovers at a distance and strafes instead of ramming.
        if (d < 260) {
          tx = -tx;
          ty = -ty;
        } else if (d < 420) {
          const p = Math.atan2(dy, dx) + Math.PI / 2;
          tx = Math.cos(p);
          ty = Math.sin(p);
        }
        // aimed volley
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = rand(0.7, 1.15);
          const base = Math.atan2(dy, dx);
          for (const off of [-0.16, 0, 0.16]) {
            const a = base + off;
            this.bullets.push({
              x: e.x + Math.cos(a) * e.r,
              y: e.y + Math.sin(a) * e.r,
              vx: Math.cos(a) * 390,
              vy: Math.sin(a) * 390,
              r: 5,
              life: 2.4,
              dmg: 5.5,
              foe: true,
            });
          }
        }
        // radial burst
        e.burstCd = (e.burstCd ?? 3) - dt;
        if (e.burstCd <= 0) {
          e.burstCd = rand(3.4, 4.6);
          const n = 12 + (e.tier ?? 0) * 3;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + (e.spin ?? 0);
            this.bullets.push({
              x: e.x + Math.cos(a) * e.r,
              y: e.y + Math.sin(a) * e.r,
              vx: Math.cos(a) * 250,
              vy: Math.sin(a) * 250,
              r: 4.5,
              life: 3,
              dmg: 4.5,
              foe: true,
            });
          }
          this.rings.push({ x: e.x, y: e.y, r: e.r, vr: 320, life: 0.4, max: 0.4, hue: 350 });
        }
      }

      if (e.kind === "sniper") {
        // keeps distance, fires fast precise shots
        if (d < 340) {
          tx = -tx;
          ty = -ty;
        }
        e.cd -= dt;
        if (e.cd <= 0 && d < 700) {
          e.cd = rand(2.2, 3.2);
          const a = Math.atan2(dy, dx);
          this.bullets.push({
            x: e.x + Math.cos(a) * 16,
            y: e.y + Math.sin(a) * 16,
            vx: Math.cos(a) * 620,
            vy: Math.sin(a) * 620,
            r: 3,
            life: 2.2,
            dmg: 14,
            foe: true,
          });
        }
      }

      // simple obstacle avoidance: steer around blocked path
      const step = e.speed * dt;
      const beforeX = e.x;
      const beforeY = e.y;
      this.moveEntity(e, tx * step, ty * step);
      if (Math.abs(e.x - beforeX) < 0.01 && Math.abs(e.y - beforeY) < 0.01) {
        const side = (e.x + e.y) % 2 < 1 ? Math.PI / 2 : -Math.PI / 2;
        const p = Math.atan2(ty, tx) + side;
        this.moveEntity(e, Math.cos(p) * step, Math.sin(p) * step);
      }

      // contact damage
      if (d < e.r + this.pr && this.iframe <= 0) {
        if (e.kind === "bomber") {
          e.hp = 0;
          this.explode(e.x, e.y);
        } else {
          this.damagePlayer(e.kind === "boss" ? 11 : e.kind === "brute" ? 16 : e.kind === "darter" ? 7 : 9);
        }
        const push = e.kind === "boss" ? 240 : e.kind === "brute" ? 170 : 110;
        this.pvx -= (dx / d) * push;
        this.pvy -= (dy / d) * push;
      }
    }

    // bullets
    for (const b of this.bullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) b.life = 0;
      if (this.collideRects(b.x, b.y, b.r)) {
        b.life = 0;
        this.burst(b.x, b.y, b.foe ? 12 : 185, 5, 0.5);
      }
      if (b.life <= 0) continue;

      if (b.foe) {
        if (Math.hypot(b.x - this.px, b.y - this.py) < this.pr + b.r) {
          b.life = 0;
          this.damagePlayer(b.dmg);
        }
      } else {
        for (const e of this.enemies) {
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
            b.life = 0;
            e.hp -= b.dmg;
            e.hit = 0.12;
            this.burst(b.x, b.y, 320, 6, 0.6);
            break;
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    const before = this.enemies.length;
    const SCORES: Record<EnemyKind, number> = {
      chaser: 35,
      shooter: 60,
      brute: 120,
      darter: 45,
      bomber: 70,
      sniper: 80,
      boss: 1500,
    };
    const dead: Enemy[] = [];
    this.enemies = this.enemies.filter((e) => {
      if (e.hp > 0) return true;
      this.score += SCORES[e.kind];
      this.kills[e.kind] = (this.kills[e.kind] ?? 0) + 1;
      this.burst(e.x, e.y, e.kind === "brute" ? 28 : 320, e.kind === "brute" ? 40 : 22, 1.4);
      this.rings.push({
        x: e.x,
        y: e.y,
        r: e.r,
        vr: e.kind === "brute" ? 420 : 300,
        life: 0.4,
        max: 0.4,
        hue: e.kind === "brute" ? 28 : 320,
      });
      this.shake = Math.min(24, this.shake + (e.boss ? 22 : e.kind === "brute" ? 9 : 4));
      if (e.boss) {
        this.burst(e.x, e.y, 50, 70, 2.2);
        this.rings.push({ x: e.x, y: e.y, r: e.r, vr: 720, life: 0.8, max: 0.8, hue: 50 });
      }
      dead.push(e);
      return false;
    });
    if (dead.length > 0) {
      if (dead.some((e) => e.boss)) {
        playSfx("win", 0.8);
      } else if (this.t - this.lastKillSfx > 0.15) {
        this.lastKillSfx = this.t;
        playSfx("score", 0.4);
      }
    }
    for (const e of dead) {
      if (e.kind === "bomber") this.explode(e.x, e.y);
      if (e.boss) {
        this.hp = Math.min(this.maxHp, this.hp + 30);
        const kinds: PowerKind[] = ["rapid", "shield", "double", "repair"];
        kinds.forEach((kind, i) => {
          this.pickups.push({
            x: clamp(e.x + (i - 1.5) * 46, 24, W - 24),
            y: clamp(e.y, 24, H - 24),
            kind,
            life: 16,
          });
        });
      } else {
        this.dropPickup(e.x, e.y);
      }
    }
    if (before !== this.enemies.length) this.pushHud();

    // particles
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.4;
      p.vy *= 1 - dt * 2.4;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // rings
    for (const r of this.rings) {
      r.life -= dt;
      r.r += r.vr * dt;
    }
    this.rings = this.rings.filter((r) => r.life > 0);

    // ambient motes
    for (const m of this.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < -4) {
        m.y = H + 4;
        m.x = rand(0, W);
      }
      if (m.x < -4) m.x = W + 4;
      else if (m.x > W + 4) m.x = -4;
    }

    // keep ammo HUD in sync while the magazine reloads
    if (this.ammo !== this.lastAmmo) {
      this.lastAmmo = this.ammo;
      this.pushHud();
    }
  }

  private lastAmmo = MAX_AMMO;

  private damagePlayer(amount: number) {
    if (this.iframe > 0 || this.over) return;
    if (this.shieldT > 0) {
      this.iframe = 0.35;
      this.shake = Math.min(10, this.shake + 4);
      playSfx("collision", 0.3);
      this.burst(this.px, this.py, 190, 14, 0.9);
      this.rings.push({
        x: this.px,
        y: this.py,
        r: this.pr + 8,
        vr: 240,
        life: 0.25,
        max: 0.25,
        hue: 190,
      });
      return;
    }
    this.hp -= amount;
    this.iframe = 0.55;
    this.shake = Math.min(16, this.shake + 8);
    playSfx("collision", 0.6);
    this.burst(this.px, this.py, 350, 18, 1.1);
    this.pushHud();
    if (this.hp <= 0) {
      this.hp = 0;
      this.over = true;
      this.burst(this.px, this.py, 20, 60, 1.8);
      this.rings.push({ x: this.px, y: this.py, r: this.pr, vr: 520, life: 0.6, max: 0.6, hue: 20 });
      playSfx("gameover");
      this.onOver(this.score);
    }
  }

  private draw() {
    const c = this.ctx;
    c.save();
    c.clearRect(0, 0, W, H);

    const g = c.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, "#0d1730");
    g.addColorStop(1, "#04060f");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    if (this.shake > 0.1) {
      c.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }

    // ambient motes
    for (const m of this.motes) {
      c.fillStyle = `rgba(255,242,56,${m.alpha})`;
      c.fillRect(m.x, m.y, m.size, m.size);
    }

    // grid
    c.strokeStyle = "rgba(255,224,64,0.08)";
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= W; x += 40) {
      c.moveTo(x, 0);
      c.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += 40) {
      c.moveTo(0, y);
      c.lineTo(W, y);
    }
    c.stroke();

    // pulsing neon border
    const pulse = 0.35 + 0.25 * Math.sin(this.t * 2.5);
    c.strokeStyle = `rgba(255,242,56,${pulse})`;
    c.lineWidth = 2;
    c.strokeRect(1, 1, W - 2, H - 2);
    c.strokeStyle = `rgba(255,242,56,${pulse * 0.35})`;
    c.lineWidth = 6;
    c.strokeRect(3, 3, W - 6, H - 6);

    // obstacles
    for (const o of OBSTACLES) {
      c.fillStyle = "rgba(18,34,64,0.95)";
      c.fillRect(o.x, o.y, o.w, o.h);
      c.strokeStyle = "rgba(255,242,56,0.55)";
      c.lineWidth = 1.5;
      c.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
    }

    // particles
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      c.fillStyle = `hsla(${p.hue}, 100%, 65%, ${a})`;
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    // rings
    for (const r of this.rings) {
      const a = clamp(r.life / r.max, 0, 1);
      c.strokeStyle = `hsla(${r.hue}, 100%, 65%, ${a})`;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      c.stroke();
    }

    // bullets (with glow trails)
    for (const b of this.bullets) {
      c.strokeStyle = b.foe ? "rgba(255,77,109,0.45)" : "rgba(255,255,51,0.55)";
      c.lineWidth = b.r * 1.1;
      c.beginPath();
      c.moveTo(b.x - b.vx * 0.045, b.y - b.vy * 0.045);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.shadowBlur = 14;
      c.shadowColor = b.foe ? "#ff4d6d" : "#ffff33";
      c.fillStyle = b.foe ? "#ff8fa3" : "#ffffcc";
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }

    // pickups
    for (const p of this.pickups) {
      const col = p.kind === "rapid" ? "#ffd84d" : p.kind === "shield" ? "#fff238" : p.kind === "repair" ? "#4dff9b" : "#ff4db8";
      const bob = Math.sin(this.t * 4 + p.x) * 2.5;
      const fade = p.life < 3 && Math.floor(this.t * 8) % 2 === 0 ? 0.35 : 1;
      c.save();
      c.globalAlpha = fade;
      c.translate(p.x, p.y + bob);
      c.rotate(this.t * 1.2);
      c.shadowBlur = 18;
      c.shadowColor = col;
      c.strokeStyle = col;
      c.lineWidth = 2;
      c.beginPath();
      c.rect(-11, -11, 22, 22);
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      if (p.kind === "rapid") {
        c.moveTo(-3, -7);
        c.lineTo(6, -1);
        c.lineTo(-1, 0);
        c.lineTo(3, 7);
        c.lineTo(-6, 1);
        c.lineTo(1, 0);
        c.closePath();
      } else if (p.kind === "repair") {
        c.moveTo(-2.5, -7);
        c.lineTo(2.5, -7);
        c.lineTo(2.5, -2.5);
        c.lineTo(7, -2.5);
        c.lineTo(7, 2.5);
        c.lineTo(2.5, 2.5);
        c.lineTo(2.5, 7);
        c.lineTo(-2.5, 7);
        c.lineTo(-2.5, 2.5);
        c.lineTo(-7, 2.5);
        c.lineTo(-7, -2.5);
        c.lineTo(-2.5, -2.5);
        c.closePath();
      } else if (p.kind === "shield") {
        c.moveTo(0, -7);
        c.lineTo(6, -3);
        c.lineTo(6, 3);
        c.lineTo(0, 8);
        c.lineTo(-6, 3);
        c.lineTo(-6, -3);
        c.closePath();
      } else {
        c.moveTo(-7, -6);
        c.lineTo(-2, -6);
        c.lineTo(-2, 6);
        c.lineTo(-7, 6);
        c.closePath();
        c.moveTo(2, -6);
        c.lineTo(7, -6);
        c.lineTo(7, 6);
        c.lineTo(2, 6);
        c.closePath();
      }
      c.fill();
      c.restore();
      c.shadowBlur = 0;
      c.globalAlpha = 1;
    }

    // enemies
    for (const e of this.enemies) {
      const col = e.boss ? (BOSSES[e.tier ?? 0]?.col ?? ENEMY_COL.boss) : ENEMY_COL[e.kind];
      /* sprite-first rendering, same artwork as CosNimiq Shooter */
      const img = enemyImg(e.boss ? (BOSS_SPRITE[e.tier ?? 0] ?? BOSS_SPRITE[0]!) : ENEMY_SPRITE[e.kind]);
      if (img && img.complete && img.naturalWidth) {
        const w = e.r * (e.boss ? 3.4 : 2.8);
        const h = w * (img.naturalHeight / img.naturalWidth);
        c.save();
        c.translate(e.x, e.y);
        // Enemy artwork points downward in its source image. Rotate that nose,
        // rather than its tail, toward the player's current position.
        c.rotate(Math.atan2(this.py - e.y, this.px - e.x) - Math.PI / 2);
        c.shadowBlur = e.boss ? 30 : 16;
        c.shadowColor = col;
        c.drawImage(img, -w / 2, -h / 2, w, h);
        if (e.hit > 0) {
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = 0.85;
          c.drawImage(img, -w / 2, -h / 2, w, h);
          c.globalAlpha = 1;
          c.globalCompositeOperation = "source-over";
        }
        c.restore();
        c.shadowBlur = 0;
        this.drawEnemyHealth(e, col);
        continue;
      }
      c.save();
      c.translate(e.x, e.y);
      c.rotate(Math.atan2(this.py - e.y, this.px - e.x));
      c.shadowBlur = 18;
      c.shadowColor = col;
      c.fillStyle = e.hit > 0 ? "#ffffff" : col;
      c.beginPath();
      if (e.kind === "boss") {
        // flat-top hexagonal hull
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const x = Math.cos(a) * e.r;
          const y = Math.sin(a) * e.r * 0.86;
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.closePath();
      } else if (e.kind === "brute") {
        c.rect(-e.r, -e.r, e.r * 2, e.r * 2);
      } else if (e.kind === "bomber") {
        c.arc(0, 0, e.r, 0, Math.PI * 2);
      } else if (e.kind === "sniper") {
        c.moveTo(e.r * 1.4, 0);
        c.lineTo(-e.r * 0.6, e.r * 0.7);
        c.lineTo(-e.r * 0.6, -e.r * 0.7);
        c.closePath();
      } else if (e.kind === "darter") {
        c.moveTo(e.r * 1.5, 0);
        c.lineTo(-e.r, e.r * 0.6);
        c.lineTo(-e.r * 0.2, 0);
        c.lineTo(-e.r, -e.r * 0.6);
        c.closePath();
      } else {
        c.moveTo(e.r, 0);
        c.lineTo(-e.r * 0.8, e.r * 0.8);
        c.lineTo(-e.r * 0.35, 0);
        c.lineTo(-e.r * 0.8, -e.r * 0.8);
        c.closePath();
      }
      c.fill();
      c.restore();
      c.shadowBlur = 0;
      this.drawEnemyHealth(e, col);
    }

    // player
    const blink = this.iframe > 0 && Math.floor(this.t * 20) % 2 === 0;
    const PLAYER_COLORS: Record<PlayerColor, { body: string; glow: string; cockpit: string }> = {
      yellow: { body: "#ffd84d", glow: "#ffb800", cockpit: "#342900" },
      orange: { body: "#ff922b", glow: "#ff6b00", cockpit: "#2b1200" },
      magenta: { body: "#ff4db8", glow: "#ff00aa", cockpit: "#2b061f" },
      lime: { body: "#8dff63", glow: "#52ff18", cockpit: "#102b07" },
    };
    const playerCol = PLAYER_COLORS[this.playerColor];
    c.save();
    c.translate(this.px, this.py);
    c.rotate(this.aim);
    c.shadowBlur = 22;
    c.shadowColor = playerCol.glow;
    const shipFill = blink ? "rgba(255,255,255,0.45)" : playerCol.body;
    const hex = (x: number, y: number, r: number, fill: string) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const hx = x + Math.cos(a) * r;
        const hy = y + Math.sin(a) * r;
        if (i === 0) c.moveTo(hx, hy);
        else c.lineTo(hx, hy);
      }
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      c.strokeStyle = playerCol.cockpit;
      c.lineWidth = 1.15;
      c.stroke();
    };

    // Compact honeycomb ship inspired by the supplied reference, kept within
    // the original player's visual footprint and collision radius.
    hex(8.5, 0, 6.2, shipFill);
    hex(1.5, 0, 6.2, shipFill);
    hex(-5.5, 0, 6.2, shipFill);
    hex(-1.8, -7.1, 5.5, shipFill);
    hex(-1.8, 7.1, 5.5, shipFill);
    hex(-9.5, -7.1, 5.5, shipFill);
    hex(-9.5, 7.1, 5.5, shipFill);
    hex(-13.8, 0, 5.5, shipFill);
    hex(1.5, 0, 3.3, playerCol.cockpit);
    c.restore();
    c.shadowBlur = 0;

    // shield aura
    if (this.shieldT > 0) {
      const a = this.shieldT < 2 && Math.floor(this.t * 8) % 2 === 0 ? 0.25 : 0.6;
      c.strokeStyle = `rgba(255,242,56,${a})`;
      c.lineWidth = 2.5;
      c.shadowBlur = 16;
      c.shadowColor = "#fff238";
      c.beginPath();
      c.arc(this.px, this.py, this.pr + 12 + Math.sin(this.t * 6) * 1.5, 0, Math.PI * 2);
      c.stroke();
      c.shadowBlur = 0;
    }
    // rapid-fire aura
    if (this.rapidT > 0) {
      const a = this.rapidT < 2 && Math.floor(this.t * 8) % 2 === 0 ? 0.2 : 0.5;
      c.strokeStyle = `rgba(255,216,77,${a})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(this.px, this.py, this.pr + 5, 0, Math.PI * 2);
      c.stroke();
    }
    if (this.doubleT > 0) {
      const a = this.doubleT < 2 && Math.floor(this.t * 8) % 2 === 0 ? 0.2 : 0.55;
      c.strokeStyle = `rgba(255,77,184,${a})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(this.px, this.py, this.pr + 8, 0, Math.PI * 2);
      c.stroke();
    }


    // vignette
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = v;
    c.fillRect(-20, -20, W + 40, H + 40);

    // scanlines (CRT feel)
    c.fillStyle = "rgba(0,0,0,0.09)";
    for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);

    c.restore();
  }
}
