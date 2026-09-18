import { forwardRef } from "react";
import * as THREE from "three";

type Limb = React.RefObject<THREE.Group | null>;

const SKIN = "#e8b58c";
const SHIRT = "#3f6fb5";
const PANTS = "#39414f";
const SHOE = "#f2f0ea";
const HAIR = "#3a2b24";

/** A plain, ordinary runner: t-shirt, shorts, sneakers. Nothing fancy. */
export const Runner = forwardRef<
  THREE.Group,
  { legA: Limb; legB: Limb; armA: Limb; armB: Limb }
>(function Runner({ legA, legB, armA, armB }, ref) {
  return (
    <group ref={ref}>
      {/* torso */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.68, 6, 16]} />
        <meshStandardMaterial color={SHIRT} roughness={0.7} />
      </mesh>
      {/* hips */}
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[0.52, 0.26, 0.34]} />
        <meshStandardMaterial color={PANTS} roughness={0.85} />
      </mesh>
      {/* neck */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.1, 0.16, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.74, 0]} castShadow>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>
      {/* hair */}
      <mesh position={[0, 1.8, -0.02]} castShadow>
        <sphereGeometry args={[0.253, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
        <meshStandardMaterial color={HAIR} roughness={0.9} />
      </mesh>
      {/* arms */}
      <group ref={armA} position={[-0.37, 1.36, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.095, 0.2, 4, 10]} />
          <meshStandardMaterial color={SHIRT} roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.45, 0]} castShadow>
          <capsuleGeometry args={[0.085, 0.26, 4, 10]} />
          <meshStandardMaterial color={SKIN} roughness={0.8} />
        </mesh>
      </group>
      <group ref={armB} position={[0.37, 1.36, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.095, 0.2, 4, 10]} />
          <meshStandardMaterial color={SHIRT} roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.45, 0]} castShadow>
          <capsuleGeometry args={[0.085, 0.26, 4, 10]} />
          <meshStandardMaterial color={SKIN} roughness={0.8} />
        </mesh>
      </group>
      {/* legs */}
      <group ref={legA} position={[-0.16, 0.66, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.18, 4, 10]} />
          <meshStandardMaterial color={PANTS} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.44, 0]} castShadow>
          <capsuleGeometry args={[0.095, 0.24, 4, 10]} />
          <meshStandardMaterial color={SKIN} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.62, 0.07]} castShadow>
          <boxGeometry args={[0.19, 0.13, 0.33]} />
          <meshStandardMaterial color={SHOE} roughness={0.7} />
        </mesh>
      </group>
      <group ref={legB} position={[0.16, 0.66, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.18, 4, 10]} />
          <meshStandardMaterial color={PANTS} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.44, 0]} castShadow>
          <capsuleGeometry args={[0.095, 0.24, 4, 10]} />
          <meshStandardMaterial color={SKIN} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.62, 0.07]} castShadow>
          <boxGeometry args={[0.19, 0.13, 0.33]} />
          <meshStandardMaterial color={SHOE} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
});
