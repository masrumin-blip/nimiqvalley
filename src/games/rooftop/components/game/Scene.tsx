import { Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { Runner } from "./Runner";
import { playSfx } from "@/lib/sfx";
import {
  makeNext,
  obstaclePos,
  resetIds,
  speedAt,
  timeBoostAt,
  START_PLATFORM,
  type Coin,
  type Obstacle,
  type Platform,
} from "./world";

const GRAVITY = 34;
const JUMP_V = 14.2;
const STRAFE = 11;
const WORLD_AHEAD = 420;
const WORLD_BEHIND = 90;
const PLAYER_SIZE = new THREE.Vector3(0.8, 1.8, 0.8);
const playerBox = new THREE.Box3();
const obstacleBox = new THREE.Box3();
const samplePlayer = new THREE.Vector3();
const sampleObstacle = new THREE.Vector3();
const obstacleSize = new THREE.Vector3();

/** Swept box test so fast frames never tunnel straight through an obstacle. */
function sweptObstacleHit(
  previous: { x: number; y: number; z: number },
  current: { x: number; y: number; z: number },
  o: Obstacle,
  roofTop: number,
  time: number,
  dt: number,
) {
  const [prevOx, prevOz] = obstaclePos(o, time - dt);
  const [ox, oz] = obstaclePos(o, time);
  const relativeTravel = Math.hypot(
    current.x - previous.x - (ox - prevOx),
    current.z - previous.z - (oz - prevOz),
  );
  const steps = Math.min(12, Math.max(1, Math.ceil(relativeTravel / 0.3)));
  obstacleSize.set(o.w, o.h, o.d);

  for (let step = 0; step <= steps; step++) {
    const a = step / steps;
    samplePlayer.set(
      THREE.MathUtils.lerp(previous.x, current.x, a),
      THREE.MathUtils.lerp(previous.y, current.y, a) + PLAYER_SIZE.y / 2,
      THREE.MathUtils.lerp(previous.z, current.z, a),
    );
    sampleObstacle.set(
      THREE.MathUtils.lerp(prevOx, ox, a),
      roofTop + o.h / 2,
      THREE.MathUtils.lerp(prevOz, oz, a),
    );
    playerBox.setFromCenterAndSize(samplePlayer, PLAYER_SIZE);
    obstacleBox.setFromCenterAndSize(sampleObstacle, obstacleSize);
    if (playerBox.intersectsBox(obstacleBox)) return true;
  }
  return false;
}

export type Controls = {
  left: boolean;
  right: boolean;
  jumpQueued: boolean;
};

type Props = {
  playing: boolean;
  controls: React.RefObject<Controls>;
  onScore: (coins: number, meters: number, speed: number) => void;
  onDead: (coins: number, meters: number, cause: "obstacle" | "fall") => void;
  runId: number;
};

const roofColors = ["#d9b184", "#c78a63", "#9aa7b6", "#bb9c6d", "#8d9c88"];
const wallColors = ["#5d4c44", "#4c4a57", "#6b574a", "#464f59"];

function CrateBody({ o }: { o: Obstacle }) {
  return (
    <group>
      <mesh position={[0, o.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[o.w, o.h, o.d]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.9} />
      </mesh>
      <mesh position={[0, o.h + 0.03, 0]} castShadow>
        <boxGeometry args={[o.w + 0.08, 0.08, o.d + 0.08]} />
        <meshStandardMaterial color="#5e4630" roughness={0.9} />
      </mesh>
    </group>
  );
}

function BarrierBody({ o }: { o: Obstacle }) {
  return (
    <group>
      <mesh position={[0, o.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[o.w, o.h, o.d]} />
        <meshStandardMaterial color="#464f5c" roughness={0.8} />
      </mesh>
      <mesh position={[0, o.h + 0.08, 0]} castShadow>
        <boxGeometry args={[o.w, 0.16, o.d + 0.18]} />
        <meshStandardMaterial
          color="#ff8a5c"
          emissive="#ff6a3c"
          emissiveIntensity={0.5}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

function PillarBody({ o }: { o: Obstacle }) {
  return (
    <group>
      <mesh position={[0, o.h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[o.w / 2, o.w / 2 + 0.12, o.h, 10]} />
        <meshStandardMaterial color="#5a5f6b" roughness={0.85} />
      </mesh>
      <mesh position={[0, o.h * 0.72, 0]} castShadow>
        <torusGeometry args={[o.w / 2 + 0.06, 0.07, 8, 18]} />
        <meshStandardMaterial
          color="#ffb347"
          emissive="#ff8a1f"
          emissiveIntensity={0.6}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

function DroneBody({ o }: { o: Obstacle }) {
  return (
    <group>
      <mesh position={[0, o.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[o.w, o.h, o.d]} />
        <meshStandardMaterial color="#3d4250" roughness={0.7} />
      </mesh>
      <mesh position={[0, o.h + 0.05, 0]} castShadow>
        <boxGeometry args={[o.w + 0.18, 0.2, o.d + 0.2]} />
        <meshStandardMaterial
          color="#ff6b5b"
          emissive="#ff4f3c"
          emissiveIntensity={0.7}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[o.w + 0.4, o.d + 0.4]} />
        <meshBasicMaterial color="#2a2733" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function ObstacleMesh({ o, top }: { o: Obstacle; top: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const [x, z] = obstaclePos(o, clock.elapsedTime);
    ref.current.position.set(x, top, z);
  });

  return (
    <group ref={ref} position={[o.x, top, o.z]}>
      {o.kind === "crate" && <CrateBody o={o} />}
      {o.kind === "barrier" && <BarrierBody o={o} />}
      {o.kind === "pillar" && <PillarBody o={o} />}
      {(o.kind === "slide" || o.kind === "pace") && <DroneBody o={o} />}
    </group>
  );
}

/** Flat-top hexagonal neon-yellow coin. */
function CoinMesh({ coin, taken }: { coin: Coin; taken: React.RefObject<Set<number>> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const gone = taken.current.has(coin.id);
    if (g.visible !== !gone) g.visible = !gone;
    if (gone) return;
    g.rotation.y = clock.elapsedTime * 2.2;
    g.position.y = coin.y + Math.sin(clock.elapsedTime * 2.4 + coin.id) * 0.12;
  });
  return (
    <group ref={ref} position={[coin.x, coin.y, coin.z]}>
      {/* upright flat-topped hexagonal coin, spinning around the vertical axis */}
      <mesh rotation-x={Math.PI / 2} rotation-y={Math.PI / 6}>
        <cylinderGeometry args={[0.42, 0.42, 0.12, 6]} />
        <meshStandardMaterial
          color="#ffe14d"
          emissive="#ffd000"
          emissiveIntensity={1.5}
          metalness={0.5}
          roughness={0.25}
        />
      </mesh>
      <mesh rotation-x={Math.PI / 2} rotation-y={Math.PI / 6}>
        <cylinderGeometry args={[0.5, 0.5, 0.04, 6]} />
        <meshBasicMaterial color="#fff59a" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function Building({ p, taken }: { p: Platform; taken: React.RefObject<Set<number>> }) {
  const i = Math.floor(p.tint * roofColors.length) % roofColors.length;
  const roof = roofColors[i] ?? "#c9a06b";
  const wall = wallColors[i % wallColors.length] ?? "#5c4c42";
  const bodyH = 60 + p.top;
  return (
    <group>
      <group position={[p.x, 0, p.z + p.len / 2]}>
        <mesh position={[0, p.top - 0.4, 0]} receiveShadow castShadow>
          <boxGeometry args={[p.w, 0.8, p.len]} />
          <meshStandardMaterial color={roof} roughness={0.95} />
        </mesh>
        <mesh position={[0, p.top - 0.8 - bodyH / 2, 0]}>
          <boxGeometry args={[p.w - 0.3, bodyH, p.len - 0.3]} />
          <meshStandardMaterial color={wall} roughness={1} />
        </mesh>
        <mesh position={[p.w / 2 - 0.2, p.top + 0.3, 0]}>
          <boxGeometry args={[0.4, 0.7, p.len]} />
          <meshStandardMaterial color="#f3e2c4" roughness={0.9} />
        </mesh>
        <mesh position={[-p.w / 2 + 0.2, p.top + 0.3, 0]}>
          <boxGeometry args={[0.4, 0.7, p.len]} />
          <meshStandardMaterial color="#f3e2c4" roughness={0.9} />
        </mesh>
      </group>
      {p.obstacles.map((o) => (
        <ObstacleMesh key={o.id} o={o} top={p.top} />
      ))}
      {p.coins.map((c) => (
        <CoinMesh key={c.id} coin={c} taken={taken} />
      ))}
    </group>
  );
}

function Skyline() {
  const blocks = useMemo(() => {
    const out: { x: number; z: number; h: number; w: number; c: string }[] = [];
    for (let i = 0; i < 110; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      out.push({
        x: side * (24 + Math.random() * 80),
        z: -100 + Math.random() * 1100,
        h: 14 + Math.random() * 52,
        w: 8 + Math.random() * 14,
        c: (["#4d4856", "#584f66", "#6d5f65", "#3f404f"][Math.floor(Math.random() * 4)] ??
          "#4a4653") as string,
      });
    }
    return out;
  }, []);
  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2 - 18, b.z]}>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshStandardMaterial color={b.c} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Sun() {
  return (
    <group>
      <mesh position={[-30, 34, 420]}>
        <circleGeometry args={[26, 48]} />
        <meshBasicMaterial color="#ffdcab" transparent opacity={0.9} />
      </mesh>
      <mesh position={[-30, 34, 424]}>
        <circleGeometry args={[46, 48]} />
        <meshBasicMaterial color="#ffc98c" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

export function Scene({ playing, controls, onScore, onDead, runId }: Props) {
  const player = useRef<THREE.Group>(null);
  const legA = useRef<THREE.Group>(null);
  const legB = useRef<THREE.Group>(null);
  const armA = useRef<THREE.Group>(null);
  const armB = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);

  const state = useRef({
    x: 0,
    y: 0,
    z: 0,
    vy: 0,
    grounded: true,
    dead: false,
    step: 0,
    coyote: 0,
    coins: 0,
    time: 0,
  });
  const milestone = useRef(0);
  const taken = useRef<Set<number>>(new Set());
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const list = useRef<Platform[]>([]);
  const scoreTick = useRef(0);

  useEffect(() => {
    resetIds();
    const seed: Platform[] = [START_PLATFORM];
    for (let i = 0; i < 18; i++)
      seed.push(makeNext(seed[seed.length - 1]!, seed[seed.length - 1]!.z));
    list.current = seed;
    taken.current = new Set();
    setPlatforms(seed);
    state.current = {
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      grounded: true,
      dead: false,
      step: 0,
      coyote: 0,
      coins: 0,
      time: 0,
    };
    milestone.current = 0;
    if (player.current) player.current.position.set(0, 0, 0);
  }, [runId]);

  useFrame(({ camera, clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const s = state.current;
    const g = player.current;
    if (!g) return;

    if (playing && !s.dead) {
      const previous = { x: s.x, y: s.y, z: s.z };
      s.time += dt;
      const speed = speedAt(s.z) * timeBoostAt(s.time);
      s.z += speed * dt;

      const c = controls.current;
      // Camera looks down +Z, so screen-right is -X: map inputs accordingly.
      let vx = 0;
      if (c.left) vx += STRAFE;
      if (c.right) vx -= STRAFE;
      s.x += vx * dt;
      s.x = Math.max(-26, Math.min(26, s.x));

      let support: Platform | null = null;
      for (const p of list.current) {
        if (s.z >= p.z && s.z <= p.z + p.len && Math.abs(s.x - p.x) <= p.w / 2) {
          support = p;
          break;
        }
      }

      if (c.jumpQueued && (s.grounded || s.coyote > 0)) {
        s.vy = JUMP_V;
        s.grounded = false;
        s.coyote = 0;
        playSfx("jump", 0.7);
      }
      c.jumpQueued = false;

      s.vy -= GRAVITY * dt;
      s.y += s.vy * dt;

      if (support && s.vy <= 0 && s.y <= support.top && s.y > support.top - 3.2) {
        if (!s.grounded) playSfx("land", 0.6);
        s.y = support.top;
        s.vy = 0;
        s.grounded = true;
        s.coyote = 0.12;
      } else {
        if (s.grounded) s.coyote = 0.12;
        s.grounded = false;
        s.coyote = Math.max(0, s.coyote - dt);
      }

      const t = clock.elapsedTime;

      // Coin pickup.
      for (const p of list.current) {
        if (p.z > s.z + 20 || p.z + p.len < s.z - 60) continue;
        for (const coin of p.coins) {
          if (taken.current.has(coin.id)) continue;
          if (Math.abs(coin.z - s.z) > 1.3) continue;
          if (Math.abs(coin.x - s.x) > 1.2) continue;
          if (Math.abs(coin.y - (s.y + 0.9)) > 1.5) continue;
          taken.current.add(coin.id);
          s.coins += 1;
          playSfx("coin", 0.5);
        }
      }

      // Swept box collision catches impacts between frames at higher speeds.
      let obstacleHit = false;
      for (const p of list.current) {
        if (p.z > s.z + 14 || p.z + p.len < s.z - 14) continue;
        for (const o of p.obstacles) {
          if (!sweptObstacleHit(previous, s, o, p.top, t, dt)) continue;
          obstacleHit = true;
          break;
        }
        if (obstacleHit) break;
      }
      if (obstacleHit) {
        s.dead = true;
        playSfx("collision");
        playSfx("gameover", 0.7);
        onDead(s.coins, Math.floor(s.z), "obstacle");
      }

      if (s.y < -14 && !s.dead) {
        s.dead = true;
        playSfx("gameover", 0.7);
        onDead(s.coins, Math.floor(s.z), "fall");
      }

      const last = list.current[list.current.length - 1]!;
      if (last.z < s.z + WORLD_AHEAD) {
        const grown = [...list.current, makeNext(last, s.z)].filter(
          (p) => p.z + p.len > s.z - WORLD_BEHIND,
        );
        list.current = grown;
        setPlatforms(grown);
      }

      scoreTick.current += dt;
      if (scoreTick.current > 0.08) {
        scoreTick.current = 0;
        onScore(s.coins, Math.floor(s.z), speed);
      }
      const metersNow = Math.floor(s.z);
      if (metersNow >= milestone.current + 100) {
        milestone.current = metersNow - (metersNow % 100);
        playSfx("score", 0.5);
      }

      s.step += dt * (s.grounded ? 13 : 5);
    }

    g.position.set(s.x, s.y, s.z);
    const lean = (controls.current.left ? 1 : 0) - (controls.current.right ? 1 : 0);
    const k = Math.min(1, 8 * dt);
    g.rotation.z += (-lean * 0.2 - g.rotation.z) * k;
    g.rotation.y += (lean * 0.22 - g.rotation.y) * k;

    const swing = s.grounded ? Math.sin(s.step) * 0.95 : 0.6;
    if (legA.current) legA.current.rotation.x = swing;
    if (legB.current) legB.current.rotation.x = -swing;
    if (armA.current) armA.current.rotation.x = s.grounded ? -swing * 0.85 : -1.4;
    if (armB.current) armB.current.rotation.x = s.grounded ? swing * 0.85 : -1.4;

    const camTarget = new THREE.Vector3(s.x * 0.45, s.y + 14, s.z - 26);
    camera.position.lerp(camTarget, 1 - Math.exp(-4 * dt));
    camera.lookAt(s.x * 0.5, s.y + 2.2, s.z + 16);

    if (sun.current) {
      sun.current.position.set(s.x + 26, 46, s.z + 12);
      sun.current.target.position.set(s.x, s.y, s.z);
      sun.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <color attach="background" args={["#f7bd91"]} />
      <fog attach="fog" args={["#f3b48c", 110, 370]} />
      <ambientLight intensity={0.72} color="#ffdcba" />
      <hemisphereLight intensity={0.6} color="#ffe0bd" groundColor="#4a3b39" />
      <directionalLight
        ref={sun}
        intensity={2.5}
        color="#ffd6a8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-far={160}
      />
      <Environment>
        <Lightformer intensity={2} position={[0, 8, 0]} scale={[14, 14, 1]} color="#ffe6cb" />
        <Lightformer
          intensity={1.2}
          color="#93bade"
          position={[-8, 2, -4]}
          rotation-y={Math.PI / 2}
          scale={[24, 6, 1]}
        />
      </Environment>
      <Sun />
      <Skyline />
      {platforms.map((p) => (
        <Building key={p.id} p={p} taken={taken} />
      ))}
      <Runner ref={player} legA={legA} legB={legB} armA={armA} armB={armB} />
    </>
  );
}
