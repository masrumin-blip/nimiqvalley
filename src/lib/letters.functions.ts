import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Letter } from "./letters";

async function requireWallet() {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) throw new Error("Connect your wallet first.");
  return wallet;
}

export const sendLetter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        to: z.string().trim().regex(/^NQ\d{2}(\s?[0-9A-Z]{4}){8}$/i, "Enter a valid Nimiq address."),
        message: z.string().trim().min(1).max(280),
        token: z.enum(["none", "nim", "usdt"]),
        amount: z.number().min(0).max(1_000_000),
        txHash: z.string().trim().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
        usdtTo: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
      })
      .refine((d) => d.token === "none" || d.amount > 0, "Enter an amount.")
      .parse(input),
  )
  .handler(async ({ data }): Promise<Letter> => {
    const wallet = await requireWallet();
    const { sendLetter: send } = await import("./letters.server");
    return send(wallet, data);
  });

export const fetchInbox = createServerFn({ method: "GET" }).handler(async (): Promise<Letter[]> => {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) return [];
  const { listInbox } = await import("./letters.server");
  return listInbox(wallet);
});

export const fetchLetter = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { getLetter } = await import("./letters.server");
    return getLetter(wallet, data.id);
  });

export const openLetter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { markOpened } = await import("./letters.server");
    await markOpened(wallet, data.id);
    return { ok: true };
  });
