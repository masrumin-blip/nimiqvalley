import { Coins, Loader2, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCredits, useCreditActions } from "@/hooks/useCredits";
import { RANKED_PAYOUT_NIM, RANKED_STAKE_NIM, TICKET_PACKS } from "@/lib/credits";

/** Main-menu wallet chip: match passes, winnings, and pass purchase. */
export function MatchPassPanel() {
  const { credits } = useCredits();
  const { buyRooms } = useCreditActions();
  if (!credits) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Ticket className="size-4 text-primary" aria-hidden="true" />
          {credits.roomCredits} passes · {credits.nimBalance.toFixed(0)} NIM
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Match passes</DialogTitle>
          <DialogDescription>
            One pass opens a private room or enters one ranked match. Ranked stakes{" "}
            {RANKED_STAKE_NIM} NIM from each player and pays the winner {RANKED_PAYOUT_NIM} NIM.
            Casual matches are always free.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Passes</span>
            <span className="font-mono">{credits.roomCredits}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Winnings</span>
            <span className="font-mono">{credits.nimBalance.toFixed(2)} NIM</span>
          </div>
        </div>

        <div className="space-y-2">
          {TICKET_PACKS.map((pack) => (
            <Button
              key={pack.id}
              className="w-full"
              variant="secondary"
              disabled={buyRooms.isPending}
              onClick={() => buyRooms.mutate(pack.passes)}
            >
              {buyRooms.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Coins className="mr-2 size-4" />
              )}
              {pack.label} — {pack.nim} NIM
            </Button>
          ))}
        </div>
        {buyRooms.isError ? (
          <p className="text-xs text-destructive">{(buyRooms.error as Error).message}</p>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">
          Winnings stay in the valley for now; withdrawals open soon.
        </p>
      </DialogContent>
    </Dialog>
  );
}
