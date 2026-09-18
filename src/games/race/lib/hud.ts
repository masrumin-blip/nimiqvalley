export type HudSnapshot = {
  speed: number;
  lap: number;
  laps: number;
  position: number;
  total: number;
  time: number;
  bestLap: number | null;
  countdown: number;
  offTrack: boolean;
  finished: boolean;
};

export const hud: HudSnapshot = {
  speed: 0,
  lap: 1,
  laps: 3,
  position: 1,
  total: 1,
  time: 0,
  bestLap: null,
  countdown: 0,
  offTrack: false,
  finished: false,
};

export function resetHud(laps: number, total: number) {
  hud.speed = 0;
  hud.lap = 1;
  hud.laps = laps;
  hud.position = 1;
  hud.total = total;
  hud.time = 0;
  hud.bestLap = null;
  hud.countdown = 3;
  hud.offTrack = false;
  hud.finished = false;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}
