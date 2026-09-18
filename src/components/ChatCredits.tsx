import { Coins } from "lucide-react";
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
import { CHAT_PACKS, FREE_CHATS_PER_DAY, totalChatsLeft } from "@/lib/credits";

/** Shows the remaining AI messages and sells message packs for NIM. */
export function ChatCredits() {
  const [open, setOpen] = useState(false);
  const { credits } = useCredits();
  const { buyChatPack } = useCreditActions();
  const left = totalChatsLeft(credits);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={left === 0 ? "default" : "secondary"}
          className="h-8 shrink-0 rounded-full px-3 text-[11px] font-bold"
        >
          <Coins className="size-3.5" />
          {left} left
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>AI chat messages</DialogTitle>
          <DialogDescription>
            You get {FREE_CHATS_PER_DAY} free messages every day. Buy a pack with NIM for more.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {CHAT_PACKS.map((pack) => (
            <Button
              key={pack.id}
              variant="outline"
              className="h-auto w-full justify-between rounded-xl py-3"
              disabled={buyChatPack.isPending}
              onClick={() => buyChatPack.mutate(pack)}
            >
              <span className="text-left">
                <span className="block text-sm font-bold">{pack.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {pack.chats} messages
                </span>
              </span>
              <span className="font-mono text-sm font-bold">{pack.nim} NIM</span>
            </Button>
          ))}
        </div>

        {buyChatPack.isPending && (
          <p className="text-center text-xs text-muted-foreground">Waiting for your wallet…</p>
        )}
        {buyChatPack.isError && (
          <p className="text-center text-xs text-destructive">
            {(buyChatPack.error as Error)?.message ?? "The payment did not go through."}
          </p>
        )}
        {credits && (
          <p className="text-center text-[11px] text-muted-foreground">
            {credits.freeChatsLeft} free today · {credits.chatCredits} bought
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
