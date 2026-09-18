import { useEffect, useState, type ReactNode } from "react";

import { buildPreloadTasks, runPreload } from "@/lib/preload";

const FLAG = "nimiqvalley-preloaded";

/** Downloads every game bundle and image before the app is shown. */
export function AppPreloader({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem(FLAG) === "1") {
      setDone(true);
      return;
    }
    let alive = true;
    const tasks = buildPreloadTasks();
    runPreload(tasks, (loaded, total) => {
      if (alive) setProgress(total === 0 ? 1 : loaded / total);
    })
      .catch(() => undefined)
      .finally(() => {
        if (!alive) return;
        sessionStorage.setItem(FLAG, "1");
        setDone(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (mounted && done) return <>{children}</>;

  const percent = Math.round(progress * 100);

  return (
    <div className="flex h-[100svh] w-full flex-col items-center justify-center bg-background px-8">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-primary">
        NimiqValley
      </p>
      <h1 className="mt-3 font-display text-3xl font-black uppercase text-foreground">
        Loading the valley
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Downloading every game once, so nothing loads while you play.
      </p>
      <div className="mt-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${Math.max(4, percent)}%` }}
        />
      </div>
      <p className="mt-3 font-mono text-xs font-bold text-foreground">{percent}%</p>
      <button
        type="button"
        onClick={() => setDone(true)}
        className="mt-6 text-xs font-semibold text-muted-foreground underline underline-offset-4"
      >
        Continue anyway
      </button>
    </div>
  );
}
