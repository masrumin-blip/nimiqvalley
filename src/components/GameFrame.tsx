import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

/** Games that must fit a phone screen exactly, with no page scrolling. */
const FIT_SLUGS = new Set([
  "hexaman",
  "jump",
  "soccer",
  "carrom",
  "checkers",
  "bomber",
  "ship",
  "crossing",
  "pet",
]);

function ConfirmLeave({
  onCancel,
  onHub,
  onHome,
}: {
  onCancel: () => void;
  onHub: () => void;
  onHome: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[260px] rounded-2xl border border-border bg-card p-4 text-center shadow-xl"
      >
        <p className="text-sm font-semibold text-card-foreground">Leave the game?</p>
        <p className="mt-1 text-xs text-muted-foreground">Your current progress will be lost.</p>
        <div className="mt-4 grid gap-2">
          <button
            onClick={onHub}
            className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Game Hub
          </button>
          <button
            onClick={onHome}
            className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Main Menu
          </button>
          <button
            onClick={onCancel}
            className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameFrame({ slug, name, children }: { slug: string; name: string; children: ReactNode }) {
  const fit = FIT_SLUGS.has(slug);
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);

  const leaveToHub = () => void navigate({ to: "/games" });
  const leaveToHome = () => void navigate({ to: "/" });

  if (fit) {
    return (
      <div className="relative h-[100svh] w-full overflow-hidden overscroll-none bg-background">
        <button
          onClick={() => setAsking(true)}
          aria-label={`Back to Game Hub from ${name}`}
          className="absolute left-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[60] rounded-full border border-border/60 bg-background/70 px-3 py-[0.3rem] text-[13px] font-semibold leading-none text-foreground/80 backdrop-blur transition-colors hover:bg-accent"
        >
          ←
        </button>
        <div className={`g-${slug} h-full w-full overflow-hidden`}>{children}</div>
        {asking && (
          <ConfirmLeave
            onCancel={() => setAsking(false)}
            onHub={leaveToHub}
            onHome={leaveToHome}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background/90 px-3 py-2 backdrop-blur">
        <button
          onClick={() => setAsking(true)}
          className="rounded-full border border-border px-[0.9rem] py-[0.3rem] text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          ← Game Hub
        </button>
        <button
          onClick={() => setAsking(true)}
          className="rounded-full border border-border px-[0.9rem] py-[0.3rem] text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Main Menu
        </button>
        <span className="text-xs font-semibold text-muted-foreground">{name}</span>
      </div>
      <div className={`g-${slug}`}>{children}</div>
      {asking && (
        <div className="fixed inset-0 z-[80]">
          <ConfirmLeave
            onCancel={() => setAsking(false)}
            onHub={leaveToHub}
            onHome={leaveToHome}
          />
        </div>
      )}
    </div>
  );
}
