/** Typed RPC layer for generic online rooms. Identity comes from the session cookie. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { LobbyState, MoveRecord, PlayerTick, QueueState, RoomState } from "./mp/types";

const idSchema = z.string().uuid();
const slugSchema = z.enum(["checkers", "carrom", "hexaman", "bomber"]);
const settingsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({});
const payloadSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .default({});

async function requireWallet() {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) throw new Error("Connect your wallet to play online.");
  return wallet;
}

export const fetchLobby = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ gameSlug: slugSchema }).parse(input))
  .handler(async ({ data }): Promise<LobbyState> => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    const chat = await import("./chat/cloud.server");
    const [room, invites, friends] = await Promise.all([
      cloud.activeRoom(wallet, data.gameSlug),
      cloud.invitesFor(wallet, data.gameSlug),
      chat.listFriends(wallet),
    ]);
    return { room, invites, friends: friends.map((f) => ({ wallet: f.wallet, name: f.name })) };
  });

export const quickMatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gameSlug: slugSchema,
        maxPlayers: z.number().int().min(2).max(4),
        settings: settingsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<RoomState> => {
    const wallet = await requireWallet();
    const { spendKey } = await import("./credits.server");
    await spendKey(wallet);
    const cloud = await import("./mp/cloud.server");
    return cloud.quickMatch(wallet, data.gameSlug, data.maxPlayers, data.settings);
  });

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gameSlug: slugSchema,
        maxPlayers: z.number().int().min(2).max(4),
        settings: settingsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<RoomState> => {
    const wallet = await requireWallet();
    const { spendRoomEntry, refundRoomEntry } = await import("./credits.server");
    const entry = await spendRoomEntry(wallet);
    const cloud = await import("./mp/cloud.server");
    try {
      return await cloud.createRoom(
        wallet,
        data.gameSlug,
        "room",
        data.maxPlayers,
        data.settings,
        null,
        entry,
      );
    } catch (error) {
      await refundRoomEntry(wallet, entry);
      throw error as Error;
    }
  });

export const joinQueue = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gameSlug: slugSchema,
        maxPlayers: z.number().int().min(2).max(4),
        settings: settingsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { spendKey } = await import("./credits.server");
    await spendKey(wallet);
    const cloud = await import("./mp/cloud.server");
    return cloud.joinQueue(wallet, data.gameSlug, data.maxPlayers, data.settings);
  });

export const pollQueue = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ gameSlug: slugSchema }).parse(input))
  .handler(async ({ data }): Promise<QueueState> => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    return cloud.pollQueue(wallet, data.gameSlug);
  });

export const leaveQueue = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ gameSlug: slugSchema }).parse(input))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    const result = await cloud.leaveQueue(wallet, data.gameSlug);
    // The search never found an opponent, so the key goes back.
    if (result.wasWaiting) {
      const { refundKey } = await import("./credits.server");
      await refundKey(wallet);
    }
    return { ok: true };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ gameSlug: slugSchema, code: z.string().trim().min(4).max(8) }).parse(input),
  )
  .handler(async ({ data }): Promise<RoomState> => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    return cloud.joinByCode(wallet, data.gameSlug, data.code);
  });

export const challengeFriend = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gameSlug: slugSchema,
        target: z.string().trim().min(4).max(60),
        maxPlayers: z.number().int().min(2).max(4),
        settings: settingsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<RoomState> => {
    const wallet = await requireWallet();
    if (data.target === wallet) throw new Error("You cannot challenge yourself.");
    const { spendKey, spendRoom } = await import("./credits.server");
    await spendKey(wallet);
    await spendRoom(wallet);
    const cloud = await import("./mp/cloud.server");
    return cloud.createRoom(
      wallet,
      data.gameSlug,
      "friend",
      data.maxPlayers,
      data.settings,
      data.target,
    );
  });

export const respondChallenge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: idSchema, accept: z.boolean() }).parse(input))
  .handler(async ({ data }): Promise<RoomState | null> => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    return cloud.respondInvite(wallet, data.id, data.accept);
  });

export const startRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: idSchema, durationMs: z.number().int().min(10_000).max(600_000) }).parse(input),
  )
  .handler(async ({ data }): Promise<RoomState> => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    return cloud.startRoom(wallet, data.id, data.durationMs);
  });

export const fetchRoom = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ id: idSchema, since: z.number().int().min(-1), withTicks: z.boolean().default(false) })
      .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<{ room: RoomState | null; moves: MoveRecord[]; ticks: PlayerTick[] }> => {
      await requireWallet();
      const cloud = await import("./mp/cloud.server");
      const [room, moves, ticks] = await Promise.all([
        cloud.getRoom(data.id),
        cloud.listMoves(data.id, data.since),
        data.withTicks ? cloud.listTicks(data.id) : Promise.resolve([]),
      ]);
      return { room, moves, ticks };
    },
  );

export const submitMove = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: idSchema,
        turnNo: z.number().int().min(0),
        kind: z.string().trim().min(1).max(16),
        payload: payloadSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    return cloud.submitMove(wallet, data.id, data.turnNo, data.kind, data.payload);
  });

export const skipTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: idSchema, turnNo: z.number().int().min(0) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireWallet();
    const cloud = await import("./mp/cloud.server");
    return cloud.skipTurn(data.id, data.turnNo);
  });

export const pushTick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: idSchema,
        x: z.number().finite(),
        y: z.number().finite(),
        dir: z.number().int().min(0).max(3),
        score: z.number().int().min(0).max(1_000_000),
        alive: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    const { id, ...tick } = data;
    return cloud.pushTick(wallet, id, tick);
  });

/** Turn-free event channel used by real-time games such as bomber. */
export const pushEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: idSchema,
        kind: z.string().trim().min(1).max(16),
        payload: payloadSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    return cloud.pushEvent(wallet, data.id, data.kind, data.payload);
  });

export const saveStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: idSchema,
        score: z.number().finite(),
        stats: z.record(z.string(), z.number()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    return cloud.saveStats(wallet, data.id, data.score, data.stats);
  });

export const finishRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: idSchema, winner: z.string().trim().min(4).max(60).nullable() }).parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    return cloud.finishRoom(wallet, data.id, data.winner);
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ gameSlug: slugSchema }).parse(input))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./mp/cloud.server");
    await cloud.abandonAll(wallet, data.gameSlug);
    return { ok: true };
  });
