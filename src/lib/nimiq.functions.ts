import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RPC_URL = "https://rpc.nimiqwatch.com";
const PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=usd";

/** Current NIM price in USD. Returns 0 when the price service is unavailable. */
export const getNimPrice = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const res = await fetch(PRICE_URL, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`price http ${res.status}`);
    const json = (await res.json()) as { "nimiq-2"?: { usd?: number } };
    const usd = json["nimiq-2"]?.usd;
    if (typeof usd !== "number") throw new Error("price missing");
    return { usd, error: null as string | null };
  } catch (err) {
    console.error("getNimPrice failed", err);
    return { usd: 0, error: "Price service unavailable" };
  }
});

/** NIM balance (in NIM) for an address. Returns 0 with an error note on failure. */
export const getNimBalance = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ address: z.string().min(30) }).parse(data))
  .handler(async ({ data }) => {
    const rpc = async <T,>(method: string, params: unknown[]): Promise<T | undefined> => {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!res.ok) throw new Error(`rpc http ${res.status}`);
      const json = (await res.json()) as { result?: { data?: T } };
      return json.result?.data;
    };
    try {
      const addr = data.address.replace(/\s+/g, "").toUpperCase().match(/.{1,4}/g)!.join(" ");
      const acc = await rpc<{ balance?: number }>("getAccountByAddress", [addr]);
      const luna = acc?.balance;
      if (typeof luna !== "number") throw new Error("balance missing");
      // Nimiq Pay parks funds in HTLC contracts owned by this address — include them.
      let htlcLuna = 0;
      try {
        const txs =
          (await rpc<Array<{ from?: string; to?: string; toType?: number; executionResult?: boolean }>>(
            "getTransactionsByAddress",
            [addr, 50, null],
          )) ?? [];
        const contracts = new Set(
          txs
            .filter((t) => t.toType === 2 && t.from === addr && t.executionResult !== false && t.to)
            .map((t) => t.to as string),
        );
        const accounts = await Promise.all(
          [...contracts].map((c) =>
            rpc<{ type?: string; sender?: string; balance?: number }>("getAccountByAddress", [c]).catch(() => undefined),
          ),
        );
        for (const a of accounts) {
          if (a?.type === "htlc" && a.sender === addr && typeof a.balance === "number") htlcLuna += a.balance;
        }
      } catch (e) {
        console.error("htlc lookup failed", e);
      }
      return { nim: (luna + htlcLuna) / 100_000, error: null as string | null };
    } catch (err) {
      console.error("getNimBalance failed", err);
      return { nim: 0, error: "Could not read NIM balance" };
    }
  });
