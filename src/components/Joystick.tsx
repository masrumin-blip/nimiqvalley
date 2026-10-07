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
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  // Konversi koordinat layar (viewport) ke koordinat GameStage yang terkena scale CSS
  const toStageCoords = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: clientX, y: clientY };
    const rect = el.getBoundingClientRect();
    const scaleX = rect.width / (el.offsetWidth || 1);
    const scaleY = rect.height / (el.offsetHeight || 1);
    return {
      x: (clientX - rect.left) / (scaleX || 1),
      y: (clientY - rect.top) / (scaleY || 1),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || touchRef.current !== null) return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;

    const coords = toStageCoords(e.clientX, e.clientY);
    const newTouch: TouchState = {
      id: e.pointerId,
      startX: coords.x,
      startY: coords.y,
      currX: coords.x,
      currY: coords.y,
    };

    touchRef.current = newTouch;
    setTouch(newTouch);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cur = touchRef.current;
    if (!cur || cur.id !== e.pointerId || disabled) return;

    const coords = toStageCoords(e.clientX, e.clientY);
    const dx = coords.x - cur.startX;
    const dy = coords.y - cur.startY;
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

    const updated = { ...cur, currX: coords.x, currY: coords.y };
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
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={`fixed inset-0 z-20 touch-none select-none ${disabled ? "pointer-events-none" : ""}`}
    >
      {touch && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50 bg-black/25"
          style={{
            left: `${touch.startX}px`,
            top: `${touch.startY}px`,
            width: `${maxRadius * 2}px`,
            height: `${maxRadius * 2}px`,
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-md"
            style={{ transform: `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))` }}
          />
        </div>
      )}
    </div>
  );
}
