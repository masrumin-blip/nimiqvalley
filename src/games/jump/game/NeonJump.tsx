import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, Shield, Zap } from "lucide-react";
import { playSfx } from "@/lib/sfx";
import { startGameRun, submitGameRun } from "@/lib/game-runs.functions";
import { currentLeagueId } from "@/lib/verification-info";
import {
  H,
  MOVE_SPEED,
  TICK_MS,
  W,
  createJumpSim,
  createRng,
  encodeJumpInput,
  finalJumpScore,
  stepJump,
  type Buffs,
  type FxColor,
  type Hazard,
  type Item,
  type ItemType,
  type JumpSim,
  type Laser,
  type Platform,
  type PlatformType,
  type Portal,
} from "@/games/jump/jump-sim";

type GameState = "menu" | "playing" | "paused" | "over";
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface Trail { x: number; y: number; life: number }

const C = {
  cyan: "#22d3ee", pink: "#ff3ca6", lime: "#a3e635", yellow: "#fde047",
  red: "#ff365f", purple: "#a855f7", blue: "#38bdf8", white: "#f8fafc",
  ink: "#05020d", deep: "#100625", orange: "#fb923c",
};
const ITEM_COLOR: Record<ItemType, string> = {
  coin: C.yellow, shield: C.cyan, magnet: C.red,
  jetpack: C.orange, slow: C.blue, multiplier: C.lime, life: C.pink,
};

const FX_COLOR = (c: FxColor): string =>
  c === "cyan" ? C.cyan : c === "pink" ? C.pink : c === "red" ? C.red : c === "yellow" ? C.yellow : c === "purple" ? C.purple : ITEM_COLOR[c];

type World = JumpSim & {
  rng: () => number;
  acc: number;
  lastDir: number;
  inputs: number[];
  sessionId: string | null;
  particles: Particle[];
  trails: Trail[];
  stars: { x: number; y: number; s: number }[];
};

function freshWorld(seed = 1, sessionId: string | null = null): World {
  const rng = createRng(seed);
  return {
    ...createJumpSim(rng),
    rng, acc: 0, lastDir: 0, inputs: [], sessionId,
    particles: [], trails: [],
    stars: Array.from({ length: 72 }, () => ({ x: Math.random() * W, y: Math.random() * H * 2, s: Math.random() * 2 + 0.5 })),
  };
}

