import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Track } from "./Track";
import { Car } from "./Car";
import { CAR_COLORS, colorById, type CarColor } from "@/games/race/lib/colors";
import { touchInput, useKeyboard } from "@/games/race/hooks/useKeyboard";
import {
  createVehicle,
  resolveWall,
  updateVehicle,
  type VehicleState,
} from "@/games/race/lib/vehicle";
import { getTrack, gridPose, SAMPLES, trackCollide } from "@/games/race/lib/track";
import { hud, resetHud } from "@/games/race/lib/hud";
import { useGame, BOT_SKILLS, PLAYER_SPEED_SCALE } from "@/games/race/store/game";
import { playSfx } from "@/lib/sfx";
import { reportScore } from "@/lib/report-score";

const COUNTDOWN = 3.2;
const PLAYER_ID = "player";

type Racer = {
  id: string;
  name: string;
  color: CarColor;
  v: VehicleState;
  idx: number;
  lap: number;
  prog: number;
  lane: number;
  skill: number;
  finished: number | null;
  ref: { current: THREE.Group | null };
  speedRef: { current: number };
};

function makeRacer(
  id: string,
  name: string,
  color: CarColor,
  slot: number,
  lane: number,
  skill: number,
): Racer {
  const pose = gridPose(slot);
  return {
    id,
    name,
    color,
    v: createVehicle(pose.x, pose.z, pose.yaw),
    idx: pose.index,
    lap: 0,
    prog: 0,
    lane,
    skill,
    finished: null,
    ref: { current: null },
    speedRef: { current: 0 },
  };
}

function advanceLap(r: Racer, nextIdx: number) {
  const prev = r.idx;
  if (prev > SAMPLES * 0.75 && nextIdx < SAMPLES * 0.25) r.lap += 1;
  else if (prev < SAMPLES * 0.25 && nextIdx > SAMPLES * 0.75) r.lap -= 1;
  r.idx = nextIdx;
  r.prog = r.lap + nextIdx / SAMPLES;
}

const _offset = new THREE.Vector3(0, 5.75, -13.75);
const _look = new THREE.Vector3(0, 1.8, 9);
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _lookSmooth = new THREE.Vector3();

