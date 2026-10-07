import { useEffect, useRef, useState, type MutableRefObject } from "react";

interface Props {
  moveRef: MutableRefObject<{ x: number; y: number }>;
  disabled?: boolean;
}

interface TouchState {
  id: number;
  startX: number;
  startY: number;
  currX: number;
  currY: number;
}

export default function Joystick({ moveRef, disabled = false }: Props) {
  const [touch, setTouch] = useState<TouchState | null>(null);
  const touchRef = useRef<TouchState | null>(null);
  const maxRadius = 48;

  useEffect(() => {
    if (disabled) {
      touchRef.current = null;
      setTouch(null);
      moveRef.current = { x: 0, y: 0 };
    }
  }, [disabled, moveRef]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || touchRef.current !== null) return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;

    const newTouch: TouchState = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      currX: e.clientX,
      currY: e.clientY,
    };
    touchRef.current = newTouch;
    setTouch(newTouch);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cur = touchRef.current;
    if (!cur || cur.id !== e.pointerId || disabled) return;

    const dx = e.clientX - cur.startX;
    const dy = e.clientY - cur.startY;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      const clamped = Math.min(dist, maxRadius);
      moveRef.current = {
        x: (dx / dist) * (clamped / maxRadius),
        y: (dy / dist) * (clamped / maxRadius),
      };
    } else {
      moveRef.current = { x: 0, y: 0 };
    }

    const updated = { ...cur, currX: e.clientX, currY: e.clientY };
    touchRef.current = updated;
    setTouch(updated);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (touchRef.current && touchRef.current.id === e.pointerId) {
      touchRef.current = null;
      setTouch(null);
      moveRef.current = { x: 0, y: 0 };
    }
  };

  let knobX = 0;
  let knobY = 0;
  if (touch) {
    const dx = touch.currX - touch.startX;
    const dy = touch.currY - touch.startY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    if (dist > 0) {
      knobX = (dx / dist) * clamped;
      knobY = (dy / dist) * clamped;
    }
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={`fixed inset-0 z-20 touch-none select-none ${disabled ? "pointer-events-none" : ""}`}
    >
      {touch && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 bg-black/20"
          style={{
            left: `${touch.startX}px`,
            top: `${touch.startY}px`,
            width: `${maxRadius * 2}px`,
            height: `${maxRadius * 2}px`,
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 shadow-md"
            style={{ transform: `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))` }}
          />
        </div>
      )}
    </div>
  );
}
