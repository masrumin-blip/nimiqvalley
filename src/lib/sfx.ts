/**
 * Shared Web Audio SFX kit for all games and UI clicks.
 * No audio files: every sound is synthesized with oscillators/noise.
 */

export type SfxName =
  | "click"
  | "jump"
  | "land"
  | "collision"
  | "score"
  | "coin"
  | "shoot"
  | "goal"
  | "move"
  | "select"
  | "win"
  | "lose"
  | "gameover"
  | "start"
  | "powerup"
  | "engine"
  | "splash"
  | "whoosh"
  /* board / ball game impacts */
  | "clack"
  | "rail"
  | "pocket"
  | "flick"
  | "kick"
  | "ballhit"
  | "thud";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
/** Base 0.7 raised by 120% (x2.2) for a much louder kit. */
let masterVolume = 0.7 * 2.2;

export function setSfxMuted(value: boolean) {
  muted = value;
}

export function isSfxMuted() {
  return muted;
}

export function setSfxVolume(value: number) {
  masterVolume = Math.max(0, Math.min(3, value));
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Master bus: soft-knee limiter so the boosted volume stays loud without
 * clipping/distorting when several sounds overlap.
 */
function getMaster(): AudioNode | null {
  const ac = getCtx();
  if (!ac) return null;
  if (!master) {
    master = ac.createGain();
    master.gain.value = 1;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-10, ac.currentTime);
    comp.knee.setValueAtTime(12, ac.currentTime);
    comp.ratio.setValueAtTime(6, ac.currentTime);
    comp.attack.setValueAtTime(0.003, ac.currentTime);
    comp.release.setValueAtTime(0.16, ac.currentTime);
    master.connect(comp).connect(ac.destination);
  }
  return master;
}

/** Call from a user gesture to unlock audio on iOS/Safari. */
export function primeSfx() {
  getCtx();
}

