import { useState } from "react";
import { KeyRound, Loader2, Swords, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCredits, useCreditActions } from "@/hooks/useCredits";
import { KEY_COST_NIM, ROOM_COST_NIM } from "@/lib/credits";
import type { OnlineRoom } from "./useOnlineRoom";

interface Props {
  online: OnlineRoom;
  /** Shown as the room capacity hint. */
  maxPlayers: number;
  /** Hexaman-style lobbies need a manual start by the host. */
  manualStart?: boolean;
  roundMs?: number;
  onBack?: () => void;
}

/** Shared lobby UI: create a room, join by code, or challenge an Arena friend. */
export function OnlinePanel({ online, maxPlayers, manualStart, roundMs, onBack }: Props) {
  const [code, setCode] = useState("");
  const { credits } = useCredits();
  const { buyRooms, buyKeys } = useCreditActions();
  const rooms = credits?.roomCredits ?? 0;
  const keys = credits?.matchKeys ?? 0;
  const room = online.room;
  const invites = online.lobby?.invites ?? [];
  const friends = online.lobby?.friends ?? [];
  const busy = online.openRoom.isPending || online.enterRoom.isPending || online.challenge.isPending;
  const error =
    (online.enterRoom.error as Error | null)?.message ??
    (online.challenge.error as Error | null)?.message ??
    (online.openRoom.error as Error | null)?.message ??
    null;

  if (!online.wallet) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect your wallet to play online.
      </p>
    );
  }

  if (room && room.status !== "finished") {
    const seated = room.players.filter((p) => p.status !== "left");
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Room code</span>
            <span className="font-mono text-lg tracking-[0.3em] text-primary">
              {room.code ?? "—"}
            </span>
          </div>
          <ul className="mt-3 space-y-1">
            {seated.map((p) => (
              <li key={p.wallet} className="flex items-center justify-between">
                <span className="truncate">
                  {p.name}
                  {p.wallet === room.hostWallet ? " (host)" : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.wallet === online.wallet ? "you" : p.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {seated.length}/{room.maxPlayers} players
            {room.status === "waiting" ? " — waiting for others" : " — playing"}
          </p>
        </div>
        <div className="flex gap-2">
          {manualStart && online.isHost && room.status === "waiting" ? (
            <Button
              className="flex-1"
              disabled={seated.length < 2 || online.start.isPending}
              onClick={() => online.start.mutate(roundMs ?? 180_000)}
            >
              Start round
            </Button>
          ) : null}
          <Button variant="outline" className="flex-1" onClick={() => online.leave.mutate()}>
            Leave room
          </Button>
        </div>
      </div>
    );
  }

  if (online.queueing) {
    const waited = Math.floor((online.queue?.waitedMs ?? 0) / 1000);
    return (
      <div className="space-y-3 text-center">
        <Loader2 className="mx-auto size-6 animate-spin text-primary" />
        <p className="text-sm">Searching for an opponent… {waited}s</p>
        <p className="text-xs text-muted-foreground">
          {online.queue?.queueSize ?? 1} player(s) in the queue. The skill range widens every 10
          seconds.
        </p>
        {online.queue?.suggestCpu ? (
          <p className="text-xs text-muted-foreground">
            Nobody nearby yet — try a private room or play the CPU.
          </p>
        ) : null}
        <Button variant="outline" className="w-full" onClick={() => online.cancelQuick.mutate()}>
          Cancel search
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        className="w-full"
        disabled={busy || online.startQuick.isPending}
        onClick={() => online.startQuick.mutate()}
      >
        <Swords className="mr-2 size-4" />
        Quick match (free)
      </Button>

      <Button
        variant="secondary"
        className="w-full"
        disabled={busy}
        onClick={() => online.openRoom.mutate()}
      >
        {online.openRoom.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Users className="mr-2 size-4" />
        )}
        Create room ({maxPlayers} players) — {ROOM_COST_NIM} NIM
      </Button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">
        {rooms} room pass(es) left. Joining a room is always free.
      </p>
      {rooms <= 0 ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={buyRooms.isPending}
          onClick={() => buyRooms.mutate(1)}
        >
          {buyRooms.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Pay {ROOM_COST_NIM} NIM for 1 room pass
        </Button>
      ) : null}
      {buyRooms.isError ? (
        <p className="text-center text-xs text-destructive">
          {(buyRooms.error as Error).message}
        </p>
      ) : null}




      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ROOM CODE"
          maxLength={8}
          className="font-mono tracking-[0.25em]"
        />
        <Button
          variant="secondary"
          disabled={busy || code.trim().length < 4}
          onClick={() => online.enterRoom.mutate(code)}
        >
          Join
        </Button>
      </div>

      {invites.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Challenges</p>
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">
                {inv.players.find((p) => p.wallet === inv.hostWallet)?.name ?? inv.hostWallet}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  onClick={() => online.answerChallenge.mutate({ id: inv.id, accept: true })}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => online.answerChallenge.mutate({ id: inv.id, accept: false })}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {friends.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Arena friends</p>
          {friends.slice(0, 6).map((f) => (
            <div key={f.wallet} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{f.name}</span>
              <Button size="sm" variant="secondary" onClick={() => online.challenge.mutate(f.wallet)}>
                <Swords className="mr-1 size-3.5" /> Challenge
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {onBack ? (
        <Button variant="ghost" className="w-full" onClick={onBack}>
          Back
        </Button>
      ) : null}
    </div>
  );
}
