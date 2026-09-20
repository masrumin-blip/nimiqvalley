import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchChat, sendChat } from "@/lib/chat.functions";
import { CHAT_LIMITS, type ChatMessage } from "@/lib/chat/types";
import { getActiveRoom, subscribeActiveRoom } from "@/lib/active-room";

function useActiveRoomCode() {
  return useSyncExternalStore(
    subscribeActiveRoom,
    () => getActiveRoom()?.code ?? null,
    () => null,
  );
}

/**
 * Arena chat as an overlay on top of the running game.
 * It never navigates, so the game keeps running and is never remounted.
 */
export function InGameChat() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastSeenId = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const roomCode = useActiveRoomCode();

  const queryClient = useQueryClient();
  const chatFn = useServerFn(fetchChat);
  const sendFn = useServerFn(sendChat);

  const chat = useQuery({
    queryKey: ["ingame-chat"],
    queryFn: () => chatFn(),
    refetchInterval: open ? 2500 : 8000,
    staleTime: 1000,
  });

  const messages: ChatMessage[] = chat.data?.messages ?? [];
  const latestId = messages[messages.length - 1]?.id ?? null;

  useEffect(() => {
    if (!latestId) return;
    if (open) {
      lastSeenId.current = latestId;
      setUnread(false);
      return;
    }
    if (lastSeenId.current === null) {
      lastSeenId.current = latestId;
      return;
    }
    if (lastSeenId.current !== latestId) setUnread(true);
  }, [latestId, open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, latestId]);

  const send = useMutation({
    mutationFn: (value: string) => sendFn({ data: { text: value } }),
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["ingame-chat"] });
    },
  });

  const share = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked */
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        aria-label="Open Arena chat"
        onClick={() => setOpen(true)}
        className="absolute left-[5.5rem] top-[max(0.5rem,env(safe-area-inset-top))] z-[60] h-9 gap-1 rounded-full border border-border/60 bg-background/80 px-3 text-xs font-semibold text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent"
      >
        <MessageCircle className="size-4" />
        Chat
        {unread ? (
          <span className="ml-0.5 size-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
        ) : null}
      </Button>

      {open ? (
        <div className="absolute inset-0 z-[70] flex items-end justify-center bg-background/50 backdrop-blur-[2px]">
          <div className="flex h-[70%] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border/70 bg-card/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
              <div>
                <p className="text-sm font-bold text-foreground">Arena chat</p>
                <p className="text-[11px] text-muted-foreground">
                  {chat.data?.onlineCount ?? 0} online · the game keeps running
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {roomCode ? (
              <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-background/40 px-4 py-2">
                <span className="text-xs text-muted-foreground">Your room code</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base tracking-[0.3em] text-neon-yellow">
                    {roomCode}
                  </span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void share()}>
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Share"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No messages yet. Say hello!</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="font-semibold text-primary">{m.name}</span>{" "}
                    <span className="break-words text-foreground">{m.text}</span>
                  </div>
                ))
              )}
            </div>

            <form
              className="flex gap-2 border-t border-border/60 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const value = text.trim();
                if (!value || send.isPending) return;
                send.mutate(value);
              }}
            >
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={CHAT_LIMITS.textMax}
                placeholder="Message the Arena…"
                className="text-foreground"
              />
              <Button type="submit" size="icon" disabled={send.isPending || text.trim().length === 0}>
                <Send className="size-4" />
              </Button>
            </form>
            {send.isError ? (
              <p className="px-4 pb-2 text-xs text-destructive">
                {(send.error as Error).message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
