import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { COINS_PER_NIM, MIN_REDEEM_COINS, coinsToNim } from "@/lib/coins";
import { fetchCoins, redeemCoins } from "@/lib/coins.functions";

/** Coin balance earned in the games, plus NIM redemption at 100 coins = 1 NIM. */
export function CoinPurse({ enabled = true }: { enabled?: boolean }) {
  const load = useServerFn(fetchCoins);
  const send = useServerFn(redeemCoins);
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);

  const purse = useQuery({ queryKey: ["coin-purse"], queryFn: () => load(), enabled, staleTime: 10_000 });
  const redeem = useMutation({
    mutationFn: (coins: number) => send({ data: { coins } }),
    onSuccess: (r) => {
      setNote(`Redemption filed: ${r.nim} NIM on the way to your wallet.`);
      void qc.invalidateQueries({ queryKey: ["coin-purse"] });
    },
  });

  const coins = purse.data?.coins ?? 0;
  // Only whole NIM can be redeemed, so round the balance down to a full step.
  const redeemable = Math.floor(coins / COINS_PER_NIM) * COINS_PER_NIM;
  const pending = purse.data?.pending ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Your coins</p>
        <p className="font-mono text-2xl font-black text-[#ffc107]">
          {purse.isLoading ? "…" : coins.toLocaleString()}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Worth {coinsToNim(coins)} NIM · {COINS_PER_NIM} coins = 1 NIM
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Collect the yellow coins in Mininja, Spaceship and CosNimiq Shooter. Coins never change your score, they
        only fill this purse.
      </p>

      <Button
        className="w-full"
        disabled={redeem.isPending || redeemable < MIN_REDEEM_COINS}
        onClick={() => {
          setNote(null);
          redeem.mutate(redeemable);
        }}
      >
        {redeem.isPending ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
        {redeemable >= MIN_REDEEM_COINS
          ? `Redeem ${redeemable} coins for ${coinsToNim(redeemable)} NIM`
          : `Collect ${MIN_REDEEM_COINS} coins to redeem`}
      </Button>

      {redeem.isError && (
        <p className="text-center text-xs text-destructive">
          {(redeem.error as Error)?.message ?? "The redemption did not go through."}
        </p>
      )}
      {note && <p className="text-center text-xs text-primary">{note}</p>}

      {pending.length > 0 && (
        <div className="space-y-1 rounded-xl border border-dashed border-border p-3">
          <p className="text-[11px] font-semibold text-foreground">Recent redemptions</p>
          {pending.map((p) => (
            <p key={p.id} className="flex justify-between text-[11px] text-muted-foreground">
              <span>
                {p.coins} coins → {p.nim} NIM
              </span>
              <span className={p.status === "paid" ? "text-primary" : ""}>{p.status}</span>
            </p>
          ))}
          <p className="text-[10px] text-muted-foreground">
            Payouts are sent to the wallet you are signed in with, usually within a day.
          </p>
        </div>
      )}
    </div>
  );
}
