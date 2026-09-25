/** Credit purchases (chat packs, match keys) paid in NIM or USDT. Server only. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { treasuryNim } from "./admin.server";
import { CHAT_PACKS, KEY_COST_NIM, ROOM_COST_NIM } from "./credits";
import { hashAlreadyUsed } from "./league-deposits.server";
import { findNimTransfer, verifyNimTx, verifyUsdtTx } from "./letters.server";

const QUOTE_TTL_MS = 15 * 60_000;
const FAIL_AFTER_MS = 24 * 3_600_000;
const MIN_USDT = 0.0001;

let priceCache: { usd: number; at: number } | null = null;

export async function getNimUsdPrice(): Promise<number> {
  if (priceCache && Date.now() - priceCache.at < 5 * 60_000) return priceCache.usd;
  const sources: Array<() => Promise<number | undefined>> = [
    async () => {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=usd", {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(6_000),
      });
      const j = (await r.json()) as { "nimiq-2"?: { usd?: number } };
      return j["nimiq-2"]?.usd;
    },
    async () => {
      const r = await fetch("https://api.coinpaprika.com/v1/tickers/nim-nimiq", { signal: AbortSignal.timeout(6_000) });
      const j = (await r.json()) as { quotes?: { USD?: { price?: number } } };
      return j.quotes?.USD?.price;
    },
  ];
  for (const s of sources) {
    try {
      const usd = await s();
      if (typeof usd === "number" && usd > 0) {
        priceCache = { usd, at: Date.now() };
        return usd;
      }
    } catch {
      /* next */
    }
  }
  return priceCache?.usd ?? 0;
}

export function usdtFor(nim: number, usd: number) {
  return Math.max(MIN_USDT, Math.ceil(nim * usd * 10_000) / 10_000);
}

export type PurchaseInput = { kind: "chat" | "key" | "room"; packId?: string | undefined; keys?: number | undefined; rooms?: number | undefined; token: "nim" | "usdt" };
export type Quote = { id: string; token: "nim" | "usdt"; amount: number; payTo: string; memo: string };
export type PurchaseStatus = { id: string; status: string };

function nimPrice(input: PurchaseInput) {
  if (input.kind === "chat") {
    const pack = CHAT_PACKS.find((p) => p.id === input.packId);
    if (!pack) throw new Error("Unknown chat pack.");
    return { nim: pack.nim, chats: pack.chats, keys: 0, rooms: 0, packId: pack.id };
  }
  if (input.kind === "room") {
    const rooms = Math.max(1, Math.min(10, Math.round(input.rooms ?? 1)));
    return { nim: rooms * ROOM_COST_NIM, chats: 0, keys: 0, rooms, packId: null };
  }
  const keys = Math.max(1, Math.min(10, Math.round(input.keys ?? 1)));
  return { nim: keys * KEY_COST_NIM, chats: 0, keys, rooms: 0, packId: null };
}

export async function usdtPrices() {
  const usd = await getNimUsdPrice();
  return { usd, keyUsdt: usd ? usdtFor(KEY_COST_NIM, usd) : 0, roomUsdt: usd ? usdtFor(ROOM_COST_NIM, usd) : 0 };
}

export async function createQuote(wallet: string, input: PurchaseInput): Promise<Quote> {
  const p = nimPrice(input);
  let amount = p.nim;
  let payTo: string | null | undefined;
  if (input.token === "nim") {
    payTo = treasuryNim();
  } else {
    payTo = process.env["LEAGUE_TREASURY_POLYGON"];
    const usd = await getNimUsdPrice();
    if (!usd) throw new Error("USDT prices are unavailable right now. Please pay with NIM or try later.");
    amount = usdtFor(p.nim, usd);
  }
  if (!payTo) throw new Error("Payments are not open yet.");
  const id = crypto.randomUUID();
  const memo = `NimiqValley buy ${id.slice(0, 8)}`;
  const { error } = await supabaseAdmin.from("credit_purchases").insert({
    id, wallet, kind: input.kind, pack_id: p.packId, chats: p.chats, keys: p.keys, rooms: p.rooms,
    token: input.token, amount, memo,
  });
  if (error) throw new Error("Could not start the purchase.");
  return { id, token: input.token, amount, payTo, memo };
}

type Row = {
  id: string; wallet: string; token: string; amount: number; memo: string;
  tx_hash: string | null; status: string; attempts: number; created_at: string;
};

