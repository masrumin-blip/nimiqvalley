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

export const redeemPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        txHash: z.string().trim().max(400).optional(),
        kind: z.enum(["chat", "room", "key"]),
        packId: z.string().trim().max(32).optional(),
        rooms: z.number().int().min(1).max(10).optional(),
        keys: z.number().int().min(1).max(10).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CreditState> => {
    const wallet = await requireWallet();
    const { redeemPayment: redeem } = await import("./credits.server");
    return redeem({ wallet, ...data });
  });

export const claimDailyReward = createServerFn({ method: "POST" }).handler(
  async (): Promise<CreditState> => {
    const wallet = await requireWallet();
    const { claimDaily } = await import("./credits.server");
    return claimDaily(wallet);
  },
);
