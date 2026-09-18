// Tiny Web Audio blip engine — no asset files needed.
export type SoundName = "bomb" | "pickup" | "kill" | "hurt" | "win" | "place";

let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.08,
  slideTo?: number,
) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slideTo)
    osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + dur);
}

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled) return;
  switch (name) {
    case "place":
      tone(300, 0.08, "square", 0.05);
      break;
    case "bomb":
      tone(120, 0.35, "sawtooth", 0.12, 40);
      tone(70, 0.4, "square", 0.08, 30);
      break;
    case "pickup":
      tone(660, 0.09, "square", 0.07);
      setTimeout(() => tone(990, 0.12, "square", 0.07), 80);
      break;
    case "kill":
      tone(420, 0.18, "triangle", 0.09, 120);
      break;
    case "hurt":
      tone(200, 0.3, "sawtooth", 0.1, 80);
      break;
    case "win":
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => tone(f, 0.16, "square", 0.08), i * 110),
      );
      break;
  }
}

export function primeAudio() {
  getCtx();
}
