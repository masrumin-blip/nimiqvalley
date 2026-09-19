/** Credit balances, NIM payment redemption and daily rewards. Server only. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  CHAT_PACKS,
  DAILY_REWARD,
  FREE_CHATS_PER_DAY,
  KEY_COST_NIM,
  PAY_TO_ADDRESS,
  ROOM_COST_NIM,
  type CreditState,
} from "./credits";

const RPC_URL = "https://rpc.nimiqwatch.com";

type CreditRow = {
  wallet: string;
  chat_credits: number;
  room_credits: number;
  match_keys: number;
  free_chats_date: string | null;
  free_chats_used: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeAddress(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

async function loadRow(wallet: string): Promise<CreditRow> {
  const { data } = await supabaseAdmin
    .from("wallet_credits")
    .select("wallet, chat_credits, room_credits, match_keys, free_chats_date, free_chats_used")
    .eq("wallet", wallet)
    .maybeSingle();
  if (data) return data as CreditRow;
  const fresh: CreditRow = {
    wallet,
    chat_credits: 0,
    room_credits: 0,
    match_keys: 0,
    free_chats_date: today(),
    free_chats_used: 0,
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
      `You need a match key to play online. Claim the daily reward or buy one for ${KEY_COST_NIM} NIM.`,
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

type ChainTx = { hash: string; from: string; to: string; nim: number; timestamp: number };

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { data?: T } & T };
    return (json.result?.data ?? json.result ?? null) as T | null;
  } catch {
    return null;
  }
}

type RawTx = {
  hash?: string;
  from?: string;
  sender?: string;
  to?: string;
  recipient?: string;
  value?: number;
  timestamp?: number;
};

/** Recent transactions sent by a wallet to the NimiqValley address. */
async function recentPayments(wallet: string): Promise<ChainTx[]> {
  const raw = await rpc<RawTx[]>("getTransactionsByAddress", [normalizeAddress(wallet), 20]);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((tx) => ({
      hash: String(tx.hash ?? "").toLowerCase(),
      from: normalizeAddress(tx.from ?? tx.sender ?? ""),
      to: normalizeAddress(tx.to ?? tx.recipient ?? ""),
      nim: (typeof tx.value === "number" ? tx.value : 0) / 100_000,
      timestamp: typeof tx.timestamp === "number" ? tx.timestamp : 0,
    }))
    .filter((tx) => tx.hash.length >= 8);
}

const PAYMENT_WINDOW_MS = 15 * 60_000;
const CONFIRM_TIMEOUT_MS = 40_000;
const CONFIRM_INTERVAL_MS = 2_500;
/** A payment may only cover this much more than the price, so a big transfer
 * is never swallowed by a cheap purchase. */
const MAX_OVERPAY_NIM = 1;

/** Find a fresh, unused payment from this wallet that matches `expectedNim`. */
async function findRecentPayment(wallet: string, expectedNim: number): Promise<ChainTx | null> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  const target = normalizeAddress(PAY_TO_ADDRESS);
  const sender = normalizeAddress(wallet);

  for (;;) {
    const list = await recentPayments(wallet);
    const candidates = list
      .filter(
        (tx) =>
          tx.to === target &&
          tx.from === sender &&
          tx.nim + 0.001 >= expectedNim &&
          tx.nim <= expectedNim + MAX_OVERPAY_NIM,
      )
      .filter((tx) => {
        if (!tx.timestamp) return true;
        const ms = tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp;
        return Date.now() - ms <= PAYMENT_WINDOW_MS;
      })
      // Closest amount first, then the most recent one.
      .sort((a, b) => Math.abs(a.nim - expectedNim) - Math.abs(b.nim - expectedNim) || b.timestamp - a.timestamp);

    for (const tx of candidates) {
      const { data: seen } = await supabaseAdmin
        .from("nim_payments")
        .select("id")
        .eq("tx_hash", tx.hash)
        .maybeSingle();
      if (!seen) return tx;
    }

    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_INTERVAL_MS));
  }
}

type RedeemInput = {
  wallet: string;
  txHash?: string | undefined;
  kind: "chat" | "room" | "key";
  packId?: string | undefined;
  rooms?: number | undefined;
  keys?: number | undefined;
};

/**
 * Turns a confirmed NIM transaction into credits.
 * The hash is unique in the database, so the same payment can never be used twice.
 */
export async function redeemPayment(input: RedeemInput): Promise<CreditState> {
  let chats = 0;
  let rooms = 0;
  let keys = 0;
  let expectedNim = 0;

  if (input.kind === "chat") {
    const pack = CHAT_PACKS.find((p) => p.id === input.packId);
    if (!pack) throw new Error("Unknown chat pack.");
    chats = pack.chats;
    expectedNim = pack.nim;
  } else if (input.kind === "key") {
    const count = Math.max(1, Math.min(10, Math.round(input.keys ?? 1)));
    keys = count;
    expectedNim = count * KEY_COST_NIM;
  } else {
    const count = Math.max(1, Math.min(10, Math.round(input.rooms ?? 1)));
    rooms = count;
    expectedNim = count * ROOM_COST_NIM;
  }

  const tx = await findRecentPayment(input.wallet, expectedNim);
  if (!tx) {
    throw new Error(
      `We could not find a payment of ${expectedNim} NIM from your wallet yet. If the wallet confirmed it, try again in a moment.`,
    );
  }

  const { error } = await supabaseAdmin.from("nim_payments").insert({
    tx_hash: tx.hash,
    wallet: input.wallet,
    kind: input.kind,
    nim: expectedNim,
    chat_credits: chats,
    room_credits: rooms,
    key_credits: keys,
  });
  if (error) throw new Error("This payment was already used.");

  await grant(input.wallet, chats, rooms, keys);
  return getCredits(input.wallet);
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
  await grant(wallet, DAILY_REWARD.chats, DAILY_REWARD.rooms, DAILY_REWARD.keys);
  return getCredits(wallet);
}
