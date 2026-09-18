import { useCallback, useEffect, useRef, useState } from "react";
import { ShowerHead } from "lucide-react";
import { Pet } from "@/games/pet/components/pet/Pet";
import { sfx } from "@/games/pet/game/audio";
import { useGame } from "@/games/pet/game/store";

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function Bathroom() {
  const { state, mood, scrub, rinse, flash } = useGame();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [scrubbing, setScrubbing] = useState(false);
  const [showering, setShowering] = useState(false);
  const [cleanSparkle, setCleanSparkle] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const lastSfx = useRef(0);
  const idRef = useRef(0);

  const addBubble = useCallback((clientX: number, clientY: number) => {
    const box = areaRef.current?.getBoundingClientRect();
    if (!box) return;
    const id = ++idRef.current;
    const b: Bubble = {
      id,
      x: clientX - box.left,
      y: clientY - box.top,
      size: 14 + Math.random() * 26,
    };
    setBubbles((prev) => [...prev.slice(-40), b]);
    setTimeout(() => setBubbles((prev) => prev.filter((p) => p.id !== id)), 1600);
  }, []);

  const onMove = (clientX: number, clientY: number) => {
    if (!scrubbing) return;
    addBubble(clientX, clientY);
    scrub(1.6);
    const now = Date.now();
    if (now - lastSfx.current > 130) {
      lastSfx.current = now;
      sfx.scrub();
    }
  };

  useEffect(() => {
    const stop = () => setScrubbing(false);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const doRinse = () => {
    setShowering(true);
    setCleanSparkle(false);
    sfx.splash();
    rinse();
    setBubbles([]);
    flash("Squeaky clean! ✨");
    setTimeout(() => {
      setShowering(false);
      setCleanSparkle(true);
      setTimeout(() => setCleanSparkle(false), 1500);
    }, 1600);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={areaRef}
        onPointerDown={(e) => {
          setScrubbing(true);
          addBubble(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => onMove(e.clientX, e.clientY)}
        className="relative flex min-h-0 flex-1 touch-none items-end justify-center overflow-hidden rounded-2xl sm:rounded-3xl"
        style={{ cursor: "grab" }}
      >
        <div className="absolute inset-x-6 bottom-3 h-20 rounded-[3rem] border-4 border-white/70 bg-[var(--room-tub)] shadow-inner sm:bottom-4 sm:h-24" />

        {showering && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
            <ShowerHead className="size-12 text-sky-700/80" />
            {Array.from({ length: 26 }).map((_, i) => (
              <span
                key={i}
                className="absolute top-10 w-[3px] rounded-full bg-sky-300"
                style={{
                  left: `${28 + Math.random() * 44}%`,
                  height: `${16 + Math.random() * 26}px`,
                  animation: `bath-rain ${0.5 + Math.random() * 0.5}s linear ${Math.random() * 0.7}s infinite`,
                }}
              />
            ))}
            <span className="bath-splash-ring absolute top-48 h-8 w-28 rounded-[50%] border-4 border-sky-300/70" />
            <span className="bath-splash-ring absolute top-52 h-6 w-20 rounded-[50%] border-2 border-white/80 [animation-delay:0.18s]" />
          </div>
        )}

        <Pet
          mood={mood}
          hat={state.hat}
          glasses={state.glasses}
          dirt={state.dirt}
          wobble={scrubbing}
          washing={scrubbing || showering}
          cleanSparkle={cleanSparkle}
          onTap={() => sfx.giggle()}
          className="relative z-10 mb-8 h-44 w-44 sm:mb-12 sm:h-64 sm:w-64"
        />

        {bubbles.map((b) => (
          <span
            key={b.id}
            className="pointer-events-none absolute z-20 rounded-full border border-white/70 bg-white/50"
            style={{
              left: b.x - b.size / 2,
              top: b.y - b.size / 2,
              width: b.size,
              height: b.size,
              animation: "bath-bubble 1.6s ease-out forwards",
            }}
          />
        ))}
      </div>

      <div className="mt-2 flex shrink-0 flex-col gap-2 rounded-2xl border border-border/60 bg-card/85 p-2.5 backdrop-blur sm:mt-3 sm:flex-row sm:items-center sm:rounded-3xl sm:p-3">
        <div className="flex-1">
          <p className="text-xs font-semibold sm:text-sm">🧼 Scrub with soap</p>
          <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
            Press and drag across your pet to work up a lather. Dirt left: {Math.round(state.dirt)}%
          </p>
        </div>
        <button
          onClick={doRinse}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:brightness-110 active:scale-95 sm:px-5 sm:py-3"
        >
          <ShowerHead className="size-4" /> Rinse with shower
        </button>
      </div>
    </div>
  );
}
