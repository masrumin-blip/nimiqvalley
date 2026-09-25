/** Village post office: letters with optional NIM / USDT attachments. Server only. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { containsProfanity } from "./chat/moderation.server";
import type { Letter, SendLetterInput } from "./letters";

const NIM_RPC = "https://rpc.nimiqwatch.com";
const POLYGON_RPCS = [
  "https://polygon.drpc.org",
  "https://polygon.gateway.tenderly.co",
  "https://polygon-rpc.com",
];
const USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DAILY_LIMIT = 10;
const CONFIRM_TIMEOUT_MS = 40_000;

const norm = (v: string) => v.replace(/\s+/g, "").toUpperCase();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = {
  id: string;
  from_wallet: string;
  to_address: string;
  message: string;
  token: string;
  amount: number;
  tx_hash: string | null;
  created_at: string;
  opened_at: string | null;
};

function toLetter(r: Row): Letter {
  return {
    id: r.id,
    from: r.from_wallet,
    to: r.to_address,
    message: r.message,
    token: r.token as Letter["token"],
    amount: Number(r.amount),
    txHash: r.tx_hash,
    createdAt: r.created_at,
    openedAt: r.opened_at,
  };
}

async function hashUsed(hash: string) {
  const { data } = await supabaseAdmin.from("village_letters").select("id").eq("tx_hash", hash).maybeSingle();
  return Boolean(data);
}

async function nimRpc<T>(method: string, params: unknown[]): Promise<T | null> {
  try {
    const res = await fetch(NIM_RPC, {
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
  data?: string;
  recipientData?: string;
  senderData?: string;
};

function hexToText(hex: string): string {
  try {
    const clean = hex.replace(/^0x/, "");
    if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2) return "";
    let out = "";
    for (let i = 0; i < clean.length; i += 2) out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
    return out;
  } catch {
    return "";
  }
}

function txMemo(tx: RawTx): string {
  return hexToText(tx.recipientData ?? "") || hexToText(tx.data ?? "") || hexToText(tx.senderData ?? "");
}

/**
 * Find a fresh NIM transfer to the recipient with the exact amount.
 * When opts.memo is given, the recipient's incoming transactions are searched and the
 * transfer must carry that memo (sender does not need to match — the memo proves intent).
 * Otherwise the sender's transactions are searched and the sender must match.
 */
export async function findNimTransfer(
  sender: string,
  recipient: string,
  nim: number,
  isUsed: (hash: string) => Promise<boolean> = hashUsed,
  opts: { maxAgeMs?: number; timeoutMs?: number; memo?: string } = {},
): Promise<string | null> {
  const deadline = Date.now() + (opts.timeoutMs ?? CONFIRM_TIMEOUT_MS);
  const maxAge = opts.maxAgeMs ?? 15 * 60_000;
  const byRecipient = Boolean(opts.memo);
  const memoNeedle = (opts.memo ?? "").toLowerCase();
  for (;;) {
    const raw = await nimRpc<RawTx[]>("getTransactionsByAddress", [norm(byRecipient ? recipient : sender), 50, null]);
    if (Array.isArray(raw)) {
      for (const tx of raw) {
        const hash = String(tx.hash ?? "").toLowerCase();
        const value = (typeof tx.value === "number" ? tx.value : 0) / 100_000;
        const ts = typeof tx.timestamp === "number" ? (tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp) : Date.now();
        const senderOk = byRecipient ? true : norm(tx.from ?? tx.sender ?? "") === norm(sender);
        const memoOk = byRecipient ? txMemo(tx).toLowerCase().includes(memoNeedle) : true;
        if (
          hash.length >= 8 &&
          senderOk &&
          norm(tx.to ?? tx.recipient ?? "") === norm(recipient) &&
          Math.abs(value - nim) < 0.00001 &&
          memoOk &&
          Date.now() - ts < maxAge &&
          !(await isUsed(hash))
        )
          return hash;
      }
    }
    if (Date.now() >= deadline) return null;
    await sleep(2_500);
  }
}

/**
 * Checks one NIM transaction by hash. Returns "ok" when it matches, "bad" when it
 * exists but does not match, and "unknown" when the network has not seen it yet.
 */
