import { useRef, useState, type MutableRefObject, type PointerEvent } from "react";

interface Props {
  moveRef: MutableRefObject<{ x: number; y: number }>;
  disabled?: boolean;
}

export default function Joystick({ moveRef, disabled = false }: Props) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  const update = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2 - 14;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > max) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }
    setKnob({ x: dx, y: dy });
    moveRef.current = { x: dx / max, y: dy / max };
  };

  const stop = () => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    moveRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => {
        if (disabled) return;
        active.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => active.current && update(e)}
      onPointerUp={stop}
      onPointerCancel={stop}
      className={`relative h-32 w-32 touch-none rounded-full border-2 border-border/60 bg-card/70 backdrop-blur-sm select-none ${disabled ? "opacity-50" : ""}`}
      role="application"
      aria-label="Movement joystick"
      aria-disabled={disabled}
    >
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
