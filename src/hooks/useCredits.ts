import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  claimDailyReward,
  fetchCredits,
  getPurchaseStatus,
  quotePurchase,
  recheckPurchase,
  recordDailyVisit,
  submitPurchaseTx,
} from "@/lib/credits.functions";
import type { ChatPack, CreditState } from "@/lib/credits";
import { payNim, preferredWallet, sendUsdtPolygon } from "@/lib/wallet";

export function useCredits() {
  const load = useServerFn(fetchCredits);
  const query = useQuery<CreditState | null>({
    queryKey: ["credits"],
    queryFn: () => load(),
    staleTime: 15_000,
  });
  return { credits: query.data ?? null, isLoading: query.isLoading };
}

export type PurchasePhase = "idle" | "approving" | "confirming";
export type PayToken = "nim" | "usdt";
export type PurchaseResult = { id: string; status: string };

type BuyInput = { kind: "chat" | "key" | "room"; token: PayToken; packId?: string; keys?: number; rooms?: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useCreditActions() {
  const queryClient = useQueryClient();
  const quote = useServerFn(quotePurchase);
  const submit = useServerFn(submitPurchaseTx);
  const status = useServerFn(getPurchaseStatus);
  const recheckFn = useServerFn(recheckPurchase);
  const claim = useServerFn(claimDailyReward);
  const visit = useServerFn(recordDailyVisit);
  const [phase, setPhase] = useState<PurchasePhase>("idle");
  const [lastId, setLastId] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["credits"] });

  const buy = async (input: BuyInput): Promise<PurchaseResult> => {
    setPhase("approving");
    try {
      const q = await quote({ data: input });
      setLastId(q.id);
      const txHash =
        q.token === "nim"
          ? await payNim(q.payTo, q.amount, q.memo, preferredWallet())
          : (await sendUsdtPolygon(q.payTo, q.amount)).hash;
      setPhase("confirming");
      let r = await submit({ data: { id: q.id, txHash } });
      for (let i = 0; i < 12 && r.status === "pending"; i++) {
        await sleep(4_000);
        r = await status({ data: { id: q.id } });
      }
      if (r.status === "failed") throw new Error("The payment did not match this purchase.");
      return r;
    } finally {
      setPhase("idle");
      void refresh();
    }
  };

  const onDone = () => void refresh();

  const buyChatPack = useMutation({
    mutationFn: (arg: ChatPack | { pack: ChatPack; token: PayToken }) => {
      const { pack, token } = "pack" in arg ? arg : { pack: arg, token: "nim" as PayToken };
      return buy({ kind: "chat", packId: pack.id, token });
    },
    onSuccess: onDone,
  });

  const buyRooms = useMutation({
    mutationFn: (rooms: number) => buy({ kind: "room", rooms, token: "nim" }),
    onSuccess: onDone,
  });

  const buyKeys = useMutation({
    mutationFn: (arg: number | { keys: number; token: PayToken }) => {
      const { keys, token } = typeof arg === "number" ? { keys: arg, token: "nim" as PayToken } : arg;
      return buy({ kind: "key", keys, token });
    },
    onSuccess: onDone,
  });

  const recheck = useMutation({
    mutationFn: (arg: { id: string; txHash?: string }) => recheckFn({ data: arg }),
    onSuccess: onDone,
  });

  const claimDaily = useMutation({
    mutationFn: () => claim(),
    onSuccess: (credits: CreditState) => queryClient.setQueryData(["credits"], credits),
  });

  const markVisit = useMutation({
    mutationFn: (linkId: string) => visit({ data: { linkId } }),
  });

  return { buyChatPack, buyRooms, buyKeys, recheck, claimDaily, markVisit, phase, lastId };
}
