/** Credit balances, NIM payment redemption and daily rewards. Server only. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  CHAT_PACKS,
  DAILY_LINKS,
  DAILY_REWARD,
  FREE_CHATS_PER_DAY,
  FREE_KEYS_PER_DAY,
  KEY_COST_NIM,
  PAY_TO_ADDRESS,
  ROOM_COST_NIM,
  type CreditState,
} from "./credits";



type CreditRow = {
  wallet: string;
  chat_credits: number;
  room_credits: number;
  match_keys: number;
  free_chats_date: string | null;
  free_chats_used: number;
  free_keys_date: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}


/**
 * Every player starts each day with at least FREE_KEYS_PER_DAY match keys.
 * Keys bought or left over are kept, but the free grant does not stack.
 */
async function topUpDailyKeys(row: CreditRow): Promise<CreditRow> {
  if (row.free_keys_date === today()) return row;
  const keys = Math.max(row.match_keys ?? 0, FREE_KEYS_PER_DAY);
  await supabaseAdmin
    .from("wallet_credits")
    .update({ match_keys: keys, free_keys_date: today(), updated_at: new Date().toISOString() })
    .eq("wallet", row.wallet);
  return { ...row, match_keys: keys, free_keys_date: today() };
}

async function loadRow(wallet: string): Promise<CreditRow> {
  const { data } = await supabaseAdmin
    .from("wallet_credits")
    .select(
      "wallet, chat_credits, room_credits, match_keys, free_chats_date, free_chats_used, free_keys_date",
    )
    .eq("wallet", wallet)
    .maybeSingle();
  if (data) return topUpDailyKeys(data as CreditRow);
  const fresh: CreditRow = {
    wallet,
    chat_credits: 0,
    room_credits: 0,
    match_keys: FREE_KEYS_PER_DAY,
    free_chats_date: today(),
    free_chats_used: 0,
    free_keys_date: today(),
  };
  await supabaseAdmin.from("wallet_credits").upsert({ ...fresh, updated_at: new Date().toISOString() });
  return fresh;
}


function freeLeft(row: CreditRow) {
  if (row.free_chats_date !== today()) return FREE_CHATS_PER_DAY;
  return Math.max(0, FREE_CHATS_PER_DAY - row.free_chats_used);
}

async function claimedToday(wallet: string) {
  const { data } = await supabaseAdmin
    .from("daily_claims")
    .select("id")
    .eq("wallet", wallet)
    .eq("claim_date", today())
    .maybeSingle();
  return Boolean(data);
}

export async function getCredits(wallet: string): Promise<CreditState> {
  const row = await loadRow(wallet);
  return {
    wallet,
    chatCredits: row.chat_credits,
    roomCredits: row.room_credits,
    matchKeys: row.match_keys ?? 0,
    freeChatsLeft: freeLeft(row),
    claimedToday: await claimedToday(wallet),
  };
}

async function save(wallet: string, patch: Partial<CreditRow>) {
  await supabaseAdmin
    .from("wallet_credits")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("wallet", wallet);
}

/** Spends one AI chat message. Throws when the player has nothing left. */
export async function spendChat(wallet: string): Promise<CreditState> {
  const row = await loadRow(wallet);
  const isToday = row.free_chats_date === today();
  const used = isToday ? row.free_chats_used : 0;
  if (used < FREE_CHATS_PER_DAY) {
    await save(wallet, { free_chats_date: today(), free_chats_used: used + 1 });
  } else if (row.chat_credits > 0) {
    await save(wallet, { chat_credits: row.chat_credits - 1 });
  } else {
    throw new Error("No chat messages left. Buy a pack or claim the daily reward.");
  }
  return getCredits(wallet);
}

/** Spends one room credit. Throws when the player has none. */
export async function spendRoom(wallet: string): Promise<void> {
  const row = await loadRow(wallet);
  if (row.room_credits <= 0) {
    throw new Error(
      `Creating a room costs ${ROOM_COST_NIM} NIM. Buy room credits or claim the daily reward.`,
    );
  }
  await save(wallet, { room_credits: row.room_credits - 1 });
}

