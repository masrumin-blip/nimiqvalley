import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  challengeFriend,
  createRoom,
  fetchLobby,
  fetchMatch,
  finishMatch,
  joinRoom,
  leaveMatch,
  quickMatch,
  respondChallenge,
  skipTurn,
  submitMove,
} from "@/lib/soccer.functions";
import { LOBBY_POLL_MS, MATCH_POLL_MS, type MatchMove, type MatchState } from "@/lib/soccer/types";
import { usePlayer } from "@/hooks/usePlayer";

/**
 * Lobby + live match sync for online Nimiq Soccer.
 * Only shot vectors travel over the wire; both clients replay the same physics.
 */
export function useOnlineSoccer(active: boolean) {
  const queryClient = useQueryClient();
  const { player } = usePlayer();
  const wallet = player?.wallet ?? null;

  const lobbyFn = useServerFn(fetchLobby);
  const matchFn = useServerFn(fetchMatch);
  const quickFn = useServerFn(quickMatch);
  const roomFn = useServerFn(createRoom);
  const joinFn = useServerFn(joinRoom);
  const challengeFn = useServerFn(challengeFriend);
  const respondFn = useServerFn(respondChallenge);
  const moveFn = useServerFn(submitMove);
  const skipFn = useServerFn(skipTurn);
  const leaveFn = useServerFn(leaveMatch);
  const finishFn = useServerFn(finishMatch);


  const [matchId, setMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [moves, setMoves] = useState<MatchMove[]>([]);
  const lastTurn = useRef(-1);

  const lobby = useQuery({
    queryKey: ["soccer-lobby"],
    queryFn: () => lobbyFn(),
    enabled: active && Boolean(wallet),
    refetchInterval: LOBBY_POLL_MS,
  });

  const lobbyMatchId = lobby.data?.match?.id ?? null;
  useEffect(() => {
    if (lobbyMatchId && lobbyMatchId !== matchId) {
      setMatchId(lobbyMatchId);
      setMoves([]);
      lastTurn.current = -1;
    }
    if (!lobbyMatchId && !matchId) setMatch(lobby.data?.match ?? null);
  }, [lobby.data?.match, lobbyMatchId, matchId]);

  useQuery({
    queryKey: ["soccer-match", matchId],
    enabled: Boolean(matchId) && Boolean(wallet),
    refetchInterval: MATCH_POLL_MS,
    queryFn: async () => {
      if (!matchId) return null;
      const res = await matchFn({ data: { id: matchId, since: lastTurn.current } });
      if (res.match) setMatch(res.match);
      if (res.moves.length > 0) {
        lastTurn.current = res.moves[res.moves.length - 1]!.turnNo;
        setMoves((prev) => [...prev, ...res.moves]);
      }
      return res;
    },
  });

  const refreshLobby = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["soccer-lobby"] });
  }, [queryClient]);

  const adopt = (next: MatchState | null) => {
    setMatch(next);
    setMatchId(next?.id ?? null);
    setMoves([]);
    lastTurn.current = -1;
    refreshLobby();
  };

  const findMatch = useMutation({
    mutationFn: (targetGoals: number) => quickFn({ data: { targetGoals } }),
    onSuccess: adopt,
  });
  const openRoom = useMutation({
    mutationFn: (targetGoals: number) => roomFn({ data: { targetGoals } }),
    onSuccess: adopt,
  });
  const enterRoom = useMutation({
    mutationFn: (code: string) => joinFn({ data: { code: code.trim().toUpperCase() } }),
    onSuccess: adopt,
  });
  const challenge = useMutation({
    mutationFn: (input: { target: string; targetGoals: number }) => challengeFn({ data: input }),
    onSuccess: adopt,
  });
  const answerChallenge = useMutation({
    mutationFn: (input: { id: string; accept: boolean }) => respondFn({ data: input }),
    onSuccess: (next) => (next ? adopt(next) : refreshLobby()),
  });
  const leave = useMutation({
    mutationFn: () => leaveFn(),
    onSuccess: () => {
      adopt(null);
      // An unused room gives its key or room pass back.
      void queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });

  const sendShot = useCallback(
    (turnNo: number, piece: number, vx: number, vy: number) => {
      if (!matchId) return;
      void moveFn({ data: { id: matchId, turnNo, piece, vx, vy } }).catch(() => {});
    },
    [matchId, moveFn],
  );

  const requestSkip = useCallback(
    (turnNo: number) => {
      if (!matchId) return;
      void skipFn({ data: { id: matchId, turnNo } }).catch(() => {});
    },
    [matchId, skipFn],
  );

  const finish = useCallback(
    (winner: string) => {
      if (!matchId) return;
      void finishFn({ data: { id: matchId, winner } }).catch(() => {});
    },
    [finishFn, matchId],
  );

  return {
    wallet,
    lobby: lobby.data ?? null,
    match,
    moves,
    isHost: Boolean(match && wallet && match.hostWallet === wallet),
    findMatch,
    openRoom,
    enterRoom,
    challenge,
    answerChallenge,
    leave,
    sendShot,
    requestSkip,
    finish,
  };
}

export type OnlineSoccer = ReturnType<typeof useOnlineSoccer>;