export async function verifyNimTx(
  hash: string,
  sender: string,
  recipient: string,
  nim: number,
  memo?: string,
): Promise<"ok" | "bad" | "unknown"> {
  const tx = await nimRpc<RawTx>("getTransactionByHash", [hash.replace(/^0x/, "")]);
  if (!tx || typeof tx !== "object" || !(tx.to ?? tx.recipient)) return "unknown";
  const value = (typeof tx.value === "number" ? tx.value : 0) / 100_000;
  const senderOk = norm(tx.from ?? tx.sender ?? "") === norm(sender);
  const memoOk = memo ? txMemo(tx).toLowerCase().includes(memo.toLowerCase()) : false;
  const ok = (senderOk || memoOk) && norm(tx.to ?? tx.recipient ?? "") === norm(recipient) && Math.abs(value - nim) < 0.00001;
  return ok ? "ok" : "bad";
}

async function polygonReceipt(hash: string) {
  for (const url of POLYGON_RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "NimiqValley/1.0" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [hash] }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        result?: { status?: string; logs?: Array<{ address: string; topics: string[]; data: string }> } | null;
      };
      if (json.result) return json.result;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function verifyUsdtTx(hash: string, to: string, amount: number): Promise<"ok" | "bad" | "unknown"> {
  const target = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const units = BigInt(Math.round(amount * 1_000_000));
  const receipt = await polygonReceipt(hash);
  if (!receipt) return "unknown";
  if (receipt.status !== "0x1") return "bad";
  const matches = (receipt.logs ?? []).some(
    (log) =>
      log.address.toLowerCase() === USDT &&
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
      (log.topics[2] ?? "").toLowerCase().replace(/^0x/, "") === target &&
      BigInt(log.data) === units,
  );
  return matches ? "ok" : "bad";
}

export async function verifyUsdt(hash: string, to: string, amount: number): Promise<boolean> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  for (;;) {
    const result = await verifyUsdtTx(hash, to, amount);
    if (result !== "unknown") return result === "ok";
    if (Date.now() >= deadline) return false;
    await sleep(3_000);
  }
}

export async function sendLetter(wallet: string, input: SendLetterInput): Promise<Letter> {
  const message = input.message.trim();
  if (!message) throw new Error("Write a message first.");
  if (containsProfanity(message)) throw new Error("Please keep your letter friendly.");
  const to = input.to.replace(/\s+/g, " ").trim().toUpperCase();
  if (norm(to) === norm(wallet)) throw new Error("You cannot send a letter to yourself.");

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await supabaseAdmin
    .from("village_letters")
    .select("id", { count: "exact", head: true })
    .eq("from_wallet", wallet)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) throw new Error("You have sent 10 letters today. Try again tomorrow.");

  let txHash: string | null = null;
  if (input.token === "nim") {
    txHash = await findNimTransfer(wallet, to, input.amount);
    if (!txHash) throw new Error("We could not find your NIM payment yet. Please try again in a minute.");
  } else if (input.token === "usdt") {
    if (!input.txHash || !input.usdtTo) throw new Error("USDT payment is missing.");
    txHash = input.txHash.toLowerCase();
    if (await hashUsed(txHash)) throw new Error("This payment was already used.");
    if (!(await verifyUsdt(txHash, input.usdtTo, input.amount)))
      throw new Error("We could not confirm the USDT transfer.");
  }

  const { data, error } = await supabaseAdmin
    .from("village_letters")
    .insert({
      from_wallet: wallet,
      to_address: to,
      message,
      token: input.token,
      amount: input.token === "none" ? 0 : input.amount,
      usdt_to: input.token === "usdt" ? input.usdtTo ?? null : null,
      tx_hash: txHash,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error("The letter could not be sent.");
  return toLetter(data as Row);
}

export async function listInbox(wallet: string): Promise<Letter[]> {
  const { data } = await supabaseAdmin.from("village_letters").select("*").order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as Row[]).filter((r) => norm(r.to_address) === norm(wallet)).slice(0, 50).map(toLetter);
}

export async function getLetter(wallet: string, id: string): Promise<{ letter: Letter | null; forYou: boolean }> {
  const { data } = await supabaseAdmin.from("village_letters").select("*").eq("id", id).maybeSingle();
  if (!data) return { letter: null, forYou: false };
  const row = data as Row;
  const forYou = norm(row.to_address) === norm(wallet) || norm(row.from_wallet) === norm(wallet);
  return { letter: forYou ? toLetter(row) : null, forYou };
}

export async function markOpened(wallet: string, id: string) {
  const { data } = await supabaseAdmin.from("village_letters").select("to_address, opened_at").eq("id", id).maybeSingle();
  if (!data || data.opened_at || norm(data.to_address) !== norm(wallet)) return;
  await supabaseAdmin.from("village_letters").update({ opened_at: new Date().toISOString() }).eq("id", id);
}
