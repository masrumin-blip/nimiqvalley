/** Tiny WebAudio SFX kit — no asset downloads, cozy blippy tones. */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, to, dur = 0.14, type = "sine", gain = 0.16, delay = 0 }: ToneOpts) {
  const ac = getCtx();
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur = 0.3, gain = 0.12, filterFreq = 1200) {
  const ac = getCtx();
  if (!ac || muted) return;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ac.destination);
  src.start();
}

export const sfx = {
  pop: () => tone({ freq: 420, to: 880, dur: 0.12, type: "triangle" }),
  tap: () => tone({ freq: 660, to: 990, dur: 0.09, type: "square", gain: 0.09 }),
  chomp: () => {
    tone({ freq: 200, to: 90, dur: 0.1, type: "sawtooth", gain: 0.13 });
    tone({ freq: 180, to: 70, dur: 0.1, type: "sawtooth", gain: 0.12, delay: 0.13 });
  },
  scrub: () => noise(0.22, 0.07, 2600),
  splash: () => {
    noise(0.5, 0.11, 900);
    tone({ freq: 900, to: 300, dur: 0.4, type: "sine", gain: 0.07 });
  },
  coin: () => {
    tone({ freq: 988, dur: 0.08, type: "square", gain: 0.1 });
    tone({ freq: 1319, dur: 0.14, type: "square", gain: 0.1, delay: 0.08 });
  },
  buy: () => {
    tone({ freq: 523, dur: 0.1, type: "triangle" });
    tone({ freq: 659, dur: 0.1, type: "triangle", delay: 0.09 });
    tone({ freq: 784, dur: 0.18, type: "triangle", delay: 0.18 });
  },
  deny: () => tone({ freq: 220, to: 130, dur: 0.22, type: "sawtooth", gain: 0.1 }),
  sleep: () => tone({ freq: 300, to: 150, dur: 0.7, type: "sine", gain: 0.09 }),
  wake: () => tone({ freq: 400, to: 800, dur: 0.35, type: "triangle", gain: 0.1 }),
  giggle: () => {
    tone({ freq: 760, dur: 0.07, type: "triangle", gain: 0.09 });
    tone({ freq: 920, dur: 0.07, type: "triangle", gain: 0.09, delay: 0.07 });
    tone({ freq: 1100, dur: 0.1, type: "triangle", gain: 0.09, delay: 0.14 });
  },
  jump: () => tone({ freq: 320, to: 720, dur: 0.13, type: "square", gain: 0.08 }),
  hurt: () => tone({ freq: 300, to: 80, dur: 0.3, type: "sawtooth", gain: 0.11 }),
  gameOver: () => {
    tone({ freq: 500, dur: 0.16, type: "triangle" });
    tone({ freq: 380, dur: 0.16, type: "triangle", delay: 0.16 });
    tone({ freq: 240, dur: 0.32, type: "triangle", delay: 0.32 });
  },
};
