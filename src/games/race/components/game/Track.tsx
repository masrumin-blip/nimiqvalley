import { useMemo } from "react";
import * as THREE from "three";
import {
  buildCenterLineGeometry,
  buildCurbGeometry,
  buildRoadGeometry,
  buildScenery,
  getTrack,
  TRACK_HALF_WIDTH,
} from "@/games/race/lib/track";

function useCheckerTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const cells = 8;
    const c = size / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#f5f5f2" : "#23262e";
        ctx.fillRect(x * c, y * c, c, c);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    return tex;
  }, []);
}

function Tree({
  x,
  z,
  s,
  kind,
}: {
  x: number;
  z: number;
  s: number;
  kind: number;
}) {
  if (kind === 1) {
    return (
      <group position={[x, 0, z]} scale={s}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.9, 1.2, 1.4, 6]} />
          <meshStandardMaterial color="#182332" roughness={0.35} metalness={0.75} />
        </mesh>
        <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.72, 0.1, 6, 6]} />
          <meshStandardMaterial color="#ff8a24" emissive="#ff6818" emissiveIntensity={2.2} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.62, 4.4, 6]} />
        <meshStandardMaterial color="#111b29" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <cylinderGeometry args={[0.39, 0.39, 2.8, 6]} />
        <meshStandardMaterial color="#1ff2ff" emissive="#00ddec" emissiveIntensity={1.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 4.7, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#ff9b2f" emissive="#ff6d1f" emissiveIntensity={2.5} roughness={0.18} />
      </mesh>
    </group>
  );
}

export function Track() {
  const road = useMemo(() => buildRoadGeometry(), []);
  const curbL = useMemo(() => buildCurbGeometry(-1), []);
  const curbR = useMemo(() => buildCurbGeometry(1), []);
  const centerLine = useMemo(() => buildCenterLineGeometry(), []);
  const trees = useMemo(() => buildScenery(), []);
  const checker = useCheckerTexture();

  const start = useMemo(() => {
    const { points, rights, tangents } = getTrack();
    const p = points[0]!;
    const r = rights[0]!;
    const t = tangents[0]!;
    return {
      pos: [p.x, 0.05, p.y] as [number, number, number],
      yaw: Math.atan2(t.x, t.y),
      right: r,
    };
  }, []);

  return (
    <group>
      {/* grass */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, -20]}
        receiveShadow
      >
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#07101a" roughness={0.72} metalness={0.22} />
      </mesh>

      <mesh geometry={road} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.42} metalness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={centerLine} position={[0, 0.035, 0]}>
        <meshStandardMaterial color="#74f7ff" emissive="#16dce8" emissiveIntensity={1.7} roughness={0.28} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={curbL} receiveShadow>
        <meshStandardMaterial vertexColors emissive="#073f48" emissiveIntensity={1.1} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={curbR} receiveShadow>
        <meshStandardMaterial vertexColors emissive="#411704" emissiveIntensity={1.1} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* start / finish line */}
      <mesh
        position={start.pos}
        rotation={[-Math.PI / 2, 0, -start.yaw]}
        receiveShadow
      >
        <planeGeometry args={[TRACK_HALF_WIDTH * 2, 2.6]} />
        <meshStandardMaterial map={checker} roughness={0.8} />
      </mesh>

      {/* start gantry */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[
            start.pos[0] + start.right.x * s * (TRACK_HALF_WIDTH + 1),
            2.4,
            start.pos[2] + start.right.y * s * (TRACK_HALF_WIDTH + 1),
          ]}
          castShadow
        >
          <boxGeometry args={[0.7, 4.8, 0.7]} />
          <meshStandardMaterial color="#182536" emissive="#0aaec2" emissiveIntensity={0.7} roughness={0.3} metalness={0.8} />
        </mesh>
      ))}

      {trees.map((t, i) => (
        <Tree key={i} x={t.x} z={t.z} s={t.s} kind={t.kind} />
      ))}
    </group>
  );
}
