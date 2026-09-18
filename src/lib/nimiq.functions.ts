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
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountByAddress",
          params: [data.address],
        }),
      });
      if (!res.ok) throw new Error(`rpc http ${res.status}`);
      const json = (await res.json()) as {
        result?: { data?: { balance?: number } };
        error?: unknown;
      };
      const luna = json.result?.data?.balance;
      if (typeof luna !== "number") throw new Error("balance missing");
      return { nim: luna / 100_000, error: null as string | null };
    } catch (err) {
      console.error("getNimBalance failed", err);
      return { nim: 0, error: "Could not read NIM balance" };
    }
  });
