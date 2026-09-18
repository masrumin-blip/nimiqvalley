/** Typed RPC layer for online Nimiq Soccer. Identity comes from the session cookie. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { LobbyState, MatchMove, MatchState } from "./soccer/types";

const idSchema = z.string().uuid();
const targetSchema = z.number().int().min(1).max(5);

async function requireWallet() {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) throw new Error("Connect your wallet to play online.");
  return wallet;
}

export const fetchLobby = createServerFn({ method: "GET" }).handler(
  async (): Promise<LobbyState> => {
    const wallet = await requireWallet();
    const cloud = await import("./soccer/cloud.server");
    const chat = await import("./chat/cloud.server");
    const [match, invites, friends] = await Promise.all([
      cloud.activeMatch(wallet),
      cloud.invitesFor(wallet),
      chat.listFriends(wallet),
    ]);
    return {
      match,
      invites,
      friends: friends.map((f) => ({ wallet: f.wallet, name: f.name })),
    };
  },
);

export const quickMatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ targetGoals: targetSchema }).parse(input))
  .handler(async ({ data }): Promise<MatchState> => {
    const wallet = await requireWallet();
    const cloud = await import("./soccer/cloud.server");
    return cloud.quickMatch(wallet, data.targetGoals);
  });

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ targetGoals: targetSchema }).parse(input))
  .handler(async ({ data }): Promise<MatchState> => {
    const wallet = await requireWallet();
    const cloud = await import("./soccer/cloud.server");
    return cloud.createMatch(wallet, "room", data.targetGoals, null);
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().min(4).max(8) }).parse(input),
  )
  .handler(async ({ data }): Promise<MatchState> => {
    const wallet = await requireWallet();
    const cloud = await import("./soccer/cloud.server");
    return cloud.joinRoom(wallet, data.code);
  });

export const challengeFriend = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ target: z.string().trim().min(4).max(60), targetGoals: targetSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<MatchState> => {
    const wallet = await requireWallet();
    if (data.target === wallet) throw new Error("You cannot challenge yourself.");
    const cloud = await import("./soccer/cloud.server");
    return cloud.createMatch(wallet, "friend", data.targetGoals, data.target);
  });

export const respondChallenge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: idSchema, accept: z.boolean() }).parse(input),
  )
  .handler(async ({ data }): Promise<MatchState | null> => {
    const wallet = await requireWallet();
    const cloud = await import("./soccer/cloud.server");
    return cloud.respondInvite(wallet, data.id, data.accept);
  });

export const fetchMatch = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ id: idSchema, since: z.number().int().min(-1) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ match: MatchState | null; moves: MatchMove[] }> => {
    await requireWallet();
    const cloud = await import("./soccer/cloud.server");
    const [match, moves] = await Promise.all([
      cloud.getMatch(data.id),
      cloud.listMoves(data.id, data.since),
    ]);
    return { match, moves };
  });

export const submitMove = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: idSchema,
        turnNo: z.number().int().min(0),
        piece: z.number().int().min(0).max(63),
        vx: z.number().finite(),
        vy: z.number().finite(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./soccer/cloud.server");
    return cloud.submitMove(wallet, data.id, data.turnNo, data.piece, data.vx, data.vy);
  });

export const skipTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: idSchema, turnNo: z.number().int().min(0) }).parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./soccer/cloud.server");
    return cloud.skipTurn(wallet, data.id, data.turnNo);
  });

export const finishMatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: idSchema, winner: z.string().trim().min(4).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./soccer/cloud.server");
    return cloud.finishMatch(wallet, data.id, data.winner);
  });

export const leaveMatch = createServerFn({ method: "POST" }).handler(async () => {
  const wallet = await requireWallet();
  const cloud = await import("./soccer/cloud.server");
  await cloud.abandonAll(wallet);
  return { ok: true };
});
