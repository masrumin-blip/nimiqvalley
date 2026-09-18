import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Sky, Stars } from "@react-three/drei";
import { RaceScene } from "./RaceScene";

export function GameCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ position: [0, 8, 16], fov: 62, near: 0.5, far: 600 }}
    >
      <color attach="background" args={["#1d5074"]} />
      <Sky
        distance={450}
        sunPosition={[-70, 18, -100]}
        inclination={0.52}
        azimuth={0.18}
        turbidity={7}
        rayleigh={2.6}
        mieCoefficient={0.008}
        mieDirectionalG={0.82}
      />
      <Stars radius={230} depth={80} count={900} factor={2.2} saturation={0.45} fade speed={0.25} />
      <fog attach="fog" args={["#2b6686", 115, 410]} />

      <hemisphereLight args={["#b7ebff", "#17283c", 1.25]} />
      <directionalLight
        position={[60, 90, 40]}
        color="#b9dcff"
        intensity={1.9}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-125}
        shadow-camera-right={125}
        shadow-camera-top={125}
        shadow-camera-bottom={-125}
        shadow-camera-far={380}
      />

      <Environment>
        <Lightformer
          intensity={2.2}
          color="#d7f5ff"
          position={[0, 12, 0]}
          scale={[24, 24, 1]}
          rotation-x={Math.PI / 2}
        />
        <Lightformer
          intensity={2.4}
          color="#00dffc"
          position={[-14, 4, -6]}
          rotation-y={Math.PI / 2}
          scale={[30, 4, 1]}
        />
        <Lightformer
          intensity={1.9}
          color="#ff7b23"
          position={[16, 6, 4]}
          rotation-y={-Math.PI / 2}
          scale={[24, 3, 1]}
        />
      </Environment>

      <Suspense fallback={null}>
        <RaceScene />
      </Suspense>
    </Canvas>
  );
}
