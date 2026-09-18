import { useEffect, useRef, useState, type ReactNode } from "react";

export const STAGE_W = 778;
export const STAGE_H = 972;

/**
 * Fixed 778x972 gameplay stage, uniformly scaled to fit the viewport.
 */
export default function GameStage({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / STAGE_W, height / STAGE_H));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-background">
      <div
        className="relative overflow-hidden rounded-xl border border-border/60 shadow-xl"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          flex: "0 0 auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
