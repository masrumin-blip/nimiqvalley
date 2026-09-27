import { Link, useRouterState } from "@tanstack/react-router";
import { Gamepad2, Home, MessageCircle, Trophy } from "lucide-react";

const TABS = [
  { to: "/village", icon: Home, label: "Village" },
  { to: "/games", icon: Gamepad2, label: "Games" },
  { to: "/leagues", icon: Trophy, label: "Leagues" },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
] as const;

/** Floating bottom navigation. Hidden inside individual game screens. */
export function BottomDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const hidden =
    /^\/games\/.+/.test(pathname) ||
    /^\/chat\/.+/.test(pathname) ||
    pathname.startsWith("/arena");
  if (hidden) return null;

  return (
    <nav
      aria-label="Main sections"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border/70 bg-background/80 p-1.5 shadow-xl backdrop-blur-md">
        {TABS.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex min-h-11 min-w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <tab.icon className="size-5" aria-hidden="true" strokeWidth={2.2} />
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em]">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomDock;
