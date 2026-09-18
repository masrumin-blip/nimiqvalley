import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  challengeFriend,
  createRoom,
  fetchLobby,
  fetchRoom,
  finishRoom,
  joinQueue,
  joinRoom,
  leaveQueue,
  leaveRoom,
  pollQueue,
  pushTick,
  respondChallenge,
  saveStats,
  skipTurn,
  startRoom,
  submitMove,
} from "@/lib/mp.functions";
import {
  LOBBY_POLL_MS,
  QUEUE_POLL_MS,
  ROOM_POLL_MS,
  TICK_POLL_MS,
  type MoveRecord,
  type PlayerTick,
  type QueueState,
  type RoomState,
} from "@/lib/mp/types";
import { usePlayer } from "@/hooks/usePlayer";

export type GameSlug = "checkers" | "carrom" | "hexaman";

interface Options {
  gameSlug: GameSlug;
  active: boolean;
  maxPlayers: number;
  settings?: Record<string, string | number | boolean>;
  withTicks?: boolean;
}

/**
 * Lobby + live room sync shared by the online modes.
 * Turn games exchange move payloads; hexaman also streams light position ticks.
 */
export function useOnlineRoom({
  gameSlug,
  active,
  maxPlayers,
  settings = {},
  withTicks = false,
}: Options) {
  const queryClient = useQueryClient();
  const { player } = usePlayer();
  const wallet = player?.wallet ?? null;

  const lobbyFn = useServerFn(fetchLobby);
  const roomFn = useServerFn(fetchRoom);
  const quickFn = useServerFn(createRoom);
  const joinFn = useServerFn(joinRoom);
  const challengeFn = useServerFn(challengeFriend);
  const respondFn = useServerFn(respondChallenge);
  const startFn = useServerFn(startRoom);
  const moveFn = useServerFn(submitMove);
  const skipFn = useServerFn(skipTurn);
  const tickFn = useServerFn(pushTick);
  const statsFn = useServerFn(saveStats);
  const finishFn = useServerFn(finishRoom);
  const leaveFn = useServerFn(leaveRoom);
  const joinQueueFn = useServerFn(joinQueue);
  const pollQueueFn = useServerFn(pollQueue);
  const leaveQueueFn = useServerFn(leaveQueue);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [ticks, setTicks] = useState<PlayerTick[]>([]);
  const lastTurn = useRef(-1);

  const lobby = useQuery({
    queryKey: ["mp-lobby", gameSlug],
    queryFn: () => lobbyFn({ data: { gameSlug } }),
    enabled: active && Boolean(wallet),
    refetchInterval: LOBBY_POLL_MS,
  });

  const lobbyRoomId = lobby.data?.room?.id ?? null;
  useEffect(() => {
    if (lobbyRoomId && lobbyRoomId !== roomId) {
      setRoomId(lobbyRoomId);
      setMoves([]);
      lastTurn.current = -1;
    }
    if (!lobbyRoomId && !roomId) setRoom(lobby.data?.room ?? null);
  }, [lobby.data?.room, lobbyRoomId, roomId]);

  useQuery({
    queryKey: ["mp-room", roomId, withTicks],
    enabled: Boolean(roomId) && Boolean(wallet),
    refetchInterval: withTicks ? TICK_POLL_MS : ROOM_POLL_MS,
    queryFn: async () => {
      if (!roomId) return null;
      const res = await roomFn({ data: { id: roomId, since: lastTurn.current, withTicks } });
      if (res.room) setRoom(res.room);
      if (withTicks) setTicks(res.ticks);
      if (res.moves.length > 0) {
        lastTurn.current = res.moves[res.moves.length - 1]!.turnNo;
        setMoves((prev) => [...prev, ...res.moves]);
      }
      return res;
    },
  });

  const refreshLobby = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["mp-lobby", gameSlug] });
  }, [gameSlug, queryClient]);

  const adopt = useCallback(
    (next: RoomState | null) => {
      setRoom(next);
      setRoomId(next?.id ?? null);
      setMoves([]);
      setTicks([]);
      lastTurn.current = -1;
      refreshLobby();
    },
    [refreshLobby],
  );

  const openRoom = useMutation({
    mutationFn: () => quickFn({ data: { gameSlug, maxPlayers, settings } }),
    onSuccess: adopt,
  });
  const enterRoom = useMutation({
    mutationFn: (code: string) =>
      joinFn({ data: { gameSlug, code: code.trim().toUpperCase() } }),
    onSuccess: adopt,
  });
  const challenge = useMutation({
    mutationFn: (target: string) =>
      challengeFn({ data: { gameSlug, target, maxPlayers, settings } }),
    onSuccess: adopt,
  });
  const answerChallenge = useMutation({
    mutationFn: (input: { id: string; accept: boolean }) => respondFn({ data: input }),
    onSuccess: (next) => (next ? adopt(next) : refreshLobby()),
  });
  const start = useMutation({
    mutationFn: (durationMs: number) =>
      roomId ? startFn({ data: { id: roomId, durationMs } }) : Promise.resolve(null),
    onSuccess: (next) => next && setRoom(next),
  });
  const leave = useMutation({
    mutationFn: () => leaveFn({ data: { gameSlug } }),
    onSuccess: () => adopt(null),
  });

  /* ---------------- quick match queue ---------------- */
  const [queueing, setQueueing] = useState(false);
  const [queue, setQueue] = useState<QueueState | null>(null);

  const startQuick = useMutation({
    mutationFn: () => joinQueueFn({ data: { gameSlug, maxPlayers, settings } }),
    onSuccess: () => setQueueing(true),
  });

  const cancelQuick = useMutation({
    mutationFn: () => leaveQueueFn({ data: { gameSlug } }),
    onSuccess: () => {
      setQueueing(false);
      setQueue(null);
    },
  });

  useQuery({
    queryKey: ["mp-queue", gameSlug],
    enabled: queueing && Boolean(wallet),
    refetchInterval: QUEUE_POLL_MS,
    queryFn: async () => {
      const state = await pollQueueFn({ data: { gameSlug } });
      setQueue(state);
      if (state.room) {
        setQueueing(false);
        adopt(state.room);
      } else if (!state.waiting) {
        setQueueing(false);
      }
      return state;
    },
  });

  useEffect(() => {
    if (!active && queueing) {
      setQueueing(false);
      void leaveQueueFn({ data: { gameSlug } }).catch(() => {});
    }
  }, [active, gameSlug, leaveQueueFn, queueing]);

  const sendMove = useCallback(
    (turnNo: number, kind: string, payload: Record<string, number | string | boolean | null>) => {
      if (!roomId) return;
      void moveFn({ data: { id: roomId, turnNo, kind, payload } }).catch(() => {});
    },
    [moveFn, roomId],
  );

  const requestSkip = useCallback(
    (turnNo: number) => {
      if (!roomId) return;
      void skipFn({ data: { id: roomId, turnNo } }).catch(() => {});
    },
    [roomId, skipFn],
  );

  const sendTick = useCallback(
    (tick: { x: number; y: number; dir: number; score: number; alive: boolean }) => {
      if (!roomId) return;
      void tickFn({ data: { id: roomId, ...tick } }).catch(() => {});
    },
    [roomId, tickFn],
  );

  const reportStats = useCallback(
    (score: number, stats: Record<string, number>) => {
      if (!roomId) return;
      void statsFn({ data: { id: roomId, score, stats } }).catch(() => {});
    },
    [roomId, statsFn],
  );

  const finish = useCallback(
    (winner: string | null) => {
      if (!roomId) return;
      void finishFn({ data: { id: roomId, winner } }).catch(() => {});
    },
    [finishFn, roomId],
  );

  const me = room?.players.find((p) => p.wallet === wallet) ?? null;

  return {
    wallet,
    lobby: lobby.data ?? null,
    room,
    moves,
    ticks,
    me,
    isHost: Boolean(room && wallet && room.hostWallet === wallet),
    myTurn: Boolean(room && wallet && room.turnWallet === wallet && room.status === "playing"),
    openRoom,
    enterRoom,
    challenge,
    answerChallenge,
    start,
    leave,
    sendMove,
    requestSkip,
    sendTick,
    reportStats,
    finish,
  };
}

export type OnlineRoom = ReturnType<typeof useOnlineRoom>;