export function RaceScene() {
  const laps = useGame((s) => s.laps);
  const difficulty = useGame((s) => s.difficulty);
  const colorId = useGame((s) => s.colorId);
  const name = useGame((s) => s.name);
  const keys = useKeyboard();

  const player = useMemo(
    () =>
      makeRacer(
        PLAYER_ID,
        name,
        colorById(colorId),
        0,
        0,
        1,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const bots = useMemo(() => {
    const pool = CAR_COLORS.filter((c) => c.id !== colorId);
    const names = ["Rizky", "Bara", "Nadia"];
    const skills = BOT_SKILLS[useGame.getState().difficulty];
    return names.map((n, i) =>
      makeRacer(
        `bot-${i}`,
        n,
        pool[i % pool.length]!,
        i + 1,
        [-3.2, 3.2, 0][i]!,
        skills[i]!,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clock = useRef({ t: -COUNTDOWN, lapStart: 0, done: false, started: false });
  const sfxAt = useRef({ collision: -10, engine: -10 });

  useEffect(() => {
    resetHud(laps, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const c = clock.current;
    c.t += dt;
    const racing = c.t >= 0;
    hud.countdown = racing ? 0 : Math.max(1, Math.ceil(-c.t));
    if (racing && !c.started) {
      c.started = true;
      playSfx("start");
    }

    const k = keys.current;
    const keyFwd =
      (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) -
      (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const keySteer =
      (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) -
      (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0);
    const forward = racing
      ? Math.max(-1, Math.min(1, keyFwd + touchInput.throttle - touchInput.brake))
      : 0;
    const steer = Math.max(-1, Math.min(1, keySteer + touchInput.steer));
    const handbrake = racing && (k.has("Space") || touchInput.handbrake);

    // --- local player ---
    const hit = trackCollide(player.v.px, player.v.pz, player.idx);
    if (hit.offTrack) {
      resolveWall(player.v, hit.pushX, hit.pushZ);
      if (player.v.speed > 8 && c.t - sfxAt.current.collision > 0.4) {
        sfxAt.current.collision = c.t;
        playSfx("collision", 0.5);
      }
    }
    hud.offTrack = hit.offTrack;
    updateVehicle(
      player.v,
      {
        forward,
        steer,
        handbrake,
        gripScale: 1,
        powerScale: hit.offTrack ? 0.85 : PLAYER_SPEED_SCALE[difficulty],
        maxSpeedScale: PLAYER_SPEED_SCALE[difficulty],
      },
      dt,
    );
    const prevLap = player.lap;
    advanceLap(player, hit.index);
    if (racing && player.lap > prevLap && player.lap > 1) {
      const lapTime = c.t - c.lapStart;
      if (hud.bestLap === null || lapTime < hud.bestLap) hud.bestLap = lapTime;
      c.lapStart = c.t;
    }
    if (racing && player.lap > prevLap && player.lap === 1) c.lapStart = c.t;
    if (racing && player.lap > prevLap) playSfx("score", 0.6);

    if (racing && player.v.speed > 4 && c.t - sfxAt.current.engine > 0.6) {
      sfxAt.current.engine = c.t;
      playSfx("engine", Math.min(0.5, 0.15 + player.v.speed / 90));
    }

    player.speedRef.current = player.v.speed;
    if (player.ref.current) {
      player.ref.current.position.set(player.v.px, 0, player.v.pz);
      player.ref.current.rotation.y = player.v.yaw;
      player.ref.current.rotation.z = THREE.MathUtils.lerp(
        player.ref.current.rotation.z,
        -player.v.slip * 0.18,
        1 - Math.exp(-8 * dt),
      );
    }

    // --- bots ---
    const { points, rights, tangents } = getTrack();
    for (const b of bots) {
      const bHit = trackCollide(b.v.px, b.v.pz, b.idx);
      if (bHit.offTrack) resolveWall(b.v, bHit.pushX, bHit.pushZ);
      advanceLap(b, bHit.index);

      const look = Math.round(8 + b.v.speed * 0.55);
      const ti = (b.idx + look) % SAMPLES;
      const tp = points[ti]!;
      const tr = rights[ti]!;
      const tx = tp.x + tr.x * b.lane;
      const tz = tp.y + tr.y * b.lane;
      const desired = Math.atan2(tx - b.v.px, tz - b.v.pz);
      let diff = desired - b.v.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const steerB = Math.max(-1, Math.min(1, diff * 2.4));

      // curvature-based throttle
      const ahead = tangents[(b.idx + 26) % SAMPLES]!;
      const now = tangents[b.idx]!;
      const curve = Math.abs(
        Math.atan2(
          ahead.x * now.y - ahead.y * now.x,
          ahead.x * now.x + ahead.y * now.y,
        ),
      );
      const throttle = racing
        ? Math.max(0.6, 1 - curve * 0.5 - Math.abs(diff) * 0.3)
        : 0;

      updateVehicle(
        b.v,
        {
          forward: throttle,
          steer: steerB,
          handbrake: racing && Math.abs(diff) > 1.1 && b.v.speed > 32,
          gripScale: bHit.offTrack ? 0.85 : 1,
          powerScale: (bHit.offTrack ? 0.85 : 1) * b.skill,
          maxSpeedScale: 1,
        },
        dt,
      );

      // soft car-to-car push against the player
      const dx = b.v.px - player.v.px;
      const dz = b.v.pz - player.v.pz;
      const d2 = dx * dx + dz * dz;
      if (d2 < 9 && d2 > 0.001) {
        const d = Math.sqrt(d2);
        const push = (3 - d) * 0.5;
        b.v.px += (dx / d) * push;
        b.v.pz += (dz / d) * push;
        player.v.px -= (dx / d) * push;
        player.v.pz -= (dz / d) * push;
        if (c.t - sfxAt.current.collision > 0.4) {
          sfxAt.current.collision = c.t;
          playSfx("collision", 0.4);
        }
      }

      b.speedRef.current = b.v.speed;
      if (b.ref.current) {
        b.ref.current.position.set(b.v.px, 0, b.v.pz);
        b.ref.current.rotation.y = b.v.yaw;
      }
      if (racing && b.finished === null && b.lap > laps) b.finished = c.t;
    }

    // --- standings ---
    const field: { id: string; prog: number }[] = [
      { id: player.id, prog: player.prog },
      ...bots.map((b) => ({ id: b.id, prog: b.prog })),
    ];
    field.sort((a, b) => b.prog - a.prog);
    hud.position = field.findIndex((f) => f.id === player.id) + 1;
    hud.total = field.length;
    hud.speed = player.v.speed * 3.2;
    hud.lap = Math.max(1, Math.min(laps, player.lap));
    hud.time = Math.max(0, c.t);

    // --- finish ---
    if (racing && !c.done && player.lap > laps) {
      c.done = true;
      hud.finished = true;
      playSfx(hud.position === 1 ? "win" : "gameover");
      const store = useGame.getState();
      store.addResult({
        id: PLAYER_ID,
        name: player.name,
        color: player.color.body,
        time: c.t,
        isYou: true,
      });
      for (const b of bots) {
        const est =
          b.finished ?? (c.t * (laps + 1)) / Math.max(b.prog, 0.05);
        store.addResult({
          id: b.id,
          name: b.name,
          color: b.color.body,
          time: est,
          isYou: false,
        });
      }
      if (hud.bestLap !== null) reportScore("race", hud.bestLap);
      store.finishRace();
    }

    // --- chase camera ---
    const cam = state.camera as THREE.PerspectiveCamera;
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      player.v.yaw,
    );
    _camPos.copy(_offset).applyQuaternion(q);
    _camPos.add(new THREE.Vector3(player.v.px, 0, player.v.pz));
    cam.position.lerp(_camPos, 1 - Math.exp(-6 * dt));
    _camLook.copy(_look).applyQuaternion(q);
    _camLook.add(new THREE.Vector3(player.v.px, 0, player.v.pz));
    _lookSmooth.lerp(_camLook, 1 - Math.exp(-8 * dt));
    cam.lookAt(_lookSmooth);
    const targetFov = 62 + Math.min(player.v.speed, 45) * 0.34;
    cam.fov += (targetFov - cam.fov) * Math.min(1, 3 * dt);
    cam.updateProjectionMatrix();
  });

  return (
    <group>
      <Track />

      <group ref={(g) => {
          player.ref.current = g;
        }}>
        <Car
          body={player.color.body}
          accent={player.color.accent}
          speedRef={player.speedRef}
        />
      </group>

      {bots.map((b) => (
        <group key={b.id} ref={(g) => {
            b.ref.current = g;
          }}>
          <Car body={b.color.body} accent={b.color.accent} speedRef={b.speedRef} />
        </group>
      ))}

    </group>
  );
}
