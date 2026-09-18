import { LogIn, LogOut, User } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePlayer, usePlayerActions } from "@/hooks/usePlayer";
import { shortWallet } from "@/lib/leaderboard";
import { preferredWallet } from "@/lib/wallet";

/** Wallet connect button / signed-in player chip with name editing and sign out. */
export function PlayerBadge({ className = "" }: { className?: string }) {
  const { player, isLoading } = usePlayer();
  const { connect, disconnect, changeName } = usePlayerActions();
  const [name, setName] = useState("");

  if (isLoading) {
    return (
      <div className={`h-9 w-32 animate-pulse rounded-full bg-muted ${className}`} aria-hidden="true" />
    );
  }

  if (!player) {
    return (
      <div className={className}>
        <Button
          size="sm"
          className="h-9 rounded-full px-4 text-xs font-bold"
          onClick={() => connect.mutate(preferredWallet())}
          disabled={connect.isPending}
        >
          <LogIn className="size-4" />
          {connect.isPending ? "Connecting…" : "Connect wallet"}
        </Button>
        {connect.isError && (
          <p className="mt-1 max-w-[16rem] text-[10px] text-destructive">
            {(connect.error as Error)?.message ?? "Could not connect the wallet."}
          </p>
        )}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className={`h-9 rounded-full px-4 text-xs font-bold ${className}`}
        >
          <User className="size-4" />
          {player.displayName || shortWallet(player.wallet)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Signed in as</p>
          <p className="break-all text-xs">{player.wallet}</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="player-name" className="text-xs font-semibold">
            Display name
          </label>
          <Input
            id="player-name"
            maxLength={16}
            placeholder={player.displayName ?? "Max 16 characters"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            size="sm"
            className="w-full"
            disabled={changeName.isPending || name.trim().length === 0}
            onClick={() => changeName.mutate(name.trim())}
          >
            Save name
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-destructive"
          onClick={() => disconnect.mutate(preferredWallet())}
          disabled={disconnect.isPending}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}