/** Spends one match key. Every online match entry needs one. */
export async function spendKey(wallet: string): Promise<void> {
  const row = await loadRow(wallet);
  if ((row.match_keys ?? 0) <= 0) {
    throw new Error(
      `You used all of today's match keys. You get ${FREE_KEYS_PER_DAY} free keys again tomorrow, or buy one now for ${KEY_COST_NIM} NIM.`,
    );
  }
  await save(wallet, { match_keys: (row.match_keys ?? 0) - 1 });
}

/** Gives a match key back, e.g. when a matchmaking search is cancelled. */
export async function refundKey(wallet: string): Promise<void> {
  const row = await loadRow(wallet);
  await save(wallet, { match_keys: (row.match_keys ?? 0) + 1 });
}

/** Gives a room pass back when the room was never actually played. */
export async function refundRoom(wallet: string): Promise<void> {
  const row = await loadRow(wallet);
  await save(wallet, { room_credits: row.room_credits + 1 });
}

export type RoomEntry = "key" | "room";

/** Opening a room costs one match key OR one room pass — whichever the player has. */
export async function spendRoomEntry(wallet: string): Promise<RoomEntry> {
  const row = await loadRow(wallet);
  if ((row.match_keys ?? 0) > 0) {
    await save(wallet, { match_keys: (row.match_keys ?? 0) - 1 });
    return "key";
  }
  if (row.room_credits > 0) {
    await save(wallet, { room_credits: row.room_credits - 1 });
    return "room";
  }
  throw new Error(
    `Opening a room needs a match key or a room pass. Claim the daily reward, or buy one for ${KEY_COST_NIM} NIM (key) or ${ROOM_COST_NIM} NIM (room pass).`,
  );
}

/** Gives back whatever was spent to open a room. */
export async function refundRoomEntry(wallet: string, entry: RoomEntry): Promise<void> {
  if (entry === "key") await refundKey(wallet);
  else await refundRoom(wallet);
}

async function grant(wallet: string, chats: number, rooms: number, keys = 0) {
  const row = await loadRow(wallet);
  await save(wallet, {
    chat_credits: row.chat_credits + chats,
    room_credits: row.room_credits + rooms,
    match_keys: (row.match_keys ?? 0) + keys,
  });
}

/** Records that the player opened one of today's reward links. */
export async function recordDailyVisit(wallet: string, linkId: string): Promise<void> {
  if (!DAILY_LINKS.some((link) => link.id === linkId)) throw new Error("Unknown reward link.");
  await supabaseAdmin
    .from("daily_visits")
    .upsert({ wallet, link_id: linkId, visit_date: today() }, { onConflict: "wallet,link_id,visit_date" });
}

async function visitedAllToday(wallet: string) {
  const { data } = await supabaseAdmin
    .from("daily_visits")
    .select("link_id")
    .eq("wallet", wallet)
    .eq("visit_date", today());
  const done = new Set(((data ?? []) as Array<{ link_id: string }>).map((row) => row.link_id));
  return DAILY_LINKS.every((link) => done.has(link.id));
}

/** Daily Twitter-visit reward: extra rooms and chat messages, once per day. */
export async function claimDaily(wallet: string): Promise<CreditState> {
  // The visits are checked on the server, not just in the dialog.
  if (!(await visitedAllToday(wallet))) {
    throw new Error("Open both X links first, then claim the reward.");
  }
  const { error } = await supabaseAdmin
    .from("daily_claims")
    .insert({ wallet, claim_date: today() });
  if (error) throw new Error("You already claimed today's reward. Come back tomorrow.");
  await grant(wallet, DAILY_REWARD.chats, 0, DAILY_REWARD.keys);
  return getCredits(wallet);
}
