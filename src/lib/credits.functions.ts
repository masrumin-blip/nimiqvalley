/** Typed RPC for credits, payments and the daily reward. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { CreditState } from "./credits";

async function requireWallet() {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) throw new Error("Connect your wallet first.");
  return wallet;
}

export const fetchCredits = createServerFn({ method: "GET" }).handler(
  async (): Promise<CreditState | null> => {
    const { currentWallet } = await import("./session.server");
    const wallet = await currentWallet();
    if (!wallet) return null;
    const { getCredits } = await import("./credits.server");
    return getCredits(wallet);
  },
);

export const getShopPrices = createServerFn({ method: "GET" }).handler(async () => {
  const { getNimUsdPrice } = await import("./purchases.server");
  return { nimUsd: await getNimUsdPrice() };
});

export const quotePurchase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["chat", "key", "room"]),
        token: z.enum(["nim", "usdt"]),
        packId: z.string().trim().max(32).optional(),
        keys: z.number().int().min(1).max(10).optional(),
        rooms: z.number().int().min(1).max(10).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { createQuote } = await import("./purchases.server");
    return createQuote(wallet, data);
  });

const hashSchema = z.string().trim().regex(/^(0x)?[0-9a-fA-F]{64}$/, "Invalid transaction hash.");

export const submitPurchaseTx = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), txHash: hashSchema }).parse(input))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { submitTx } = await import("./purchases.server");
    return submitTx(wallet, data.id, data.txHash);
  });

export const recheckPurchase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), txHash: hashSchema.optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { recheck } = await import("./purchases.server");
    return recheck(wallet, data.id, data.txHash);
  });

export const getPurchaseStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { purchaseStatus } = await import("./purchases.server");
    return purchaseStatus(wallet, data.id);
  });

export const getOpenPurchase = createServerFn({ method: "GET" }).handler(async () => {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) return null;
  const { latestOpenPurchase } = await import("./purchases.server");
  return latestOpenPurchase(wallet);
});

export const recordDailyVisit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ linkId: z.string().trim().min(1).max(32) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const wallet = await requireWallet();
    const { recordDailyVisit: record } = await import("./credits.server");
    await record(wallet, data.linkId);
    return { ok: true };
  });

export const claimDailyReward = createServerFn({ method: "POST" }).handler(
  async (): Promise<CreditState> => {
    const wallet = await requireWallet();
    const { claimDaily } = await import("./credits.server");
    return claimDaily(wallet);
  },
);
