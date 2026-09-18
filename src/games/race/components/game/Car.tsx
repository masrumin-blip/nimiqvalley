import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  body: string;
  accent: string;
  speedRef?: React.RefObject<number>;
  ghost?: boolean;
};

/** Low-poly cartoon racer built from primitives so any body colour works. */
export function Car({ body, accent, speedRef, ghost = false }: Props) {
  const wheels = useRef<THREE.Group>(null);
  const wheelPositions: [number, number, number][] = [
    [-1.0, 0.42, 1.35],
    [1.0, 0.42, 1.35],
    [-1.0, 0.42, -1.35],
    [1.0, 0.42, -1.35],
  ];

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    if (!wheels.current || !speedRef) return;
    const spin = (speedRef.current ?? 0) * delta * 1.4;
    for (const w of wheels.current.children) w.rotation.x -= spin;
  });

  const opacity = ghost ? 0.75 : 1;

  return (
    <group>
      {/* chassis */}
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.55, 4.1]} />
        <meshStandardMaterial
          color={body}
          roughness={0.35}
          metalness={0.25}
          transparent={ghost}
          opacity={opacity}
        />
      </mesh>
      {/* nose wedge */}
      <mesh position={[0, 0.35, 2.05]} castShadow>
        <boxGeometry args={[1.75, 0.3, 0.55]} />
        <meshStandardMaterial color={body} roughness={0.35} metalness={0.25} />
      </mesh>
      {/* cabin */}
      <mesh position={[0, 1.0, -0.25]} castShadow>
        <boxGeometry args={[1.5, 0.6, 1.9]} />
        <meshStandardMaterial color={accent} roughness={0.2} metalness={0.1} />
      </mesh>
      {/* windshield */}
      <mesh position={[0, 1.0, 0.78]} rotation={[-0.42, 0, 0]} castShadow>
        <boxGeometry args={[1.42, 0.6, 0.12]} />
        <meshStandardMaterial
          color="#1d2733"
          roughness={0.08}
          metalness={0.5}
        />
      </mesh>
      {/* side skirts */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.98, 0.36, 0]} castShadow>
          <boxGeometry args={[0.16, 0.26, 3.2]} />
          <meshStandardMaterial color="#23262e" roughness={0.7} />
        </mesh>
      ))}
      {/* spoiler */}
      <mesh position={[0, 1.05, -2.0]} castShadow>
        <boxGeometry args={[1.9, 0.12, 0.6]} />
        <meshStandardMaterial color={accent} roughness={0.3} />
      </mesh>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.82, -1.95]} castShadow>
          <boxGeometry args={[0.14, 0.42, 0.2]} />
          <meshStandardMaterial color="#23262e" roughness={0.7} />
        </mesh>
      ))}
      {/* head lights */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.55, 2.08]}>
          <boxGeometry args={[0.42, 0.2, 0.12]} />
          <meshStandardMaterial
            color="#fff4c2"
            emissive="#ffe08a"
            emissiveIntensity={0.7}
          />
        </mesh>
      ))}
      {/* tail lights */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.6, -2.06]}>
          <boxGeometry args={[0.42, 0.18, 0.1]} />
          <meshStandardMaterial
            color="#ff5a4d"
            emissive="#ff2f1f"
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
      {/* wheels — flat-top hexagon, thick neon-yellow rim, white centre */}
      <group ref={wheels}>
        {wheelPositions.map(([x, y, z]) => (
          <group key={`${x}-${z}`} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
            {/* neon-yellow hex rim (outer) */}
            <mesh castShadow>
              <cylinderGeometry args={[0.46, 0.46, 0.36, 6, 1, false, 0]} />
              <meshStandardMaterial
                color="#f4ff00"
                emissive="#dfff00"
                emissiveIntensity={1.7}
                roughness={0.28}
                metalness={0.15}
                flatShading
              />
            </mesh>
            {/* white hex centre (inner, thicker so it sits proud of the rim face) */}
            <mesh castShadow>
              <cylinderGeometry args={[0.34, 0.34, 0.42, 6, 1, false, 0]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={0.25}
                roughness={0.35}
                metalness={0.05}
                flatShading
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
