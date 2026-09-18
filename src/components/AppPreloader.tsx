import { useEffect, type ReactNode } from "react";

import { buildPreloadTasks, runPreload } from "@/lib/preload";

const STORAGE_KEY = "nimiqvalley:preloaded";

/** Downloads game assets and code in the background after the app opens. */
export function AppPreloader({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      return;
    }

    const tasks = buildPreloadTasks();

    runPreload(tasks, () => {}).then(() => {
      if (cancelled) return;
      sessionStorage.setItem(STORAGE_KEY, "1");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
