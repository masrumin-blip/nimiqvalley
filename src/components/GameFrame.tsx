import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

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

export function GameFrame({ slug, name, children }: { slug: string; name: string; children: ReactNode }) {
  const fit = FIT_SLUGS.has(slug);
  const navigate = useNavigate();

  const exitToHub = () => void navigate({ to: "/games" });
  const exitButton = (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      onClick={exitToHub}
      aria-label={`Exit ${name} to Game Hub`}
      className="absolute left-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[60] size-10 rounded-full border border-border/60 bg-background/80 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent"
    >
      <X className="size-5" />
    </Button>
  );

  if (fit) {
    return (
      <div className="relative h-[100svh] w-full overflow-hidden overscroll-none bg-background">
        {exitButton}
        <div className={`g-${slug} h-full w-full overflow-hidden`}>{children}</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      {exitButton}
      <div className={`g-${slug}`}>{children}</div>
    </div>
  );
}
