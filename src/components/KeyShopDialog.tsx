import { KeyRound, Loader2 } from "lucide-react";
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
import { KEY_COST_NIM } from "@/lib/credits";

type KeyPack = { id: string; keys: number; label: string; note: string };

const KEY_PACKS: KeyPack[] = [
  { id: "single", keys: 1, label: "Single key", note: "One online match" },
  { id: "squad", keys: 3, label: "Squad pack", note: "Three online matches" },
  { id: "season", keys: 10, label: "Season pack", note: "Ten online matches" },
];

/** Shop for match keys — the ticket that opens online matchmaking. */
export function KeyShopDialog({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { credits } = useCredits();
  const { buyKeys, phase } = useCreditActions();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={`rounded-full text-xs font-black uppercase tracking-wide ${className}`}
          size="sm"
        >
          <KeyRound className="size-4" aria-hidden="true" />
          Key shop
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Match key shop</DialogTitle>
          <DialogDescription>
            {KEY_COST_NIM} NIM per key, paid straight from your Nimiq wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">What is a match key for?</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>1 key starts a quick match against a real player.</li>
            <li>1 key creates a private room you can share by code.</li>
            <li>Joining a friend&apos;s room by code is always free.</li>
            <li>Cancel the search before a match is found and the key comes back.</li>
            <li>You also get 2 free keys a day from the daily reward.</li>
          </ul>
        </div>

        <div className="space-y-2">
          {KEY_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              disabled={buyKeys.isPending}
              onClick={() => buyKeys.mutate(pack.keys)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-bold text-card-foreground">
                  {pack.keys} {pack.keys === 1 ? "key" : "keys"} · {pack.label}
                </span>
                <span className="block text-[11px] text-muted-foreground">{pack.note}</span>
              </span>
              <span className="text-sm font-black text-primary">
                {pack.keys * KEY_COST_NIM} NIM
              </span>
            </button>
          ))}
        </div>

        {buyKeys.isPending && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            {phase === "confirming"
              ? "Confirming payment on the Nimiq network…"
              : "Approve the payment in your wallet…"}
          </p>
        )}
        {buyKeys.isError && (
          <p className="text-center text-xs text-destructive">
            {(buyKeys.error as Error)?.message ?? "The purchase did not go through."}
          </p>
        )}
        {buyKeys.isSuccess && !buyKeys.isPending && (
          <p className="text-center text-xs text-primary">Keys added to your balance.</p>
        )}

        {credits && (
          <p className="text-center text-[11px] text-muted-foreground">
            You have {credits.matchKeys} match {credits.matchKeys === 1 ? "key" : "keys"}.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
