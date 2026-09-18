import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { usePlayer, usePlayerActions } from "@/hooks/usePlayer";

/** Shows the children only when a Nimiq wallet is connected. */
export function WalletGate({ name, children }: { name: string; children: ReactNode }) {
  const { player, isLoading } = usePlayer();
  const { connect } = usePlayerActions();

  if (isLoading) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-background">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
          <h2 className="font-display text-2xl font-black uppercase text-foreground">{name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your Nimiq wallet to play and save your score on the leaderboard.
          </p>
          <Button
            className="mt-5 w-full rounded-full font-bold"
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
          >
            <LogIn className="size-4" />
            {connect.isPending ? "Connecting…" : "Connect wallet"}
          </Button>
          {connect.isError && (
            <p className="mt-2 text-xs text-destructive">
              {(connect.error as Error)?.message ?? "Could not connect the wallet."}
            </p>
          )}
          <Link
            to="/games"
            className="mt-4 inline-block text-xs font-semibold text-muted-foreground underline"
          >
            Back to Game Hub
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
