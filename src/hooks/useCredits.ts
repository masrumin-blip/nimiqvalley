import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { claimDailyReward, fetchCredits, redeemPayment } from "@/lib/credits.functions";
import { PAY_TO_ADDRESS, ROOM_COST_NIM, type ChatPack, type CreditState } from "@/lib/credits";
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

export function useCreditActions() {
  const queryClient = useQueryClient();
  const redeem = useServerFn(redeemPayment);
  const claim = useServerFn(claimDailyReward);

  const settle = (credits: CreditState) => queryClient.setQueryData(["credits"], credits);

  const buyChatPack = useMutation({
    mutationFn: async (pack: ChatPack) => {
      const hash = await payNim(
        PAY_TO_ADDRESS,
        pack.nim,
        `NimiqValley chat ${pack.id}`,
        preferredWallet(),
      );
      return redeem({ data: { txHash: hash, kind: "chat", packId: pack.id } });
    },
    onSuccess: settle,
  });

  const buyRooms = useMutation({
    mutationFn: async (rooms: number) => {
      const hash = await payNim(
        PAY_TO_ADDRESS,
        rooms * ROOM_COST_NIM,
        `NimiqValley rooms x${rooms}`,
        preferredWallet(),
      );
      return redeem({ data: { txHash: hash, kind: "room", rooms } });
    },
    onSuccess: settle,
  });

  const claimDaily = useMutation({
    mutationFn: () => claim(),
    onSuccess: settle,
  });

  return { buyChatPack, buyRooms, claimDaily };
}
