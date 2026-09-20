import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { WalletGate } from "@/components/WalletGate";
import { InGameChat } from "@/components/InGameChat";
import { leaveActiveRoom } from "@/lib/active-room";

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
  const [open, setOpen] = useState(false);

  // Leaving the page also leaves the online room, so the rival is not left hanging.
  const exitToHub = () => {
    void leaveActiveRoom().finally(() => void navigate({ to: "/games" }));
  };

  const exitButton = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label={`Exit ${name} to Game Hub`}
          className="absolute left-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[60] h-9 gap-1 rounded-full border border-border/60 bg-background/80 px-3 text-xs font-semibold text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent"
        >
          <LogOut className="size-4" />
          Exit
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Exit {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to return to the Game Hub? Any ongoing progress may be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction onClick={exitToHub}>Yes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (fit) {
    return (
      <div className={`g-${slug} relative h-[100svh] w-full overflow-hidden overscroll-none bg-background`}>
        <WalletGate name={name}>
          {exitButton}
          <InGameChat />
          <div className="h-full w-full overflow-hidden">{children}</div>
        </WalletGate>
      </div>
    );
  }

  return (
    <div className={`g-${slug} relative min-h-screen bg-background`}>
      <WalletGate name={name}>
        {exitButton}
        <InGameChat />
        {children}
      </WalletGate>
    </div>
  );
}
