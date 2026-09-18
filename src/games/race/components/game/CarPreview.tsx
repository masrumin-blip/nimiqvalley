import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useRef } from "react";
import type * as THREE from "three";
import { Car } from "./Car";
import { colorById } from "@/games/race/lib/colors";
import { useGame } from "@/games/race/store/game";

function Turntable({ body, accent }: { body: string; accent: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (g.current) g.current.rotation.y += Math.min(delta, 0.05) * 0.6;
  });
  return (
    <group ref={g} position={[0, -0.5, 0]}>
      <Car body={body} accent={accent} />
    </group>
  );
}

export function CarPreview() {
  const colorId = useGame((s) => s.colorId);
  const color = colorById(colorId);

  return (
    <div className="relative h-44 w-full overflow-hidden rounded-md border border-border bg-sky">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-px bg-primary" />
      <p className="pointer-events-none absolute left-3 top-3 z-10 font-display text-xs font-bold uppercase text-muted-foreground">Garage 01</p>
      <Canvas dpr={[1, 1.5]} camera={{ position: [4.5, 2.6, 5.5], fov: 40 }}>
        <hemisphereLight args={["#dff2ff", "#7bbf6a", 1.1]} />
        <directionalLight position={[5, 8, 4]} intensity={1.6} />
        <Environment>
          <Lightformer intensity={1.6} position={[0, 6, 2]} scale={[8, 8, 1]} />
        </Environment>
        <Turntable body={color.body} accent={color.accent} />
      </Canvas>
    </div>
  );
}
