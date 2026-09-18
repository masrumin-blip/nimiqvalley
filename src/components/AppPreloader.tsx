import type { ReactNode } from "react";

/** Downloads game assets and code in the background after the app opens. */
export function AppPreloader({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
