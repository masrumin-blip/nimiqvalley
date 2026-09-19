/** Credit balances, NIM payment redemption and daily rewards. Server only. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  CHAT_PACKS,
  DAILY_LINKS,
  DAILY_REWARD,
  FREE_CHATS_PER_DAY,
  KEY_COST_NIM,
  PAY_TO_ADDRESS,
  ROOM_COST_NIM,
  type CreditState,
} from "./credits";

const RPC_URL = "https://rpc.nimiqwatch.com";

/**
 * The generated Database types only know the functions that existed when they
 * were last regenerated. The atomic credit functions come from migration
 * 0015_atomic_credit_operations.sql, so call them through an untyped rpc
 * handle and check the shape here.
 */
async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const client = supabaseAdmin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc(fn, args);
  return { data: (data as T | null) ?? null, error: error?.message ?? null };
}

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
  await supabaseAdmin
    .from("wallet_credits")
    .upsert({ ...fresh, updated_at: new Date().toISOString() });
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

export type ChatSpend = CreditState & { source: "free" | "paid" };

/**
 * Spends one AI chat message (free daily quota first, then paid credits) in a
 * single atomic database call — concurrent requests can no longer spend the
 * same credit twice. Throws when the player has nothing left.
 */
export async function spendChat(wallet: string): Promise<ChatSpend> {
  const { data, error } = await callRpc<Array<{ source: string }>>("spend_chat_credit", {
    p_wallet: wallet,
    p_free_limit: FREE_CHATS_PER_DAY,
  });
  const row = data?.[0];
  if (error || !row) {
    if (error?.includes("NO_CHAT_CREDIT")) {
      throw new Error("No chat messages left. Buy a pack or claim the daily reward.");
    }
    throw new Error("Could not spend a chat message. Please try again.");
  }
  return { ...(await getCredits(wallet)), source: row.source === "free" ? "free" : "paid" };
}

/** Gives one chat message back, e.g. when the AI gateway failed to answer. */
export async function refundChat(wallet: string, source: "free" | "paid"): Promise<void> {
  await callRpc("refund_chat_credit", { p_wallet: wallet, p_source: source });
}

/** Spends one room credit atomically. Throws when the player has none. */
export async function spendRoom(wallet: string): Promise<void> {
  const { data, error } = await callRpc<boolean>("spend_room_credit", { p_wallet: wallet });
  if (error || !data) {
    throw new Error(
      `Creating a room costs ${ROOM_COST_NIM} NIM. Buy room credits or claim the daily reward.`,
    );
  }
}

/** Spends one match key atomically. Every online match entry needs one. */
export async function spendKey(wallet: string): Promise<void> {
  const { data, error } = await callRpc<boolean>("spend_match_key", { p_wallet: wallet });
  if (error || !data) {
    throw new Error(
      `You need a match key to play online. Claim the daily reward or buy one for ${KEY_COST_NIM} NIM.`,
    );
  }
}

/** Gives a match key back, e.g. when a matchmaking search is cancelled. */
export async function refundKey(wallet: string): Promise<void> {
  await callRpc("grant_credits", { p_wallet: wallet, p_key: 1 });
}

/** Gives a room pass back when the room was never actually played. */
export async function refundRoom(wallet: string): Promise<void> {
  await callRpc("grant_credits", { p_wallet: wallet, p_room: 1 });
}

export type RoomEntry = "key" | "room";

/** Opening a room costs one match key OR one room pass — whichever the player has. */
export async function spendRoomEntry(wallet: string): Promise<RoomEntry> {
  const { data, error } = await callRpc<string>("spend_room_entry", { p_wallet: wallet });
  if (error || (data !== "key" && data !== "room")) {
    throw new Error(
      `Opening a room needs a match key or a room pass. Claim the daily reward, or buy one for ${KEY_COST_NIM} NIM (key) or ${ROOM_COST_NIM} NIM (room pass).`,
    );
  }
  return data;
}

/** Gives back whatever was spent to open a room. */
export async function refundRoomEntry(wallet: string, entry: RoomEntry): Promise<void> {
  if (entry === "key") await refundKey(wallet);
  else await refundRoom(wallet);
}

