import { useEffect, useRef, useState } from "react";
import { formatTime, hud } from "@/games/race/lib/hud";
import { touchInput } from "@/games/race/hooks/useKeyboard";
import { Button } from "@/components/ui/button";
import { useGame } from "@/games/race/store/game";
import { X } from "lucide-react";

function useHudTick() {
  const [, force] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 90) {
        last = t;
        force((n) => n + 1);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);
}

function HoldButton({
  label,
  onChange,
  className,
}: {
  label: string;
  onChange: (active: boolean) => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      aria-label={label}
      className={`touch-none select-none rounded-sm border border-border bg-card/90 text-lg font-display text-foreground shadow-pop backdrop-blur active:scale-95 active:bg-primary active:text-primary-foreground ${className ?? ""}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(true);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
      onPointerLeave={() => onChange(false)}
    >
      {label}
    </Button>
  );
}

export function HUD() {
  useHudTick();
  const [showExit, setShowExit] = useState(false);
  const backToMenu = useGame((s) => s.backToMenu);

  const exitRace = () => {
    touchInput.throttle = 0;
    touchInput.brake = 0;
    touchInput.steer = 0;
    touchInput.handbrake = false;
    backToMenu();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      <Button
        type="button"
        variant="destructive"
        size="icon"
        aria-label="Exit race"
        title="Exit race"
        onClick={() => setShowExit(true)}
        className="pointer-events-auto absolute right-3 top-24 z-20 h-10 w-10 rounded-sm shadow-pop"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </Button>

      {/* top stats */}
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="rounded-sm border-l-2 border-primary bg-card/90 px-4 py-2 shadow-pop backdrop-blur">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Lap
          </p>
          <p className="font-display text-2xl leading-none text-foreground">
            {hud.lap}
            <span className="text-base text-muted-foreground">/{hud.laps}</span>
          </p>
        </div>

        <div className="rounded-sm border-t-2 border-primary bg-card/90 px-4 py-2 text-center shadow-pop backdrop-blur">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Time
          </p>
          <p className="font-display text-xl leading-none text-foreground">
            {formatTime(hud.time)}
          </p>
          {hud.bestLap !== null && (
            <p className="mt-1 text-[10px] text-accent-foreground">
              Best {formatTime(hud.bestLap)}
            </p>
          )}
        </div>

        <div className="rounded-sm border-r-2 border-primary bg-card/90 px-4 py-2 text-right shadow-pop backdrop-blur">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Position
          </p>
          <p className="font-display text-2xl leading-none text-foreground">
            {hud.position}
            <span className="text-base text-muted-foreground">
              /{hud.total}
            </span>
          </p>
        </div>
      </div>

      {/* speed */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-sm border-b-2 border-primary bg-card/90 px-5 py-1.5 shadow-pop backdrop-blur">
        <span className="font-display text-2xl text-foreground">
          {Math.round(hud.speed)}
        </span>
        <span className="ml-1 text-xs text-muted-foreground">km/h</span>
      </div>

      {hud.offTrack && !hud.finished && (
        <p className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-destructive px-4 py-1 text-xs font-semibold text-destructive-foreground shadow-pop">
          Off track!
        </p>
      )}

      {hud.countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            key={hud.countdown}
            className="animate-pop font-display text-8xl text-primary drop-shadow-[0_6px_0_rgba(0,0,0,0.25)]"
          >
            {hud.countdown}
          </span>
        </div>
      )}

      {/* touch controls */}
      <div className="pointer-events-auto absolute bottom-16 left-0 right-0 flex items-end justify-between px-4 md:hidden">
        <div className="flex gap-3">
          <HoldButton
            label="◀"
            className="h-16 w-16"
            onChange={(a) => (touchInput.steer = a ? 1 : 0)}
          />
          <HoldButton
            label="▶"
            className="h-16 w-16"
            onChange={(a) => (touchInput.steer = a ? -1 : 0)}
          />
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-3">
            <HoldButton
              label="Brake"
              className="h-14 w-16 text-sm"
              onChange={(a) => (touchInput.brake = a ? 1 : 0)}
            />
            <HoldButton
              label="Drift"
              className="h-14 w-16 text-sm"
              onChange={(a) => (touchInput.handbrake = a)}
            />
          </div>
          <HoldButton
            label="Throttle"
            className="h-20 w-20 text-xl"
            onChange={(a) => (touchInput.throttle = a ? 1 : 0)}
          />
        </div>
      </div>

      <p className="absolute bottom-3 left-3 hidden text-[11px] text-foreground/70 md:block">
        WASD / arrows to steer · Space to drift
      </p>

      {showExit && (
        <div
          className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-background/70 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-race-title"
        >
          <div className="w-full max-w-sm rounded-sm border-2 border-primary bg-card p-6 text-center shadow-pop">
            <h2 id="exit-race-title" className="font-display text-2xl uppercase text-foreground">
              Exit race?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your current race progress will be lost.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => setShowExit(false)}>
                No
              </Button>
              <Button type="button" variant="destructive" onClick={exitRace}>
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
