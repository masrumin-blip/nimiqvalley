import { Coins, LogIn, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { usePlayer, usePlayerActions } from "@/hooks/usePlayer";
import { connectPolygon, isInsideNimiqPay } from "@/lib/wallet";

/** Asks for a wallet sign-in before anything else in the app is shown. */
export function LoginGate({ children }: { children: ReactNode }) {
  const { player, isLoading } = usePlayer();
  const { connect } = usePlayerActions();
  const [evm, setEvm] = useState<string | null>(null);
  const [evmError, setEvmError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-background">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (player) return <>{children}</>;

  const insidePay = isInsideNimiqPay();

  return (
    <main className="flex min-h-[100svh] w-full items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
          NimiqValley
        </p>
        <h1 className="mt-3 font-display text-3xl font-black uppercase text-foreground">
          Sign in to play
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your Nimiq address is your player name, your leaderboard entry, and your chat identity.
        </p>

        <div className="mt-6 space-y-2">
          <Button
            className="w-full rounded-full font-bold"
            onClick={() => connect.mutate("pay")}
            disabled={connect.isPending}
          >
            <LogIn className="size-4" />
            {insidePay ? "Continue with Nimiq Pay" : "Nimiq Pay"}
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-full font-bold"
            onClick={() => connect.mutate("hub")}
            disabled={connect.isPending}
          >
            <Wallet className="size-4" />
            Nimiq browser wallet
          </Button>
          <Button
            variant="ghost"
            className="w-full rounded-full text-xs font-bold"
            onClick={async () => {
              setEvmError(null);
              try {
                setEvm(await connectPolygon());
              } catch (error) {
                setEvmError((error as Error)?.message ?? "Could not connect the EVM wallet.");
              }
            }}
          >
            <Coins className="size-4" />
            {evm ? `EVM: ${evm.slice(0, 6)}…${evm.slice(-4)}` : "Connect EVM wallet (USDT)"}
          </Button>
        </div>
        {evmError && <p className="mt-3 text-xs text-destructive">{evmError}</p>}

        {connect.isPending && (
          <p className="mt-3 text-xs text-muted-foreground">Waiting for your wallet…</p>
        )}
        {connect.isError && (
          <p className="mt-3 text-xs text-destructive">
            {(connect.error as Error)?.message ?? "Could not connect the wallet."}
          </p>
        )}
      </div>
    </main>
  );
}