export default function NeonJump() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef({ left: false, right: false });
  const touch = useRef({ left: false, right: false });
  const world = useRef<World>(freshWorld());
  const [gameState, setGameState] = useState<GameState>("menu");
  const gameStateRef = useRef<GameState>("menu");
  const [hud, setHud] = useState({ score: 0, coins: 0, buffs: freshWorld().buffs });
  const [best, setBest] = useState(0);

  useEffect(() => {
    setBest(Number(window.localStorage.getItem("neon-jump-best") || 0));
  }, []);

  const setState = useCallback((state: GameState) => {
    gameStateRef.current = state;
    setGameState(state);
  }, []);

  // Seeds come from the server so runs can be verified by replay.
  const nextSessionRef = useRef<{ sessionId: string; seed: number } | null>(null);
  const prefetchSession = useCallback(async () => {
    try {
      nextSessionRef.current = await startGameRun({ data: { slug: "jump", leagueId: currentLeagueId() } });
    } catch {
      nextSessionRef.current = null; // guest: local practice run
    }
  }, []);
  useEffect(() => {
    void prefetchSession();
  }, [prefetchSession]);

  const seedWorld = useCallback(() => {
    const session = nextSessionRef.current;
    nextSessionRef.current = null;
    const seed = session?.seed ?? Math.floor(Math.random() * 2 ** 31);
    const w = freshWorld(seed, session?.sessionId ?? null);
    world.current = w;
    setHud({ score: 0, coins: 0, buffs: { ...w.buffs } });
    void prefetchSession();
  }, [prefetchSession]);

  const start = useCallback(() => {
    seedWorld();
    setState("playing");
    playSfx("start");
  }, [seedWorld, setState]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === "playing") setState("paused");
    else if (gameStateRef.current === "paused") setState("playing");
  }, [setState]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.current.left = true;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.current.right = true;
      if (event.key.toLowerCase() === "p" || event.key === "Escape") togglePause();
      if ((event.key === " " || event.key === "Enter") && ["menu", "over"].includes(gameStateRef.current)) start();
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.current.left = false;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [start, togglePause]);

  useEffect(() => {
    if (gameState !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let last = performance.now();

    const burst = (x: number, y: number, color: string, count: number, force = 3.5) => {
      const w = world.current;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * force;
        w.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.7, life: 18 + Math.random() * 28, maxLife: 46, color, size: 1.5 + Math.random() * 3 });
      }
    };

    const finish = (w: World) => {
      const final = finalJumpScore(w);
      setBest((current) => { const value = Math.max(current, final); window.localStorage.setItem("neon-jump-best", String(value)); return value; });
      setHud({ score: final, coins: w.coins, buffs: { ...w.buffs } });
      setState("over");
      // Only the input log is sent; the server replays it and computes the score.
      const sessionId = w.sessionId;
      w.sessionId = null;
      if (sessionId) void submitGameRun({ data: { slug: "jump", sessionId, inputs: w.inputs } }).catch(() => {});
    };

    const update = (dt: number) => {
      const w = world.current;
      w.acc += dt;
      while (w.acc >= TICK_MS) {
        w.acc -= TICK_MS;
        const left = keys.current.left || touch.current.left;
        const right = keys.current.right || touch.current.right;
        const dir = left === right ? 0 : left ? 1 : 2;
        const tick = w.tick;
        if (dir !== w.lastDir) { w.inputs.push(encodeJumpInput(tick, dir)); w.lastDir = dir; }
        const ev = stepJump(w, w.rng, dir);
        for (const [name, vol] of ev.sfx) playSfx(name as Parameters<typeof playSfx>[0], vol);
        for (const [x, y, c, n, f] of ev.bursts) burst(x, y, FX_COLOR(c), n, f);
        if (ev.jet) w.trails.push({ x: w.px + (Math.random() - 0.5) * 10, y: w.py + 18, life: 20 });
        for (const particle of w.particles) { particle.x += particle.vx; particle.y += particle.vy; particle.vy += 0.12; particle.life -= 1; }
        w.particles = w.particles.filter((p) => p.life > 0);
        for (const trail of w.trails) trail.life -= 1;
        w.trails = w.trails.filter((t) => t.life > 0);
        if (ev.died) { finish(w); return false; }
      }
      setHud({ score: Math.floor(w.score), coins: w.coins, buffs: { ...w.buffs } });
      return true;
    };

    const frame = (now: number) => {
      const dt = Math.min(34, now - last); last = now;
      if (!update(dt)) return;
      draw(ctx, world.current, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [gameState, setState]);

  const hold = (direction: "left" | "right", active: boolean) => { touch.current[direction] = active; };

  return (
    <main className="game-shell">
      <div className="scanline" aria-hidden="true" />
      <section className="game-stage" aria-label="Jump for Nimiq arcade game">
        <div className="game-brand" aria-hidden="true"><span>JUMP FOR</span><b>NIMIQ</b></div>
        <div className="game-frame">
          <canvas ref={canvasRef} width={W} height={H} className="game-canvas" aria-label="Jump for Nimiq play area" />
          <div className="hud">
            <div className="hud-block cyan"><span>ALTITUDE</span><strong>{String(hud.score).padStart(5, "0")}</strong></div>
            <div className="hud-block pink"><span>BEST</span><strong>{String(best).padStart(5, "0")}</strong></div>
          </div>
           <div className="collectibles"><span className="coin-dot" aria-hidden="true" />{hud.coins}</div>
          {gameState === "playing" && <Button aria-label="Pause" title="Pause" onClick={togglePause} className="pause-button" size="icon" variant="ghost"><Pause /></Button>}
          <BuffBar buffs={hud.buffs} />
          {gameState === "menu" && <Overlay title="JUMP FOR NIMIQ" gameOver subtitle="Break through the vertical city. Dodge the traps. Master every power-up." action="START MISSION" onAction={start} />}
          {gameState === "paused" && <Overlay title="PAUSED" subtitle="Take a breath. The city will wait." action="RESUME" onAction={togglePause} secondary="RESTART" onSecondary={start} />}
           {gameState === "over" && <Overlay title="JUMP FOR NIMIQ" gameOver subtitle={`GAME OVER · Score ${hud.score} · ${hud.coins} coins`} action="TRY AGAIN" onAction={start} />}
          <div className="touch-controls" aria-label="Touch controls">
            <Button aria-label="Move left" className="control-button" onPointerDown={() => hold("left", true)} onPointerUp={() => hold("left", false)} onPointerLeave={() => hold("left", false)}>‹</Button>
            <Button aria-label="Move right" className="control-button" onPointerDown={() => hold("right", true)} onPointerUp={() => hold("right", false)} onPointerLeave={() => hold("right", false)}>›</Button>
          </div>
        </div>
        <div className="desktop-help"><span>← A</span><p>STEER THE RUNNER</p><span>D →</span></div>
      </section>
    </main>
  );
}

