import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";

// ---------- Palette (dusk pastel) ----------
const SKY_STOPS: [string, string, string][] = [
  ["#ffd9a0", "#ff9e7d", "#c86b85"], // senja hangat
  ["#f7b7c4", "#c98bb9", "#7d6b9e"], // magenta
  ["#3b4a7a", "#6d5a94", "#b06c84"], // ungu malam
  ["#101a33", "#2b3a63", "#7a5f8a"], // malam
  ["#7fb5c9", "#e8b98a", "#f29f7d"], // fajar
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function hexLerp(h1: string, h2: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(h1), p(h2)];
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i]!, t))).join(",")})`;
}

// ---------- Terrain halus ----------
function terrainY(x: number) {
  return (
    Math.sin(x * 0.0022) * 90 +
    Math.sin(x * 0.0057 + 1.7) * 45 +
    Math.sin(x * 0.013 + 4.2) * 16
  );
}
function slopeAt(x: number) {
  return (terrainY(x + 2) - terrainY(x - 2)) / 4;
}

type Coin = { x: number; y: number; taken: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number };
type Rock = { kind: "rock"; x: number; r: number };
type Campfire = { kind: "campfire"; x: number; h: number };
type Chasm = { kind: "chasm"; x0: number; x1: number };
type Obstacle = Rock | Campfire | Chasm;
type PowerUpKind = "shield" | "magnet" | "boost";
type PowerUp = { kind: PowerUpKind; x: number; y: number; taken: boolean };
type Effects = { shield: number; magnet: number; boost: number };

const ZOOM = 0.32; // kamera 50% lebih jauh

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export default function SlideGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({
    score: 0,
    dist: 0,
    best: 0,
    effects: { shield: 0, magnet: 0, boost: 0 } as Effects,
  });
  const [state, setState] = useState<"ready" | "run" | "over">("ready");
  const stateRef = useRef(state);
  stateRef.current = state;
  const restartRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0,
      H = 0,
      raf = 0,
      last = performance.now();

    const fit = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return; // jangan kunci kanvas ke 0x0
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = w;
      H = h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    // ukur ulang begitu layout berubah (mis. kanvas sempat 0 saat mount)
    const ro = new ResizeObserver(() => {
      fit();
      computePx();
    });
    ro.observe(canvas);
    window.addEventListener("resize", fit);

    // ---------- World state ----------
    let scroll = 0;
    let speed = 0;
    let score = 0;
    let best = Number(localStorage.getItem("meluncur-best") || 0);
    let coins: Coin[] = [];
    let parts: Particle[] = [];
    let obstacles: Obstacle[] = [];
    let powerUps: PowerUp[] = [];
    let nextObsX = 0;
    let nextPowerX = 1100;
    let runTime = 0;
    let shieldUntil = 0;
    let magnetUntil = 0;
    let boostUntil = 0;
    let protectedGraceUntil = 0;
    let px = 120; // posisi x pemain (dunia), dihitung ulang di fit
    const p = { y: 0, vy: 0, rot: 0, grounded: true, airTime: 0, crouch: 0 };
    let hudTick = 0;

    const chasmAt = (wx: number) =>
      obstacles.find((o): o is Chasm => o.kind === "chasm" && wx > o.x0 && wx < o.x1);

    const spawnObstacle = (fromX: number) => {
      // kerapatan naik seiring jarak: jarak antar rintangan menyusut
      const gap = Math.max(340, 900 - (scroll / 10) * 0.12) + Math.random() * 320;
      const x = fromX + gap;
      // kesulitan dinilai dari posisi rintangan, bukan posisi pemain saat spawn
      const distM = x / 10;
      // jangan taruh rintangan di tanjakan — geser sampai lereng datar/menurun
      if (slopeAt(x) < -0.08) {
        nextObsX = x + 120;
        return;
      }
      const kinds: Obstacle["kind"][] = [];
      if (distM > 300) kinds.push("rock");
      if (distM > 800) kinds.push("campfire", "rock");
      if (distM > 1500) kinds.push("chasm");
      const kind = kinds.length ? kinds[Math.floor(Math.random() * kinds.length)]! : null;
      if (kind === "rock") {
        obstacles.push({ kind, x, r: 14 + Math.random() * 12 });
      } else if (kind === "campfire") {
        obstacles.push({ kind, x, h: 30 + Math.random() * 14 });
      } else if (kind === "chasm") {
        const wch = Math.min(120 + distM * 0.05, 300);
        obstacles.push({ kind, x0: x, x1: x + wch });
      }
      nextObsX = x;
    };

    const reset = () => {
      scroll = 0;
      speed = 300;
      score = 0;
      coins = [];
      parts = [];
      obstacles = [];
      powerUps = [];
      runTime = 0;
      shieldUntil = 0;
      magnetUntil = 0;
      boostUntil = 0;
      protectedGraceUntil = 0;
      p.vy = 0;
      p.rot = 0;
      p.grounded = true;
      p.airTime = 0;
      p.crouch = 0;
      p.y = terrainY(px);
      nextObsX = px + 600;
      for (let i = 0; i < 40; i++) {
        const x = 400 + i * 220 + Math.random() * 140;
        coins.push({ x, y: terrainY(x) - 46 - Math.random() * 30, taken: false });
      }
      for (let i = 0; i < 5; i++) {
        const x = 1100 + i * 2300;
        const kinds: PowerUpKind[] = ["shield", "magnet", "boost"];
        powerUps.push({ kind: kinds[i % kinds.length]!, x, y: terrainY(x) - 72, taken: false });
      }
      nextPowerX = 1100 + 5 * 2300;
      setHud({ score: 0, dist: 0, best, effects: { shield: 0, magnet: 0, boost: 0 } });
    };

    const computePx = () => {
      px = (W * 0.25) / ZOOM; // pemain di 25% lebar layar
    };
    computePx();
    reset();
    restartRef.current = () => {
      computePx();
      reset();
      setState("run");
      playSfx("start");
    };

    const jump = () => {
      if (stateRef.current !== "run") return;
      if (p.grounded) {
        // lompatan 30% lebih tinggi; di tanjakan tambahkan momentum mendaki
        // agar tinggi lompatan terhadap tanah tetap sama seperti di dataran
        // (kompensasi tanjakan dikurangi 25% agar tidak terlalu tinggi)
        p.vy = -728 + Math.min(slopeAt(px + scroll), 0) * speed * 0.75;
        p.grounded = false;
        p.airTime = 0;
        burst(px - 10 + scroll, p.y, 6);
        playSfx("jump", 0.6);
      }
    };
    const burst = (wx: number, y: number, n: number) => {
      for (let i = 0; i < n; i++)
        parts.push({
          x: wx,
          y,
          vx: (Math.random() - 0.7) * 160,
          vy: -Math.random() * 120,
          life: 0.5 + Math.random() * 0.3,
        });
    };

    const crash = (wx: number, y: number) => {
      burst(wx, y, 20);
      playSfx("gameover");
      if (score > best) {
        best = Math.floor(score);
        localStorage.setItem("meluncur-best", String(best));
      }
      setHud({ score: Math.floor(score), dist: Math.floor(scroll / 10), best, effects: { shield: 0, magnet: 0, boost: 0 } });
      setState("over");
    };

    const isProtected = () => runTime < shieldUntil || runTime < boostUntil || runTime < protectedGraceUntil;
    const absorbCrash = (wx: number, y: number) => {
      if (!isProtected()) return false;
      // shield tidak langsung habis saat menabrak — sisa durasinya tetap berjalan
      protectedGraceUntil = runTime + 0.8;
      burst(wx, y, 14);
      playSfx("collision", 0.5);
      return true;
    };

    const down = (e: Event) => {
      e.preventDefault();
      if (stateRef.current === "ready") { setState("run"); playSfx("start"); }
      else if (stateRef.current === "over") restartRef.current();
      else jump();
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", down);

    // ---------- Loop ----------
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const running = stateRef.current === "run";

      if (running) {
        runTime += dt;
        // kecepatan naik halus tanpa lonjakan: mulai cukup kencang, lalu bertambah linear
        // setelah mencapai maksimum, jangan pernah dikurangi lagi
        const ramp = Math.min(1, runTime / 60); // penuh setelah 1 menit
        const baseSpeed = 300 + (560 - 300) * ramp;
        const target = baseSpeed * (runTime < boostUntil ? 1.5 : 1);
        if (target > speed) {
          speed = lerp(speed, target, Math.min(1, dt * 2.5));
        }
        scroll += speed * dt;
        const wx = px + scroll;
        const ty = terrainY(wx);
        const inChasm = chasmAt(wx);

        if (p.grounded) {
          if (inChasm) {
            // kehabisan tanah di atas jurang
            p.grounded = false;
            p.vy = Math.max(slopeAt(wx) * speed * 0.4, 0);
          } else {
            const s = slopeAt(wx);
            p.y = ty;
            p.rot = Math.atan(s);
            p.vy = s * speed;
            p.crouch = Math.max(p.crouch - dt * 5, 0);
            if (s < -0.55) {
              p.grounded = false;
              p.vy = s * speed * 0.9;
            }
            if (Math.random() < 0.5)
              parts.push({ x: wx - 8, y: ty, vx: -speed * 0.3, vy: -30, life: 0.4 });
          }
        } else {
          p.vy += 1500 * dt;
          p.y += p.vy * dt;
          p.airTime += dt;
          p.rot = lerp(p.rot, 0, 0.12);
          // jatuh ke jurang: di atas jurang, turun sedikit di bawah permukaan = tamat
          const inChasmNow = chasmAt(wx);
          if (inChasmNow && p.y > ty + 24) {
            crash(wx, ty);
          } else if (p.y > ty + 260) {
            crash(wx, ty);
          } else if (p.y >= ty && !inChasmNow) {
            p.grounded = true;
            p.rot = Math.atan(slopeAt(wx));
            p.crouch = 0.4;
            burst(wx, ty, 4);
          }
        }

        // tabrakan rintangan
        for (const o of obstacles) {
          if (o.kind === "rock") {
            const rTy = terrainY(o.x);
            if (Math.abs(o.x - wx) < o.r + 8 && p.y > rTy - o.r - 4) {
              if (absorbCrash(wx, ty)) o.x = scroll - 500;
              else crash(wx, ty);
            }
          } else if (o.kind === "campfire") {
            const pTy = terrainY(o.x);
            if (Math.abs(o.x - wx) < 9 && p.y > pTy - o.h + 6) {
              if (absorbCrash(wx, ty)) o.x = scroll - 500;
              else crash(wx, ty);
            }
          }
        }

        // spawn & bersihkan rintangan
        if (nextObsX < scroll + W / ZOOM + 400) spawnObstacle(nextObsX);
        if (obstacles.length > 40)
          obstacles = obstacles.filter((o) => (o.kind === "chasm" ? o.x1 : o.x) > scroll - 300);

        // Koin tersentuh oleh papan atau tubuh; magnet menarik koin dari sekitar pemain.
        const boardHalf = 35;
        const boardAx = wx - Math.cos(p.rot) * boardHalf;
        const boardAy = p.y - Math.sin(p.rot) * boardHalf;
        const boardBx = wx + Math.cos(p.rot) * boardHalf;
        const boardBy = p.y + Math.sin(p.rot) * boardHalf;
        const crouch = p.grounded ? p.crouch : 0;
        const bend = p.grounded ? 0.35 + crouch * 0.5 : 0.12;
        const hipY = -14;
        const shoulderX = bend * 10;
        const shoulderY = -30 + bend * 6;
        const playerScale = 1.65;
        const playerParts = [
          { x: -20, y: -1, r: 7 },
          { x: 0, y: -1, r: 7 },
          { x: 20, y: -1, r: 7 },
          { x: -8, y: -10, r: 6 },
          { x: 8, y: -11, r: 6 },
          { x: shoulderX * 0.5, y: (hipY + shoulderY) / 2, r: 7 },
          { x: shoulderX + 2, y: shoulderY - 7, r: 6 },
          { x: shoulderX + 7, y: shoulderY + 6, r: 5 },
          { x: shoulderX - 10, y: shoulderY, r: 5 },
          { x: shoulderX - 23, y: shoulderY + 2, r: 4 },
        ].map((part) => ({
          x: wx + (part.x * Math.cos(p.rot) - part.y * Math.sin(p.rot)) * playerScale,
          y: p.y + (part.x * Math.sin(p.rot) + part.y * Math.cos(p.rot)) * playerScale,
          r: part.r * playerScale,
        }));
        const touchesPlayer = (x: number, y: number, itemRadius: number) =>
          playerParts.some((part) => Math.hypot(x - part.x, y - part.y) < part.r + itemRadius);
        for (const c of coins) {
          if (!c.taken && runTime < magnetUntil) {
            const magnetDistance = Math.hypot(c.x - wx, c.y - (p.y - 24));
            if (magnetDistance < 260) {
              const pull = Math.min(dt * 5, 1);
              c.x = lerp(c.x, wx, pull);
              c.y = lerp(c.y, p.y - 20, pull);
            }
          }
          const touchesBody = touchesPlayer(c.x, c.y, 21);
          const touchesBoard = pointToSegmentDistance(c.x, c.y, boardAx, boardAy, boardBx, boardBy) < 18;
          if (
            !c.taken &&
            (touchesBody || touchesBoard)
          ) {
            c.taken = true;
            score += 25;
            burst(c.x, c.y, 8);
            playSfx("coin", 0.5);
          }
        }
        const lastCoin = coins[coins.length - 1];
        if (lastCoin && lastCoin.x < scroll + W / ZOOM + 400) {
          for (let i = 0; i < 12; i++) {
            const x = lastCoin.x + 200 + i * 220 + Math.random() * 140;
            coins.push({ x, y: terrainY(x) - 46 - Math.random() * 30, taken: false });
          }
        }
        if (coins.length > 80) coins = coins.filter((c) => c.x > scroll - 200);

        // Item bantuan sementara.
        for (const item of powerUps) {
          if (item.taken || !touchesPlayer(item.x, item.y, 31)) continue;
          item.taken = true;
          if (item.kind === "shield") shieldUntil = runTime + 6;
          else if (item.kind === "magnet") magnetUntil = runTime + 7;
          else {
            boostUntil = runTime + 4;
            shieldUntil = Math.max(shieldUntil, runTime + 4);
          }
          burst(item.x, item.y, 18);
          playSfx("powerup");
        }
        if (nextPowerX < scroll + W / ZOOM + 500) {
          const kinds: PowerUpKind[] = ["shield", "magnet", "boost"];
          const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
          powerUps.push({ kind, x: nextPowerX, y: terrainY(nextPowerX) - 72, taken: false });
          nextPowerX += 1900 + Math.random() * 900;
        }
        if (powerUps.length > 15) powerUps = powerUps.filter((item) => item.x > scroll - 300);

        hudTick += dt;
        if (hudTick > 0.15) {
          hudTick = 0;
          setHud({
            score: Math.floor(score),
            dist: Math.floor(scroll / 10),
            best,
            effects: {
              shield: Math.max(0, shieldUntil - runTime),
              magnet: Math.max(0, magnetUntil - runTime),
              boost: Math.max(0, boostUntil - runTime),
            },
          });
        }
      }

      for (const pt of parts) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 500 * dt;
        pt.life -= dt;
      }
      parts = parts.filter((pt) => pt.life > 0);

      // ---------- Gambar ----------
      const cycle = (scroll * 0.00012) % SKY_STOPS.length;
      const i0 = Math.floor(cycle);
      const [a0, a1, a2] = SKY_STOPS[i0]!;
      const [b0, b1, b2] = SKY_STOPS[(i0 + 1) % SKY_STOPS.length]!;
      const t = cycle - i0;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, hexLerp(a0, b0, t));
      g.addColorStop(0.55, hexLerp(a1, b1, t));
      g.addColorStop(1, hexLerp(a2, b2, t));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // bintang lembut dan debu cahaya yang muncul mengikuti siklus langit
      const nightAmount = Math.max(0, Math.sin((cycle / SKY_STOPS.length) * Math.PI * 2 - 1.05));
      ctx.save();
      for (let star = 0; star < 44; star++) {
        const starX = (star * 83.17 + 31) % W;
        const starY = (star * 47.63 + 19) % (H * 0.48);
        const twinkle = 0.35 + Math.abs(Math.sin(now / 900 + star * 1.7)) * 0.65;
        ctx.globalAlpha = nightAmount * twinkle * (star % 6 === 0 ? 0.9 : 0.55);
        ctx.fillStyle = star % 5 === 0 ? "#ffe6b5" : "#fff8ee";
        ctx.beginPath();
        ctx.arc(starX, starY, star % 6 === 0 ? 1.6 : 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // matahari/bulan
      const sunY = H * (0.16 + 0.2 * Math.sin(cycle * Math.PI));
      const sg = ctx.createRadialGradient(W * 0.72, sunY, 10, W * 0.72, sunY, 140);
      sg.addColorStop(0, "rgba(255,244,220,0.95)");
      sg.addColorStop(1, "rgba(255,244,220,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff6e0";
      ctx.beginPath();
      ctx.arc(W * 0.72, sunY, 24, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,246,224,0.24)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(W * 0.72, sunY, 38 + Math.sin(now / 1100) * 3, 0, Math.PI * 2);
      ctx.stroke();

      // awan panjang bergerak perlahan untuk menambah kedalaman
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = "#fff6e0";
      for (let cloud = 0; cloud < 5; cloud++) {
        const cloudX = ((cloud * 190 - scroll * (0.015 + cloud * 0.002)) % (W + 240)) - 120;
        const cloudY = H * (0.17 + (cloud % 3) * 0.075);
        ctx.beginPath();
        ctx.ellipse(cloudX, cloudY, 58, 8, -0.04, 0, Math.PI * 2);
        ctx.ellipse(cloudX + 42, cloudY + 2, 42, 6, 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const horizon = H * 0.68;
      const toSX = (wx: number) => (wx - scroll) * ZOOM;
      const toSY = (wy: number) => horizon + wy * ZOOM;

      // latar belakang polos tanpa pegunungan berbentuk segitiga


      // kabut tipis memberi kedalaman tanpa membebani render
      const mist = ctx.createLinearGradient(0, horizon - 80, 0, horizon + 120);
      mist.addColorStop(0, "rgba(255,246,224,0)");
      mist.addColorStop(0.5, "rgba(255,246,224,0.16)");
      mist.addColorStop(1, "rgba(255,246,224,0)");
      ctx.fillStyle = mist;
      ctx.fillRect(0, horizon - 80, W, 200);

      // salju utama (terpotong di jurang)
      const snowCol = hexLerp("#f6ede4", "#c9c2d4", t);
      const gaps = obstacles
        .filter((o): o is Chasm => o.kind === "chasm")
        .filter((o) => o.x1 > scroll && o.x0 < scroll + W / ZOOM)
        .sort((a, b) => a.x0 - b.x0);
      ctx.fillStyle = snowCol;
      let segStart = 0;
      const drawSeg = (fromSX: number, toSX: number) => {
        if (toSX - fromSX < 1) return;
        ctx.beginPath();
        ctx.moveTo(fromSX, H);
        for (let sx = fromSX; sx <= toSX; sx += 5) ctx.lineTo(sx, toSY(terrainY(scroll + sx / ZOOM)));
        ctx.lineTo(toSX, H);
        ctx.fill();
      };
      for (const gap of gaps) {
        const gx0 = toSX(gap.x0);
        const gx1 = toSX(gap.x1);
        drawSeg(segStart, gx0);
        // dinding jurang
        const gy0 = toSY(terrainY(gap.x0));
        const gy1 = toSY(terrainY(gap.x1));
        const dg = ctx.createLinearGradient(0, Math.min(gy0, gy1), 0, H);
        dg.addColorStop(0, "#241d33");
        dg.addColorStop(1, "#0c0918");
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.moveTo(gx0, gy0);
        ctx.lineTo(gx1, gy1);
        ctx.lineTo(gx1, H);
        ctx.lineTo(gx0, H);
        ctx.fill();
        ctx.fillStyle = snowCol;
        segStart = gx1;
      }
      drawSeg(segStart, W);

      // rintangan
      for (const o of obstacles) {
        if (o.kind === "chasm") continue;
        const sx = toSX(o.x);
        if (sx < -40 || sx > W + 40) continue;
        const baseY = toSY(terrainY(o.x));
        if (o.kind === "rock") {
          const r = o.r * ZOOM;
          ctx.fillStyle = "#4a4258";
          ctx.beginPath();
          ctx.moveTo(sx - r, baseY + 2);
          ctx.quadraticCurveTo(sx - r * 0.9, baseY - r * 1.5, sx, baseY - r * 1.35);
          ctx.quadraticCurveTo(sx + r * 0.95, baseY - r * 1.2, sx + r, baseY + 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath();
          ctx.ellipse(sx - r * 0.25, baseY - r * 1.05, r * 0.42, r * 0.2, -0.3, 0, 7);
          ctx.fill();
        } else {
          const h = o.h * ZOOM;
          // api unggun: dua batang kayu dan nyala api berlapis
          ctx.strokeStyle = "#5a382d";
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(sx - 9, baseY - 1);
          ctx.lineTo(sx + 9, baseY - 8);
          ctx.moveTo(sx + 9, baseY - 1);
          ctx.lineTo(sx - 9, baseY - 8);
          ctx.stroke();
          const flicker = Math.sin(now / 75 + o.x) * 2;
          ctx.fillStyle = "#e94f37";
          ctx.beginPath();
          ctx.moveTo(sx, baseY - h - flicker);
          ctx.bezierCurveTo(sx + 12, baseY - h * 0.55, sx + 10, baseY - 12, sx, baseY - 7);
          ctx.bezierCurveTo(sx - 11, baseY - 13, sx - 10, baseY - h * 0.5, sx, baseY - h - flicker);
          ctx.fill();
          ctx.fillStyle = "#ffd447";
          ctx.beginPath();
          ctx.moveTo(sx + 1, baseY - h * 0.72 + flicker);
          ctx.quadraticCurveTo(sx + 6, baseY - 15, sx, baseY - 9);
          ctx.quadraticCurveTo(sx - 5, baseY - 15, sx + 1, baseY - h * 0.72 + flicker);
          ctx.fill();
        }
      }

      // item: perisai, magnet, dan boost
      for (const item of powerUps) {
        if (item.taken) continue;
        const ix = toSX(item.x);
        if (ix < -30 || ix > W + 30) continue;
        const iy = toSY(item.y) + Math.sin(now / 260 + item.x) * 5;
        ctx.save();
        ctx.translate(ix, iy);
        ctx.fillStyle = item.kind === "shield" ? "#4ecdc4" : item.kind === "magnet" ? "#f26d85" : "#ffd447";
        ctx.beginPath();
        for (let side = 0; side < 6; side++) {
          const angle = -Math.PI / 2 + (side * Math.PI) / 3;
          const x = Math.cos(angle) * 15;
          const y = Math.sin(angle) * 15;
          if (side === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#fff6e0";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        if (item.kind === "shield") {
          ctx.moveTo(0, -8);
          ctx.lineTo(8, -4);
          ctx.lineTo(6, 5);
          ctx.quadraticCurveTo(0, 11, -6, 5);
          ctx.lineTo(-8, -4);
          ctx.closePath();
        } else if (item.kind === "magnet") {
          ctx.arc(0, 0, 7, 0, Math.PI);
          ctx.moveTo(-7, 0);
          ctx.lineTo(-7, -7);
          ctx.moveTo(7, 0);
          ctx.lineTo(7, -7);
        } else {
          ctx.moveTo(2, -9);
          ctx.lineTo(-5, 1);
          ctx.lineTo(1, 1);
          ctx.lineTo(-2, 9);
          ctx.lineTo(7, -2);
          ctx.lineTo(1, -2);
        }
        ctx.stroke();
        ctx.restore();
      }

      // koin hexagonal top-flat kuning dengan garis sisi neon kuning
      for (const c of coins) {
        if (c.taken) continue;
        const sx = toSX(c.x);
        if (sx < -20 || sx > W + 20) continue;
        const bob = Math.sin(now / 300 + c.x) * 4;
        const cy = toSY(c.y) + bob;
        const coinRadius = 10;

        ctx.save();
        ctx.beginPath();
        for (let side = 0; side < 6; side++) {
          // sudut mulai 0 rad -> sisi atas & bawah mendatar (top flatted)
          const angle = (side * Math.PI) / 3;
          const hx = sx + Math.cos(angle) * coinRadius;
          const hy = cy + Math.sin(angle) * coinRadius;
          if (side === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();

        // isi kuning
        ctx.fillStyle = "#ffd43a";
        ctx.shadowColor = "#ffe94a";
        ctx.shadowBlur = 16;
        ctx.fill();

        // garis sisi kuning neon
        ctx.lineJoin = "round";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,240,90,0.55)";
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#fffbaa";
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }

      // partikel
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const pt of parts) {
        ctx.globalAlpha = Math.max(pt.life * 2, 0);
        ctx.beginPath();
        ctx.arc(toSX(pt.x), toSY(pt.y), 2.2, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ---------- Pemain: snowboarder estetik ----------
      const sxp = toSX(px + scroll);
      const syp = toSY(p.y);
      const CS = ZOOM * 1.65; // tetap jelas meski kamera lebih jauh
      const crouch = p.grounded ? p.crouch : 0;
      const flutter = Math.min(speed / 700, 1);

      ctx.save();
      ctx.translate(sxp, syp);
      ctx.rotate(p.rot);
      ctx.scale(CS, CS);

      // lingkar perlindungan saat Shield atau Boost aktif
      if (runTime < shieldUntil || runTime < boostUntil || runTime < protectedGraceUntil) {
        ctx.strokeStyle = runTime < boostUntil ? "rgba(255,212,71,0.9)" : "rgba(78,205,196,0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -17, 31 + Math.sin(now / 120) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // papan snowboard
      ctx.fillStyle = "#e2603f";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(-22, -3, 46, 5, 2.5);
      else ctx.rect(-22, -3, 46, 5); // cadangan untuk browser lama
      ctx.fill();
      ctx.fillStyle = "#f6ede4";
      ctx.fillRect(-6, -3, 12, 5);

      const bend = p.grounded ? 0.35 + crouch * 0.5 : 0.12; // membungkuk saat meluncur/mendarat

      // kaki
      ctx.strokeStyle = "#2a2135";
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.beginPath(); // kaki belakang
      ctx.moveTo(-10, -3);
      ctx.lineTo(-8 + bend * 4, -13);
      ctx.stroke();
      ctx.beginPath(); // kaki depan
      ctx.moveTo(10, -3);
      ctx.lineTo(8 - bend * 2, -13);
      ctx.stroke();

      // badan (jaket senja)
      const hipY = -14;
      const shX = bend * 10;
      const shY = -14 - 16 + bend * 6;
      ctx.strokeStyle = "#d94f30";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.quadraticCurveTo(shX * 0.5, (hipY + shY) / 2, shX, shY);
      ctx.stroke();

      // lengan
      ctx.strokeStyle = "#c24428";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(shX, shY + 2);
      ctx.lineTo(shX + 9, shY + 9 + bend * 3);
      ctx.stroke();

      // kepala + kupluk
      ctx.fillStyle = "#f0c8a8";
      ctx.beginPath();
      ctx.arc(shX + 2, shY - 6, 5, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#2a2135";
      ctx.beginPath();
      ctx.arc(shX + 2, shY - 8, 5, Math.PI, 0);
      ctx.fill();

      // syal berkibar (mengikuti kecepatan & waktu)
      ctx.strokeStyle = "#ffcf6e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(shX - 1, shY - 2);
      const scLen = 16 + flutter * 14;
      for (let i = 1; i <= 5; i++) {
        const tt = i / 5;
        ctx.lineTo(
          shX - 1 - tt * scLen,
          shY - 2 + Math.sin(now / 90 + i * 1.3) * (2 + flutter * 4) * tt + tt * 3
        );
      }
      ctx.stroke();

      ctx.restore();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => {
      fit();
      computePx();
    };
    window.removeEventListener("resize", fit);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", down);
    };
  }, []);

  return (
    <div className="fixed inset-0 flex select-none items-center justify-center overflow-hidden bg-[#171225]">
      {/* Bingkai 778 × 972, mengecil proporsional di layar sempit */}
      <div className="relative aspect-[778/972] w-[min(100vw,80.04vh,778px)] overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} className="h-full w-full touch-none" />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5 font-display text-[#2a2135]">
          <div>
            <div className="text-3xl font-bold drop-shadow-sm">{hud.score}</div>
            <div className="text-xs opacity-70">score</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold drop-shadow-sm">{hud.dist} m</div>
            <div className="text-xs opacity-70">best: {hud.best}</div>
          </div>
        </div>

        {(hud.effects.shield > 0 || hud.effects.magnet > 0 || hud.effects.boost > 0) && (
          <div className="pointer-events-none absolute left-1/2 top-5 flex -translate-x-1/2 gap-2 font-display text-[11px] font-bold text-[#2a2135]">
            {hud.effects.shield > 0 && (
              <span className="rounded-full bg-[#4ecdc4]/90 px-3 py-1.5 shadow">Shield {hud.effects.shield.toFixed(1)}s</span>
            )}
            {hud.effects.magnet > 0 && (
              <span className="rounded-full bg-[#f26d85]/90 px-3 py-1.5 shadow">Magnet {hud.effects.magnet.toFixed(1)}s</span>
            )}
            {hud.effects.boost > 0 && (
              <span className="rounded-full bg-[#ffd447]/90 px-3 py-1.5 shadow">Boost {hud.effects.boost.toFixed(1)}s</span>
            )}
          </div>
        )}

        {/* Layar mulai */}
        {state === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 text-center">
            <h1 className="font-display text-5xl font-bold tracking-wide text-[#fdf6ec] drop-shadow-lg">
              Nimiq Slide
            </h1>
            <p className="mt-3 max-w-xs font-display text-sm text-[#fdf6ec]/85 drop-shadow">
              Tap to jump. Dodge rocks, campfires, and chasms. Collect coins.
            </p>
            <p className="mt-8 animate-pulse font-display text-sm font-semibold text-[#fdf6ec]">
              — tap to start —
            </p>
          </div>
        )}

        {/* Layar selesai */}
        {state === "over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 text-center">
            <h2 className="font-display text-5xl font-bold tracking-wide text-[#ffd447] drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
              Nimiq Slide
            </h2>
            <p className="mt-1 font-display text-xl font-semibold text-[#fdf6ec] drop-shadow-lg">Wiped out!</p>
            <p className="mt-2 font-display text-lg text-[#fdf6ec]/90">
              Score {hud.score} · {hud.dist} m
            </p>
            <button
              onClick={() => restartRef.current()}
              className="pointer-events-auto mt-6 rounded-full bg-[#fdf6ec] px-8 py-3 font-display text-sm font-bold text-[#2a2135] shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              Play again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