async function loadOwn(wallet: string, id: string): Promise<Row> {
  const { data } = await supabaseAdmin.from("credit_purchases").select("*").eq("id", id).eq("wallet", wallet).maybeSingle();
  if (!data) throw new Error("Purchase not found.");
  return data as unknown as Row;
}

async function confirm(id: string) {
  const { error } = await supabaseAdmin.rpc("confirm_credit_purchase", { p_id: id });
  if (error) throw new Error("Could not record the payment.");
}

async function check(row: Row): Promise<string> {
  if (row.status !== "pending" || !row.tx_hash) return row.status;
  const r = row.token === "nim"
    ? await verifyNimTx(row.tx_hash, row.wallet, treasuryNim() ?? "", Number(row.amount), row.memo)
    : await verifyUsdtTx(row.tx_hash, process.env["LEAGUE_TREASURY_POLYGON"] ?? "", Number(row.amount));
  if (r === "ok") {
    await confirm(row.id);
    return "confirmed";
  }
  const old = Date.now() - new Date(row.created_at).getTime() > FAIL_AFTER_MS;
  const status = r === "bad" || old ? "failed" : "pending";
  await supabaseAdmin
    .from("credit_purchases")
    .update({ status, attempts: row.attempts + 1, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "pending");
  return status;
}

async function attachHash(row: Row, hash: string) {
  if (await hashAlreadyUsed(hash)) throw new Error("This payment was already used.");
  const { error } = await supabaseAdmin
    .from("credit_purchases")
    .update({ tx_hash: hash, status: "pending", updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "quoted");
  if (error) throw new Error("This payment was already used.");
  return { ...row, tx_hash: hash, status: "pending" };
}

/** Records the wallet's transaction hash right away, then tries one quick check. */
export async function submitTx(wallet: string, id: string, txHash: string): Promise<PurchaseStatus> {
  let row = await loadOwn(wallet, id);
  if (row.status === "quoted") {
    row = await attachHash(row, txHash.trim().toLowerCase());
  }
  const status = await check(row).catch(() => "pending");
  return { id, status };
}

/** "I already paid": finds the payment by its memo (NIM) or by the given hash (USDT). */
export async function recheck(wallet: string, id: string, txHash?: string): Promise<PurchaseStatus> {
  let row = await loadOwn(wallet, id);
  if (row.status === "quoted") {
    if (Date.now() - new Date(row.created_at).getTime() > FAIL_AFTER_MS) throw new Error("This purchase expired.");
    let hash: string | null = null;
    if (row.token === "nim") {
      const to = treasuryNim();
      if (to) {
        hash = await findNimTransfer(wallet, to, Number(row.amount), hashAlreadyUsed, {
          memo: row.memo, maxAgeMs: FAIL_AFTER_MS, timeoutMs: 1,
        });
      }
    } else if (txHash) {
      hash = txHash.toLowerCase();
    }
    if (!hash) throw new Error("No payment for this purchase found yet. Already-counted payments are never added twice.");
    row = await attachHash(row, hash);
  }
  return { id, status: await check(row) };
}

export async function purchaseStatus(wallet: string, id: string): Promise<PurchaseStatus> {
  const row = await loadOwn(wallet, id);
  return { id, status: row.status };
}

export async function latestOpenPurchase(wallet: string) {
  const since = new Date(Date.now() - FAIL_AFTER_MS).toISOString();
  const { data } = await supabaseAdmin
    .from("credit_purchases")
    .select("id, kind, token, amount, status, created_at")
    .eq("wallet", wallet)
    .in("status", ["quoted", "pending"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const quoteExpired = data.status === "quoted" && Date.now() - new Date(data.created_at).getTime() > QUOTE_TTL_MS * 4;
  return quoteExpired ? null : (data as { id: string; kind: string; token: string; amount: number; status: string });
}

export async function processPendingPurchases() {
  const { data } = await supabaseAdmin.from("credit_purchases").select("*").eq("status", "pending").order("created_at").limit(25);
  let confirmed = 0;
  for (const row of (data ?? []) as unknown as Row[]) {
    try {
      if ((await check(row)) === "confirmed") confirmed++;
    } catch (e) {
      console.error("purchase check failed", row.id, e);
    }
  }
  return { checked: data?.length ?? 0, confirmed };
}
