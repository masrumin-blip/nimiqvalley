/** Credit balances, NIM payment redemption and daily rewards. Server only. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  CHAT_PACKS,
  DAILY_REWARD,
  FREE_CHATS_PER_DAY,
  PAY_TO_ADDRESS,
  ROOM_COST_NIM,
  type CreditState,
} from "./credits";

const RPC_URL = "https://rpc.nimiqwatch.com";

type CreditRow = {
  wallet: string;
  chat_credits: number;
  room_credits: number;
  nim_balance: number;
  free_chats_date: string | null;
  free_chats_used: number;
};

const ROW_COLUMNS =
  "wallet, chat_credits, room_credits, nim_balance, free_chats_date, free_chats_used";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeAddress(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

async function loadRow(wallet: string): Promise<CreditRow> {
  const { data } = await supabaseAdmin
    .from("wallet_credits")
    .select(ROW_COLUMNS)
    .eq("wallet", wallet)
    .maybeSingle();
  if (data) {
    const row = data as CreditRow;
    return { ...row, nim_balance: Number(row.nim_balance ?? 0) };
  }
  const fresh: CreditRow = {
    wallet,
    chat_credits: 0,
    room_credits: 0,
    nim_balance: 0,
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
    nimBalance: Number(row.nim_balance ?? 0),
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

/** Append-only record of every pass and NIM movement. */
async function ledger(
  wallet: string,
  delta: number,
  unit: "pass" | "nim",
  reason: string,
  roomId: string | null,
) {
  await supabaseAdmin
    .from("mp_tickets")
    .insert({ wallet, delta, unit, reason, room_id: roomId });
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

/** True when the player still holds at least one match pass. */
export async function hasPass(wallet: string): Promise<boolean> {
  const row = await loadRow(wallet);
  return row.room_credits > 0;
}

/**
 * Spends one match pass — used both for opening a private room and for
 * entering a ranked quick match.
 */
export async function spendRoom(
  wallet: string,
  reason = "room",
  roomId: string | null = null,
): Promise<void> {
  const row = await loadRow(wallet);
  if (row.room_credits <= 0) {
    throw new Error(
      `This costs one match pass (${ROOM_COST_NIM} NIM). Buy passes or claim the daily reward.`,
    );
  }
  await save(wallet, { room_credits: row.room_credits - 1 });
  await ledger(wallet, -1, "pass", reason, roomId);
}

/** Gives a match pass back (cancelled or voided match). */
export async function refundRoom(wallet: string, reason: string, roomId: string | null = null) {
  const row = await loadRow(wallet);
  await save(wallet, { room_credits: row.room_credits + 1 });
  await ledger(wallet, 1, "pass", reason, roomId);
}

/** Credits match winnings as in-app NIM balance. */
export async function creditNim(
  wallet: string,
  nim: number,
  reason: string,
  roomId: string | null = null,
) {
  const row = await loadRow(wallet);
  await save(wallet, { nim_balance: Number(row.nim_balance ?? 0) + nim });
  await ledger(wallet, nim, "nim", reason, roomId);
}

async function grant(wallet: string, chats: number, rooms: number) {
  const row = await loadRow(wallet);
  await save(wallet, {
    chat_credits: row.chat_credits + chats,
    room_credits: row.room_credits + rooms,
  });
  if (rooms > 0) await ledger(wallet, rooms, "pass", "grant", null);
}

type TxLookup = { ok: boolean; recipient: string | null; nim: number };

async function lookupTx(hash: string): Promise<TxLookup> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransactionByHash",
        params: [hash],
      }),
    });
    if (!res.ok) return { ok: false, recipient: null, nim: 0 };
    const json = (await res.json()) as {
      result?: { data?: { to?: string; recipient?: string; value?: number } } & {
        to?: string;
        recipient?: string;
        value?: number;
      };
    };
    const tx = json.result?.data ?? json.result;
    if (!tx) return { ok: false, recipient: null, nim: 0 };
    const recipient = tx.to ?? tx.recipient ?? null;
    const luna = typeof tx.value === "number" ? tx.value : 0;
    return { ok: true, recipient, nim: luna / 100_000 };
  } catch {
    return { ok: false, recipient: null, nim: 0 };
  }
}

type RedeemInput = {
  wallet: string;
  txHash: string;
  kind: "chat" | "room";
  packId?: string | undefined;
  rooms?: number | undefined;
};

/**
 * Turns a confirmed NIM transaction into credits.
 * The hash is unique in the database, so the same payment can never be used twice.
 */
export async function redeemPayment(input: RedeemInput): Promise<CreditState> {
  const hash = input.txHash.trim().toLowerCase();
  if (hash.length < 8) throw new Error("That payment reference does not look right.");

  const { data: seen } = await supabaseAdmin
    .from("nim_payments")
    .select("id")
    .eq("tx_hash", hash)
    .maybeSingle();
  if (seen) throw new Error("This payment was already used.");

  let chats = 0;
  let rooms = 0;
  let expectedNim = 0;

  if (input.kind === "chat") {
    const pack = CHAT_PACKS.find((p) => p.id === input.packId);
    if (!pack) throw new Error("Unknown chat pack.");
    chats = pack.chats;
    expectedNim = pack.nim;
  } else {
    const count = Math.max(1, Math.min(10, Math.round(input.rooms ?? 1)));
    rooms = count;
    expectedNim = count * ROOM_COST_NIM;
  }

  const tx = await lookupTx(hash);
  if (tx.ok) {
    if (tx.recipient && normalizeAddress(tx.recipient) !== normalizeAddress(PAY_TO_ADDRESS)) {
      throw new Error("That payment did not go to the NimiqValley address.");
    }
    if (tx.nim > 0 && tx.nim + 0.001 < expectedNim) {
      throw new Error(`That payment was only ${tx.nim} NIM; ${expectedNim} NIM is needed.`);
    }
  }

  const { error } = await supabaseAdmin.from("nim_payments").insert({
    tx_hash: hash,
    wallet: input.wallet,
    kind: input.kind,
    nim: expectedNim,
    chat_credits: chats,
    room_credits: rooms,
  });
  if (error) throw new Error("This payment was already used.");

  await grant(input.wallet, chats, rooms);
  return getCredits(input.wallet);
}

/** Daily Twitter-visit reward: extra rooms and chat messages, once per day. */
export async function claimDaily(wallet: string): Promise<CreditState> {
  const { error } = await supabaseAdmin
    .from("daily_claims")
    .insert({ wallet, claim_date: today() });
  if (error) throw new Error("You already claimed today's reward. Come back tomorrow.");
  await grant(wallet, DAILY_REWARD.chats, DAILY_REWARD.rooms);
  return getCredits(wallet);
}
