/** Typed RPC layer for Arena chat. The player identity comes from the session cookie. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  CHAT_LIMITS,
  type ChatSnapshot,
  type DirectMessage,
  type ProfileView,
  type SocialSnapshot,
} from "./chat/types";

const textSchema = z.string().trim().min(1).max(CHAT_LIMITS.textMax);
const socialSchema = z.string().trim().max(CHAT_LIMITS.socialMax);
const walletSchema = z.string().trim().min(4).max(60);

async function requireWallet() {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) throw new Error("Connect your wallet to use Arena chat.");
  return wallet;
}

export const fetchChat = createServerFn({ method: "GET" }).handler(
  async (): Promise<ChatSnapshot> => {
    const cloud = await import("./chat/cloud.server");
    const { currentWallet } = await import("./session.server");
    const wallet = await currentWallet();
    if (wallet) await cloud.touchPresence(wallet);
    const [messages, online] = await Promise.all([cloud.listMessages(), cloud.onlineCount()]);
    return { messages, onlineCount: online };
  },
);

export const sendChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ text: textSchema }).parse(input))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./chat/cloud.server");
    await cloud.touchPresence(wallet);
    return cloud.appendMessage(wallet, data.text);
  });

export const fetchSocial = createServerFn({ method: "GET" }).handler(
  async (): Promise<SocialSnapshot> => {
    const wallet = await requireWallet();
    const cloud = await import("./chat/cloud.server");
    const [profile, friends, requests, threads] = await Promise.all([
      cloud.getProfile(wallet),
      cloud.listFriends(wallet),
      cloud.listRequests(wallet),
      cloud.listThreads(wallet),
    ]);
    return {
      profile,
      friends,
      incoming: requests.filter((r) => r.status === "pending" && r.to === wallet),
      outgoing: requests.filter((r) => r.status === "pending" && r.from === wallet),
      threads,
    };
  },
);

export const saveProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        bio: z.string().trim().max(CHAT_LIMITS.bioMax),
        twitter: socialSchema,
        instagram: socialSchema,
        discord: socialSchema,
        visibility: z.enum(["public", "private"]),
        dmPolicy: z.enum(["everyone", "friends"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./chat/cloud.server");
    return cloud.saveProfile({ wallet, ...data });
  });

export const viewProfile = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ target: walletSchema }).parse(input))
  .handler(async ({ data }): Promise<ProfileView> => {
    const wallet = await requireWallet();
    const target = data.target;
    const cloud = await import("./chat/cloud.server");
    const [profile, friends, requests] = await Promise.all([
      cloud.getProfile(target),
      cloud.listFriends(target),
      cloud.listRequests(target),
    ]);
    const isSelf = target === wallet;
    const isFriend = friends.some((f) => f.wallet === wallet);
    const pending = requests.some(
      (r) => r.status === "pending" && (r.from === wallet || r.to === wallet),
    );
    const hidden = !isSelf && profile.visibility === "private" && !isFriend;
    return {
      wallet: profile.wallet,
      name: profile.name,
      bio: hidden ? "" : profile.bio,
      socials: hidden ? null : profile.socials,
      visibility: profile.visibility,
      hidden,
      canDm: isSelf ? false : profile.dmPolicy === "everyone" || isFriend,
      relation: isSelf ? "self" : isFriend ? "friend" : pending ? "pending" : "none",
    };
  });

export const addFriend = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ target: walletSchema }).parse(input))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./chat/cloud.server");
    const found = (await cloud.findPlayer(data.target)) ?? null;
    if (!found) throw new Error("No player found with that name or wallet.");
    if (found.wallet === wallet) throw new Error("You cannot add yourself.");
    await cloud.requestFriend(wallet, found.wallet);
    return { ok: true, name: found.name };
  });

export const respondFriend = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string(), accept: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const cloud = await import("./chat/cloud.server");
    return cloud.respondFriend(wallet, data.id, data.accept);
  });

export const fetchDm = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ target: walletSchema }).parse(input))
  .handler(async ({ data }): Promise<DirectMessage[]> => {
    const wallet = await requireWallet();
    const cloud = await import("./chat/cloud.server");
    await cloud.touchPresence(wallet);
    return cloud.listDm(wallet, data.target);
  });

export const sendDm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ target: walletSchema, text: textSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    if (data.target === wallet) throw new Error("You cannot message yourself.");
    const cloud = await import("./chat/cloud.server");
    const target = await cloud.getProfile(data.target);
    if (target.dmPolicy === "friends") {
      const friends = await cloud.listFriends(data.target);
      if (!friends.some((f) => f.wallet === wallet)) {
        throw new Error(`${target.name} only accepts messages from friends.`);
      }
    }
    await cloud.touchPresence(wallet);
    return cloud.appendDm(wallet, data.target, data.text);
  });