function BuffBar({ buffs }: { buffs: Buffs }) {
  const active = [
    (buffs.shield > 0 || buffs.jetpack > 0) && { key: "shield", label: "SHIELD", icon: <Shield />, value: 1 },
    buffs.magnet > 0 && { key: "magnet", label: "MAGNET", icon: <span>∩</span>, value: buffs.magnet / 600 },
    buffs.jetpack > 0 && { key: "jetpack", label: "JET", icon: <Zap />, value: buffs.jetpack / 120 },
    buffs.slow > 0 && { key: "slow", label: "SLOW", icon: <span>◷</span>, value: buffs.slow / 520 },
    buffs.multiplier > 0 && { key: "multi", label: "×2", icon: <span>×2</span>, value: buffs.multiplier / 600 },
    buffs.lives > 0 && { key: "life", label: `LIFE ${buffs.lives}`, icon: <span>♥</span>, value: 1 },
  ].filter(Boolean) as { key: string; label: string; icon: ReactNode; value: number }[];
  if (!active.length) return null;
  return <div className="buff-bar">{active.map((buff) => <div className="buff" key={buff.key} title={buff.label}><i>{buff.icon}</i><span style={{ transform: `scaleX(${Math.max(0, buff.value)})` }} /></div>)}</div>;
}

function Overlay({ title, subtitle, action, onAction, secondary, onSecondary, gameOver }: { title: string; subtitle: string; action: string; onAction: () => void; secondary?: string; onSecondary?: () => void; gameOver?: boolean }) {
  return <div className="game-overlay"><div className="overlay-lines" /><div className="logo-mark"><i /><i /><i /></div><h1 className={gameOver ? "game-over-title" : undefined}>{title}</h1><p>{subtitle}</p><div className="overlay-actions"><Button onClick={onAction} size="lg" className="primary-game-button"><Play />{action}</Button>{secondary && onSecondary && <Button onClick={onSecondary} variant="outline" className="secondary-game-button"><RotateCcw />{secondary}</Button>}</div><small>MOVE: A/D OR ←/→ · PAUSE: P</small></div>;
}

