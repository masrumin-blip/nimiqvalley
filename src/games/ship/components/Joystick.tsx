import { useRef, useState } from "react";

type Props = {
  /** stage rotation in degrees (0 or 90) */
  rot: number;
  label: string;
  accent: "cyan" | "magenta";
  onChange: (x: number, y: number) => void;
  /** outer diameter in px */
  size?: number;
};

export function Joystick({ rot, label, accent, onChange, size = 92 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const radius = size * 0.4;

  const unrotate = (dx: number, dy: number) => {
    if (rot === 90) return { x: dy, y: -dx };
    return { x: dx, y: dy };
  };

  const handle = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const raw = unrotate(e.clientX - cx, e.clientY - cy);
    const len = Math.hypot(raw.x, raw.y);
    const f = len > radius ? radius / len : 1;
    const kx = raw.x * f;
    const ky = raw.y * f;
    setKnob({ x: kx, y: ky });
    onChange(kx / radius, ky / radius);
  };

  const end = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId) return;
    id.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  const ring =
    accent === "cyan"
      ? "border-[color:var(--neon-cyan)]/50"
      : "border-[color:var(--neon-magenta)]/50";
  const dot =
    accent === "cyan"
      ? "bg-[color:var(--neon-cyan)]"
      : "bg-[color:var(--neon-magenta)]";

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        id.current = e.pointerId;
        (e.target as Element).setPointerCapture(e.pointerId);
        handle(e);
      }}
      onPointerMove={(e) => {
        if (id.current === e.pointerId) handle(e);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label={label}
      className={`pointer-events-auto relative touch-none rounded-full border-2 ${ring} bg-black/25 backdrop-blur-sm`}
      style={{
        width: size,
        height: size,
        boxShadow:
          "0 0 24px rgba(255,242,56,0.10) inset, 0 0 18px rgba(0,0,0,0.35)",
      }}
    >
      <span
        className={`absolute left-1/2 top-1/2 rounded-full ${dot} opacity-80`}
        style={{
          width: size * 0.34,
          height: size * 0.34,
          transform: `translate(-50%,-50%) translate(${rot === 90 ? -knob.y : knob.x}px, ${rot === 90 ? knob.x : knob.y}px)`,
        }}
      />
    </div>
  );
}
