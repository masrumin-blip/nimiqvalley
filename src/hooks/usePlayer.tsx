import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { createWalletChallenge, getPlayer, setDisplayName, signInWithWallet, signOutPlayer } from "@/lib/auth.functions";
import type { PlayerInfo } from "@/lib/auth.functions";
import { connectWallet, preferredWallet, signLoginMessage, type WalletKind } from "@/lib/wallet";

export function usePlayer() {
  const fetchPlayer = useServerFn(getPlayer);
  const query = useQuery<PlayerInfo>({
    queryKey: ["player"],
    queryFn: () => fetchPlayer(),
    staleTime: 60_000,
  });
  return { player: query.data ?? null, isLoading: query.isLoading };
}

export function usePlayerActions() {
  const queryClient = useQueryClient();
  const createChallenge = useServerFn(createWalletChallenge);
  const signIn = useServerFn(signInWithWallet);
  const signOut = useServerFn(signOutPlayer);
  const rename = useServerFn(setDisplayName);

  const connect = useMutation({
    mutationFn: async (kind: WalletKind = preferredWallet()) => {
      const address = await connectWallet(kind);
      const { challenge, message } = await createChallenge({ data: { address } });
      const signed = await signLoginMessage(kind, message, address);
      return signIn({ data: { address, challenge, ...signed } });
    },
    onSuccess: (player) => {
      queryClient.setQueryData(["player"], player);
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });

  const disconnect = useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      queryClient.setQueryData(["player"], null);
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });

  const changeName = useMutation({
    mutationFn: (displayName: string) => rename({ data: { displayName } }),
    onSuccess: (player) => {
      queryClient.setQueryData(["player"], player);
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });

  return { connect, disconnect, changeName };
}