function draw(ctx: CanvasRenderingContext2D, w: World, time: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const zone = Math.floor(Math.max(0, -w.cameraY) / 2500) % 3;
  const gradients: [string, string][] = [["#05020d", "#16072b"], ["#02131b", "#102437"], ["#170411", "#260b27"]];
  const zoneGradient: [string, string] = gradients[zone] ?? ["#05020d", "#16072b"];
  const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, zoneGradient[0]); grad.addColorStop(1, zoneGradient[1]); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  const sx = w.shake ? (Math.random() - 0.5) * w.shake : 0, sy = w.shake ? (Math.random() - 0.5) * w.shake : 0;
  ctx.save(); ctx.translate(sx, sy);
  drawBackground(ctx, w, time, zone);
  ctx.save();
  const scale = 0.88 * 0.9; ctx.setTransform(scale, 0, 0, scale, W * (1 - scale) / 2 + sx, H * (1 - scale) / 2 + sy);
  const cam = w.cameraY;
  for (const laser of w.lasers) drawLaser(ctx, laser, cam, w.clock, w.buffs.slow > 0);
  for (const portal of w.portals) drawPortal(ctx, portal, cam, time);
  for (const p of w.platforms) drawPlatform(ctx, p, cam);
  for (const item of w.items) if (!item.collected) drawItem(ctx, item, cam, time);
  for (const h of w.hazards) if (h.alive) drawHazard(ctx, h, cam, time);
  for (const trail of w.trails) { ctx.globalAlpha = trail.life / 20; ctx.fillStyle = C.orange; ctx.shadowColor = C.orange; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(trail.x, trail.y - cam, 3 + (20 - trail.life) * 0.18, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const p of w.particles) { ctx.globalAlpha = Math.min(1, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.fillRect(p.x - p.size / 2, p.y - cam - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1; drawPlayer(ctx, w, cam, time); ctx.restore(); ctx.restore();
  if (w.flash > 0) { ctx.globalAlpha = Math.min(0.35, w.flash / 30); ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

function drawBackground(ctx: CanvasRenderingContext2D, w: World, time: number, zone: number) {
  const accent = zone === 0 ? C.purple : zone === 1 ? C.cyan : C.pink;
  const orbX = zone === 1 ? 88 : 308, orbY = 112 + ((w.cameraY * 0.025) % 70);
  const glow = ctx.createRadialGradient(orbX, orbY, 5, orbX, orbY, 88); glow.addColorStop(0, `${accent}55`); glow.addColorStop(0.5, `${accent}20`); glow.addColorStop(1, `${accent}00`); ctx.fillStyle = glow; ctx.fillRect(orbX - 95, orbY - 95, 190, 190);
  ctx.strokeStyle = `${accent}99`; ctx.shadowColor = accent; ctx.shadowBlur = 18; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(orbX, orbY, 44 + Math.sin(time / 600) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
  for (const star of w.stars) { let y = (star.y + w.cameraY * 0.2) % H; if (y < 0) y += H; ctx.globalAlpha = 0.25 + Math.abs(Math.sin(time / 900 + star.x)) * 0.5; ctx.fillStyle = C.white; ctx.fillRect(star.x, y, star.s, star.s * 2.3); }
  ctx.globalAlpha = 1;
  const skyline = (base: number, color: string, speed: number, step: number) => { const shift = ((w.cameraY * speed) % step + step) % step; ctx.fillStyle = color; for (let i = -1; i < W / step + 2; i++) { const x = i * step - shift, bh = 48 + ((i * 41 + 75) % 6) * 18; ctx.fillRect(x, base - bh, step - 5, bh); ctx.fillStyle = i % 2 ? `${C.cyan}22` : `${C.pink}20`; for (let wy = base - bh + 13; wy < base - 9; wy += 19) ctx.fillRect(x + 7, wy, 3, 6); ctx.fillStyle = color; } };
  skyline(H - 105, "#100b2bcc", 0.025, 46); skyline(H - 48, "#070817f2", 0.055, 35);
  ctx.strokeStyle = `${accent}50`; ctx.beginPath(); ctx.moveTo(0, H - 48); ctx.lineTo(W, H - 48); ctx.stroke();
  ctx.strokeStyle = `${accent}18`; for (let y = ((-w.cameraY) % 58 + 58) % 58; y < H; y += 58) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, cam: number) {
  const y = p.y - cam; if (y < -45 || y > H + 45) return;
  const colors: Record<PlatformType, string> = { normal: C.cyan, moving: C.lime, vertical: C.blue, break: C.red, spike: C.purple, spring: C.yellow, phase: C.pink, conveyor: C.orange, electric: C.red };
  const color = colors[p.type]; const opacity = p.type === "phase" ? Math.max(0.12, (Math.sin(p.timer + p.phase) + 1) / 2) : 1;
  ctx.save(); ctx.globalAlpha = opacity; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillStyle = `${C.ink}ee`; rounded(ctx, p.x, y, p.w, p.h, 5); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = `${color}50`; ctx.fillRect(p.x + 5, y + 4, p.w - 10, 2);
  if (p.type === "spike") { ctx.fillStyle = color; ctx.beginPath(); for (let i = 2; i < p.w - 8; i += 12) { ctx.moveTo(p.x + i, y); ctx.lineTo(p.x + i + 5, y - 11); ctx.lineTo(p.x + i + 10, y); } ctx.fill(); }
  if (p.type === "spring") { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(p.x + p.w / 2 - 13, y); ctx.lineTo(p.x + p.w / 2, y - 17); ctx.lineTo(p.x + p.w / 2 + 13, y); ctx.fill(); }
  if (p.type === "break") { ctx.strokeStyle = `${C.white}80`; ctx.beginPath(); ctx.moveTo(p.x + p.w * 0.3, y); ctx.lineTo(p.x + p.w * 0.46, y + p.h); ctx.lineTo(p.x + p.w * 0.62, y); ctx.stroke(); }
  if (p.type === "moving") { ctx.fillStyle = color; ctx.fillRect(p.vx > 0 ? p.x + p.w - 12 : p.x + 5, y + 4, 7, 3); }
  if (p.type === "conveyor") { ctx.fillStyle = color; for (let x = p.x + 8; x < p.x + p.w - 8; x += 15) { ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x + Math.sign(p.vx) * 6, y + 6); ctx.lineTo(x, y + 9); ctx.fill(); } }
  if (p.type === "electric" && Math.sin(p.timer + p.phase) > -0.15) { ctx.strokeStyle = C.white; ctx.shadowColor = C.red; ctx.shadowBlur = 12; ctx.beginPath(); for (let x = p.x; x < p.x + p.w - 8; x += 8) { ctx.moveTo(x, y - 3); ctx.lineTo(x + 4, y - 8); ctx.lineTo(x + 8, y - 3); } ctx.stroke(); }
  if (p.type === "vertical") { ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, y - 9); ctx.lineTo(p.x + p.w / 2 - 4, y - 4); ctx.moveTo(p.x + p.w / 2, y - 9); ctx.lineTo(p.x + p.w / 2 + 4, y - 4); ctx.stroke(); }
  ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item, cam: number, time: number) {
  const y = item.y - cam; if (y < -35 || y > H + 35) return;
  const color = ITEM_COLOR[item.type], bob = Math.sin(time / 250 + item.phase) * 4;
  ctx.save(); ctx.translate(item.x, y + bob); ctx.shadowColor = color; ctx.shadowBlur = item.type === "coin" ? 14 : 22; ctx.strokeStyle = color; ctx.fillStyle = `${C.ink}dd`; ctx.lineWidth = 2;
  if (item.type === "coin") {
    const pulse = 1 + Math.sin(time / 170 + item.phase) * 0.07;
    ctx.scale(pulse, pulse);
    ctx.rotate(time / 1000 + item.phase * 0.1);
    ctx.shadowColor = C.yellow; ctx.shadowBlur = 22; ctx.fillStyle = C.yellow; ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const angle = Math.PI / 3 * i - Math.PI / 6; const hx = Math.cos(angle) * 12, hy = Math.sin(angle) * 12; if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  else { ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 13px sans-serif"; const glyph: Record<Exclude<ItemType, "coin">, string> = { shield: "S", magnet: "U", jetpack: "J", slow: "T", multiplier: "×2", life: "♥" }; ctx.fillText(glyph[item.type as Exclude<ItemType, "coin">], 0, 1); }
  ctx.restore();
}

function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, cam: number, time: number) {
  const y = h.y - cam; if (y < -45 || y > H + 45) return; ctx.save(); ctx.translate(h.x, y); ctx.rotate(h.type === "mine" || h.type === "saw" ? time / (h.type === "saw" ? 150 : 520) + h.phase : 0); ctx.shadowColor = C.red; ctx.shadowBlur = 18; ctx.fillStyle = `${C.deep}f2`; ctx.strokeStyle = h.type === "mine" || h.type === "saw" ? C.red : h.type === "hunter" ? C.orange : C.pink; ctx.lineWidth = 2;
  if (h.type === "saw") { ctx.beginPath(); for (let i = 0; i < 20; i++) { const radius = i % 2 ? h.r : h.r + 7; const angle = i * Math.PI / 10; const x = Math.cos(angle) * radius, py = Math.sin(angle) * radius; if (i === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); }
  else if (h.type === "mine") { for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -22, 4, 10); } ctx.beginPath(); ctx.arc(0, 0, h.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = Math.sin(time / 110) > 0 ? C.white : C.red; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
  else { rounded(ctx, -17, -10, 34, 20, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = h.type === "hunter" ? C.orange : C.pink; ctx.fillRect(-7, -2, 14, 4); ctx.strokeStyle = C.cyan; ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-27, 5); ctx.moveTo(17, 0); ctx.lineTo(27, 5); ctx.stroke(); if (h.type === "hunter") { ctx.strokeStyle = C.red; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 18 + Math.sin(time / 80) * 4); ctx.stroke(); } }
  ctx.restore();
}

function drawLaser(ctx: CanvasRenderingContext2D, laser: Laser, cam: number, time: number, slowed: boolean) {
  const y = laser.y - cam; if (y < -25 || y > H + 25) return; const cycle = (time * (slowed ? 0.55 : 1) / 16 + laser.phase) % 240, firing = cycle > 105 && cycle < 190;
  ctx.save(); ctx.strokeStyle = firing ? C.red : `${C.red}55`; ctx.shadowColor = C.red; ctx.shadowBlur = firing ? 18 : 5; ctx.lineWidth = firing ? 4 : 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(laser.gapX - laser.gapW / 2, y); ctx.moveTo(laser.gapX + laser.gapW / 2, y); ctx.lineTo(W, y); ctx.stroke(); ctx.fillStyle = C.red; ctx.fillRect(0, y - 7, 8, 14); ctx.fillRect(W - 8, y - 7, 8, 14); ctx.restore();
}

function drawPortal(ctx: CanvasRenderingContext2D, portal: Portal, cam: number, time: number) {
  const y = portal.y - cam; if (y < -40 || y > H + 40) return; ctx.save(); ctx.translate(portal.x, y); ctx.rotate(time / 900 + portal.phase); ctx.shadowColor = C.purple; ctx.shadowBlur = 22; ctx.strokeStyle = C.purple; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 21, 29, 0, 0, Math.PI * 2); ctx.stroke(); ctx.rotate(-time / 420); ctx.strokeStyle = C.cyan; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, 14, 23, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, w: World, cam: number, time: number) {
  const y = w.py - cam;
  const lean = Math.max(-0.18, Math.min(0.18, w.vx * 0.035));
  const float = Math.sin(time / 130) * 1.2;
  const stride = Math.sin(time / 100) * Math.min(1, Math.abs(w.vx) / MOVE_SPEED);
  ctx.save(); ctx.translate(w.px, y); ctx.rotate(lean);
  if (w.invulnerable > 0 && Math.floor(time / 70) % 2 === 0) ctx.globalAlpha = 0.25;
  ctx.scale(0.75, 0.75);
  if (w.buffs.shield > 0 || w.buffs.jetpack > 0) { ctx.strokeStyle = C.cyan; ctx.shadowColor = C.cyan; ctx.shadowBlur = 20; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -1, 31 + Math.sin(time / 130) * 2, 0, Math.PI * 2); ctx.stroke(); }

  // Compact life-support pack behind the chibi suit.
  ctx.fillStyle = C.deep; ctx.strokeStyle = C.yellow; ctx.shadowColor = C.yellow; ctx.shadowBlur = 10; ctx.lineWidth = 1.5;
  rounded(ctx, -14, -3, 28, 22, 6); ctx.fill(); ctx.stroke();
  if (w.buffs.jetpack > 0) {
    const flame = 14 + Math.sin(time / 45) * 4;
    const flameGradient = ctx.createLinearGradient(0, 12, 0, 12 + flame);
    flameGradient.addColorStop(0, C.white); flameGradient.addColorStop(0.28, C.yellow); flameGradient.addColorStop(1, `${C.orange}00`);
    ctx.fillStyle = flameGradient; ctx.shadowColor = C.orange; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(-9, 11); ctx.lineTo(-3, 11); ctx.lineTo(-6, 12 + flame); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3, 11); ctx.lineTo(9, 11); ctx.lineTo(6, 12 + flame); ctx.closePath(); ctx.fill();
  }

  // Tiny rounded limbs exaggerate the chibi proportions.
  ctx.lineCap = "round"; ctx.strokeStyle = C.yellow; ctx.shadowColor = C.yellow; ctx.shadowBlur = 10; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-16 - stride * 2, 10 + float); ctx.moveTo(8, 4); ctx.lineTo(16 - stride * 2, 9 - float); ctx.stroke();
  ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(-17 - stride * 2, 11 + float, 4, 0, Math.PI * 2); ctx.arc(17 - stride * 2, 10 - float, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.yellow; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-5, 13); ctx.lineTo(-8 - stride * 3, 23); ctx.moveTo(5, 13); ctx.lineTo(8 + stride * 3, 23); ctx.stroke();
  ctx.strokeStyle = C.white; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-12 - stride * 3, 24); ctx.lineTo(-5 - stride * 3, 24); ctx.moveTo(5 + stride * 3, 24); ctx.lineTo(12 + stride * 3, 24); ctx.stroke();

  // Neon-yellow pressure suit with a compact control panel.
  const suit = ctx.createLinearGradient(-10, -3, 10, 17); suit.addColorStop(0, C.white); suit.addColorStop(0.28, C.yellow); suit.addColorStop(1, "#d6f000");
  ctx.fillStyle = suit; ctx.strokeStyle = C.yellow; ctx.shadowColor = C.yellow; ctx.shadowBlur = 18; ctx.lineWidth = 2;
  rounded(ctx, -11, -5, 22, 23, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.deep; rounded(ctx, -6, 4, 12, 7, 2); ctx.fill();
  ctx.fillStyle = C.cyan; ctx.fillRect(-3.5, 6, 3, 2); ctx.fillStyle = C.pink; ctx.fillRect(1, 6, 3, 2);

  // Oversized helmet and glossy dark visor create the astronaut silhouette.
  ctx.fillStyle = C.yellow; ctx.strokeStyle = C.white; ctx.shadowColor = C.yellow; ctx.shadowBlur = 22; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -13, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const visor = ctx.createLinearGradient(-12, -22, 12, -5); visor.addColorStop(0, C.cyan); visor.addColorStop(0.22, C.deep); visor.addColorStop(0.78, C.ink); visor.addColorStop(1, C.pink);
  ctx.fillStyle = visor; ctx.shadowColor = C.cyan; ctx.shadowBlur = 9; ctx.beginPath(); ctx.ellipse(0, -13, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha *= 0.72; ctx.fillStyle = C.white; ctx.beginPath(); ctx.ellipse(-5, -17, 4, 2.2, -0.35, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
}
