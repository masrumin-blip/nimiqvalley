import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  claimDailyReward,
  fetchCredits,
  recordDailyVisit,
  redeemPayment,
} from "@/lib/credits.functions";
import {
  KEY_COST_NIM,
  PAY_TO_ADDRESS,
  ROOM_COST_NIM,
  type ChatPack,
  type CreditState,
} from "@/lib/credits";
import { payNim, preferredWallet } from "@/lib/wallet";

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

export function useCreditActions() {
  const queryClient = useQueryClient();
  const redeem = useServerFn(redeemPayment);
  const claim = useServerFn(claimDailyReward);
  const visit = useServerFn(recordDailyVisit);
  const [phase, setPhase] = useState<PurchasePhase>("idle");

  const settle = (credits: CreditState) => {
    setPhase("idle");
    queryClient.setQueryData(["credits"], credits);
  };

  const pay = async (nim: number, note: string) => {
    setPhase("approving");
    try {
      const receipt = await payNim(PAY_TO_ADDRESS, nim, note, preferredWallet());
      setPhase("confirming");
      return receipt;
    } catch (error) {
      setPhase("idle");
      throw error as Error;
    }
  };

  const failed = () => setPhase("idle");

  const buyChatPack = useMutation({
    mutationFn: async (pack: ChatPack) => {
      const txHash = await pay(pack.nim, `NimiqValley chat ${pack.id}`);
      return redeem({ data: { txHash, kind: "chat", packId: pack.id } });
    },
    onSuccess: settle,
    onError: failed,
  });

  const buyRooms = useMutation({
    mutationFn: async (rooms: number) => {
      const txHash = await pay(rooms * ROOM_COST_NIM, `NimiqValley rooms x${rooms}`);
      return redeem({ data: { txHash, kind: "room", rooms } });
    },
    onSuccess: settle,
    onError: failed,
  });

  const buyKeys = useMutation({
    mutationFn: async (keys: number) => {
      const txHash = await pay(keys * KEY_COST_NIM, `NimiqValley match keys x${keys}`);
      return redeem({ data: { txHash, kind: "key", keys } });
    },
    onSuccess: settle,
    onError: failed,
  });

  const claimDaily = useMutation({
    mutationFn: () => claim(),
    onSuccess: settle,
  });

  // The server records the visit; the dialog no longer decides on its own.
  const markVisit = useMutation({
    mutationFn: (linkId: string) => visit({ data: { linkId } }),
  });

  return { buyChatPack, buyRooms, buyKeys, claimDaily, markVisit, phase };
}