async function grant(wallet: string, chats: number, rooms: number, keys = 0) {
  await callRpc("grant_credits", {
    p_wallet: wallet,
    p_chat: chats,
    p_room: rooms,
    p_key: keys,
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

function normalizeTx(tx: RawTx): ChainTx {
  return {
    hash: String(tx.hash ?? "").toLowerCase(),
    from: normalizeAddress(tx.from ?? tx.sender ?? ""),
    to: normalizeAddress(tx.to ?? tx.recipient ?? ""),
    nim: (typeof tx.value === "number" ? tx.value : 0) / 100_000,
    timestamp: typeof tx.timestamp === "number" ? tx.timestamp : 0,
  };
}

/** Recent transactions sent by a wallet to the NimiqValley address. */
async function recentPayments(wallet: string): Promise<ChainTx[]> {
  const raw = await rpc<RawTx[]>("getTransactionsByAddress", [normalizeAddress(wallet), 20]);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeTx).filter((tx) => tx.hash.length >= 8);
}

const PAYMENT_WINDOW_MS = 15 * 60_000;
const CONFIRM_TIMEOUT_MS = 40_000;
const CONFIRM_INTERVAL_MS = 2_500;
/** A payment may only cover this much more than the price, so a big transfer
 * is never swallowed by a cheap purchase. */
const MAX_OVERPAY_NIM = 1;

function paymentMatches(tx: ChainTx, wallet: string, expectedNim: number): boolean {
  if (tx.to !== normalizeAddress(PAY_TO_ADDRESS)) return false;
  if (tx.from !== normalizeAddress(wallet)) return false;
  if (tx.nim + 0.001 < expectedNim || tx.nim > expectedNim + MAX_OVERPAY_NIM) return false;
  if (tx.timestamp) {
    const ms = tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp;
    if (Date.now() - ms > PAYMENT_WINDOW_MS) return false;
  }
  return true;
}

async function paymentAlreadyUsed(hash: string): Promise<boolean> {
  const { data: seen } = await supabaseAdmin
    .from("nim_payments")
    .select("id")
    .eq("tx_hash", hash)
    .maybeSingle();
  return Boolean(seen);
}

/**
 * Verifies the exact transaction the player submitted. Polling briefly while
 * the transaction propagates through the network.
 */
async function findSubmittedPayment(
  wallet: string,
  txHash: string,
  expectedNim: number,
): Promise<ChainTx | null> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  const wanted = txHash.trim().toLowerCase().replace(/^0x/, "");
  for (;;) {
    const raw = await rpc<RawTx>("getTransactionByHash", [wanted]);
    if (raw) {
      const tx = normalizeTx(raw);
      if (
        tx.hash &&
        paymentMatches(tx, wallet, expectedNim) &&
        !(await paymentAlreadyUsed(tx.hash))
      ) {
        return tx;
      }
      // The transaction exists but does not match this purchase — no retry helps.
      if (tx.hash) return null;
    }
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_INTERVAL_MS));
  }
}

/** Find a fresh, unused payment from this wallet that matches `expectedNim`. */
async function findRecentPayment(wallet: string, expectedNim: number): Promise<ChainTx | null> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;

  for (;;) {
    const list = await recentPayments(wallet);
    const candidates = list
      .filter((tx) => paymentMatches(tx, wallet, expectedNim))
      // Closest amount first, then the most recent one.
      .sort(
        (a, b) =>
          Math.abs(a.nim - expectedNim) - Math.abs(b.nim - expectedNim) ||
          b.timestamp - a.timestamp,
      );

    for (const tx of candidates) {
      if (!(await paymentAlreadyUsed(tx.hash))) return tx;
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

  // When the player submits a transaction hash, verify that exact transaction
  // instead of guessing from recent payments — this never mixes payments up.
  const tx = input.txHash
    ? await findSubmittedPayment(input.wallet, input.txHash, expectedNim)
    : await findRecentPayment(input.wallet, expectedNim);
  if (!tx) {
    throw new Error(
      `We could not find a payment of ${expectedNim} NIM from your wallet yet. If the wallet confirmed it, try again in a moment.`,
    );
  }

  // One atomic call records the payment AND grants the credits, so a failure
  // can never leave a paid transaction marked "used" without credits.
  const { data, error } = await callRpc<boolean>("redeem_nim_payment", {
    p_tx_hash: tx.hash,
    p_wallet: input.wallet,
    p_kind: input.kind,
    p_nim: expectedNim,
    p_chat: chats,
    p_room: rooms,
    p_key: keys,
  });
  if (error) throw new Error("Could not add your credits. Please try again in a moment.");
  if (data === false) throw new Error("This payment was already used.");

  return getCredits(input.wallet);
}

/**
 * Records that the player says they opened one of today's reward links.
 * This is self-reported — there is no way to prove a visit to an external site
 * — so it only stops the reward from being claimed more than once per day.
 */
export async function recordDailyVisit(wallet: string, linkId: string): Promise<void> {
  if (!DAILY_LINKS.some((link) => link.id === linkId)) throw new Error("Unknown reward link.");
  await supabaseAdmin
    .from("daily_visits")
    .upsert(
      { wallet, link_id: linkId, visit_date: today() },
      { onConflict: "wallet,link_id,visit_date" },
    );
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
  // Both links must have been reported before the claim; the reports themselves
  // come from the player's own device and are not proof of a real visit.
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