interface ToneOpts {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({
  freq,
  to,
  dur = 0.12,
  type = "square",
  gain = 0.1,
  delay = 0,
}: ToneOpts) {
  const ac = getCtx();
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  const peak = Math.max(0.0002, gain * masterVolume);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const out = getMaster() ?? ac.destination;
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({
  dur = 0.15,
  gain = 0.1,
  delay = 0,
  filter = 1200,
  type = "lowpass" as BiquadFilterType,
  sweepTo,
}: {
  dur?: number;
  gain?: number;
  delay?: number;
  filter?: number;
  type?: BiquadFilterType;
  sweepTo?: number;
}) {
  const ac = getCtx();
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const bq = ac.createBiquadFilter();
  bq.type = type;
  bq.frequency.setValueAtTime(filter, t0);
  if (sweepTo) bq.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
  const g = ac.createGain();
  const peak = Math.max(0.0002, gain * masterVolume);
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const out = getMaster() ?? ac.destination;
  src.connect(bq).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** Play a named sound effect. Safe to call anywhere (no-ops on the server). */
export function playSfx(name: SfxName, volume = 1) {
  if (muted) return;
  const v = volume;
  switch (name) {
    case "click":
      /* tight noise transient + snappy body = a crisper, more tactile click */
      noise({ dur: 0.016, gain: 0.09 * v, filter: 5200, type: "highpass" });
      tone({ freq: 1500, to: 620, dur: 0.028, type: "square", gain: 0.075 * v });
      tone({ freq: 240, to: 150, dur: 0.05, type: "triangle", gain: 0.05 * v, delay: 0.012 });
      break;
    case "select":
      tone({ freq: 520, to: 780, dur: 0.07, type: "triangle", gain: 0.06 * v });
      break;
    case "jump":
      tone({ freq: 320, to: 760, dur: 0.16, type: "square", gain: 0.08 * v });
      break;
    case "land":
      tone({ freq: 220, to: 90, dur: 0.1, type: "triangle", gain: 0.07 * v });
      noise({ dur: 0.08, gain: 0.04 * v, filter: 700 });
      break;
    case "collision":
      tone({ freq: 180, to: 60, dur: 0.22, type: "sawtooth", gain: 0.11 * v });
      noise({ dur: 0.18, gain: 0.08 * v, filter: 1400, sweepTo: 200 });
      break;
    case "score":
      tone({ freq: 660, dur: 0.08, type: "square", gain: 0.06 * v });
      tone({ freq: 990, dur: 0.11, type: "square", gain: 0.06 * v, delay: 0.07 });
      break;
    case "coin":
      tone({ freq: 1180, dur: 0.06, type: "square", gain: 0.05 * v });
      tone({ freq: 1560, dur: 0.1, type: "square", gain: 0.05 * v, delay: 0.05 });
      break;
    case "shoot":
      tone({ freq: 720, to: 180, dur: 0.12, type: "sawtooth", gain: 0.08 * v });
      noise({ dur: 0.07, gain: 0.05 * v, filter: 2600, sweepTo: 600 });
      break;
    case "goal":
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, dur: 0.16, type: "square", gain: 0.07 * v, delay: i * 0.09 }),
      );
      noise({ dur: 0.5, gain: 0.03 * v, filter: 3000, type: "bandpass" });
      break;
    case "move":
      tone({ freq: 420, to: 520, dur: 0.05, type: "triangle", gain: 0.05 * v });
      break;
    case "powerup":
      [440, 587, 740, 880].forEach((f, i) =>
        tone({ freq: f, dur: 0.1, type: "triangle", gain: 0.06 * v, delay: i * 0.05 }),
      );
      break;
    case "start":
      tone({ freq: 392, dur: 0.12, type: "square", gain: 0.07 * v });
      tone({ freq: 659, dur: 0.18, type: "square", gain: 0.07 * v, delay: 0.12 });
      break;
    case "win":
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        tone({ freq: f, dur: 0.18, type: "square", gain: 0.07 * v, delay: i * 0.11 }),
      );
      break;
    case "lose":
    case "gameover":
      [440, 349, 262].forEach((f, i) =>
        tone({ freq: f, to: f * 0.6, dur: 0.3, type: "sawtooth", gain: 0.08 * v, delay: i * 0.18 }),
      );
      break;
    case "engine":
      tone({ freq: 90, to: 140, dur: 0.18, type: "sawtooth", gain: 0.05 * v });
      break;
    case "splash":
      noise({ dur: 0.3, gain: 0.08 * v, filter: 1800, sweepTo: 300 });
      break;
    case "clack":
      /* hard wooden disc-on-disc knock (carrom pieces) */
      noise({ dur: 0.028, gain: 0.13 * v, filter: 2600, type: "bandpass", sweepTo: 1200 });
      tone({ freq: 1750, to: 900, dur: 0.032, type: "square", gain: 0.07 * v });
      tone({ freq: 520, to: 380, dur: 0.06, type: "triangle", gain: 0.05 * v });
      break;
    case "rail":
      /* duller cushion/rail bounce */
      noise({ dur: 0.05, gain: 0.09 * v, filter: 900, sweepTo: 300 });
      tone({ freq: 300, to: 170, dur: 0.07, type: "triangle", gain: 0.055 * v });
      break;
    case "pocket":
      /* piece rattles then drops into the hole */
      tone({ freq: 900, to: 620, dur: 0.05, type: "square", gain: 0.05 * v });
      noise({ dur: 0.06, gain: 0.06 * v, filter: 1600, sweepTo: 400, delay: 0.04 });
      tone({ freq: 260, to: 110, dur: 0.16, type: "sine", gain: 0.09 * v, delay: 0.06 });
      break;
    case "flick":
      /* finger flick releasing the striker */
      noise({ dur: 0.06, gain: 0.05 * v, filter: 1400, sweepTo: 3200, type: "bandpass" });
      tone({ freq: 620, to: 1100, dur: 0.05, type: "triangle", gain: 0.035 * v });
      break;
    case "kick":
      /* boot meets ball: leather slap + low thump */
      noise({ dur: 0.035, gain: 0.12 * v, filter: 1500, sweepTo: 500, type: "bandpass" });
      tone({ freq: 210, to: 70, dur: 0.13, type: "sine", gain: 0.13 * v });
      break;
    case "ballhit":
      /* ball bouncing off a player or post */
      noise({ dur: 0.03, gain: 0.08 * v, filter: 1200, sweepTo: 420, type: "bandpass" });
      tone({ freq: 330, to: 150, dur: 0.09, type: "sine", gain: 0.09 * v });
      break;
    case "thud":
      /* body-to-body bump between pieces */
      noise({ dur: 0.05, gain: 0.06 * v, filter: 600, sweepTo: 220 });
      tone({ freq: 170, to: 85, dur: 0.1, type: "triangle", gain: 0.08 * v });
      break;
    case "whoosh":
      noise({ dur: 0.22, gain: 0.06 * v, filter: 500, sweepTo: 2400, type: "bandpass" });
      break;
  }
}

/** Convenience alias used by UI components. */
export const playClick = () => playSfx("click");
