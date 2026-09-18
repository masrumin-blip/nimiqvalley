import { CheckCircle2, ExternalLink, Gift } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreditActions, useCredits } from "@/hooks/useCredits";
import { DAILY_LINKS, DAILY_REWARD } from "@/lib/credits";

/** Daily free reward: visit both X accounts, then claim rooms and chat messages. */
export function DailyRewardDialog({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const { credits } = useCredits();
  const { claimDaily } = useCreditActions();

  const allVisited = DAILY_LINKS.every((link) => visited.includes(link.id));
  const claimed = credits?.claimedToday ?? false;

  function visit(id: string, url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    setVisited((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={`rounded-full font-black uppercase ${className}`} size="sm">
          <Gift className="size-4" />
          Daily reward
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Daily free reward</DialogTitle>
          <DialogDescription>
            Visit both accounts on X, then claim {DAILY_REWARD.rooms} free match passes (rooms or ranked) and{" "}
            {DAILY_REWARD.chats} extra AI chat messages. Once per day.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {DAILY_LINKS.map((link) => (
            <Button
              key={link.id}
              variant={visited.includes(link.id) ? "secondary" : "outline"}
              className="w-full justify-between rounded-xl"
              onClick={() => visit(link.id, link.url)}
            >
              <span>{link.label}</span>
              {visited.includes(link.id) ? (
                <CheckCircle2 className="size-4 text-primary" />
              ) : (
                <ExternalLink className="size-4" />
              )}
            </Button>
          ))}
        </div>

        {claimed ? (
          <p className="text-center text-xs text-muted-foreground">
            Already claimed today. Come back tomorrow.
          </p>
        ) : (
          <Button
            className="w-full rounded-full font-bold"
            disabled={!allVisited || claimDaily.isPending}
            onClick={() => claimDaily.mutate()}
          >
            {claimDaily.isPending ? "Claiming…" : "Claim reward"}
          </Button>
        )}

        {claimDaily.isError && (
          <p className="text-center text-xs text-destructive">
            {(claimDaily.error as Error)?.message ?? "Could not claim the reward."}
          </p>
        )}

        {credits && (
          <p className="text-center text-[11px] text-muted-foreground">
            Balance: {credits.roomCredits} passes · {credits.chatCredits + credits.freeChatsLeft} chat
            messages
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
