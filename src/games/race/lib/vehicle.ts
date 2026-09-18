const SPEED_BOOST = 1.7;

export const ACCEL = 30 * SPEED_BOOST;
export const REVERSE = 14 * SPEED_BOOST;
export const BRAKE = 26 * SPEED_BOOST;
export const DRAG = 1.1;
export const TURN = 2.6;
export const GRIP = 7.0;
export const DRIFT_GRIP = 1.5;
export const MAX_SPEED = 44 * SPEED_BOOST;

export interface VehicleState {
  px: number;
  pz: number;
  vx: number;
  vz: number;
  yaw: number;
  slip: number;
  speed: number;
}

export interface VehicleInput {
  forward: number;
  steer: number;
  handbrake: boolean;
  gripScale: number;
  powerScale: number;
  maxSpeedScale: number;
}

export function createVehicle(x: number, z: number, yaw: number): VehicleState {
  return { px: x, pz: z, vx: 0, vz: 0, yaw, slip: 0, speed: 0 };
}

export function updateVehicle(
  s: VehicleState,
  input: VehicleInput,
  dt: number,
) {
  const fdx = Math.sin(s.yaw);
  const fdz = Math.cos(s.yaw);
  const rdx = Math.cos(s.yaw);
  const rdz = -Math.sin(s.yaw);

  let vLong = s.vx * fdx + s.vz * fdz;
  let vLat = s.vx * rdx + s.vz * rdz;

  if (input.forward > 0) {
    vLong += input.forward * ACCEL * input.powerScale * dt;
  } else if (input.forward < 0) {
    if (vLong > 0.5) vLong -= BRAKE * dt;
    else vLong += input.forward * REVERSE * dt;
  }
  vLong -= vLong * DRAG * dt;
  const clamp = MAX_SPEED * Math.min(input.maxSpeedScale, 1.4);
  vLong = Math.max(-REVERSE, Math.min(clamp, vLong));

  const speedFactor = Math.min(Math.abs(vLong) / 8, 1);
  const dir = vLong < -0.2 ? -1 : 1;
  s.yaw +=
    input.steer *
    TURN *
    speedFactor *
    dir *
    (input.handbrake ? 1.45 : 1) *
    dt;

  const grip = (input.handbrake ? DRIFT_GRIP : GRIP) * input.gripScale;
  vLat *= Math.exp(-grip * dt);
  if (input.handbrake) vLong -= vLong * 0.7 * dt;

  s.vx = fdx * vLong + rdx * vLat;
  s.vz = fdz * vLong + rdz * vLat;

  s.px += s.vx * dt;
  s.pz += s.vz * dt;

  s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
  const va = Math.atan2(s.vx, s.vz);
  s.slip =
    s.speed > 0.4 ? Math.atan2(Math.sin(va - s.yaw), Math.cos(va - s.yaw)) : 0;
}

/**
 * Wall response: push out of the barrier and slide along it instead of
 * killing all momentum (which felt like glue).
 */
export function resolveWall(
  s: VehicleState,
  pushX: number,
  pushZ: number,
) {
  const len = Math.hypot(pushX, pushZ);
  if (len < 1e-6) return;
  const nx = pushX / len;
  const nz = pushZ / len;
  s.px += pushX;
  s.pz += pushZ;
  const vn = s.vx * nx + s.vz * nz;
  if (vn < 0) {
    s.vx -= vn * nx;
    s.vz -= vn * nz;
  }
  // tiny scrub only, so the car keeps rolling along the barrier
  s.vx *= 0.99;
  s.vz *= 0.99;
  s.speed = Math.hypot(s.vx, s.vz);
}
