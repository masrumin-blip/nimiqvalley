/** Typed RPC for the saved AI story-room conversations. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { StoredAiMessage } from "./ai-chat.server";

const input = z.object({ characterId: z.string().trim().min(1).max(60) });

async function requireWallet() {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) throw new Error("Connect your wallet to open the story room.");
  return wallet;
}

export const fetchAiHistory = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }): Promise<StoredAiMessage[]> => {
    const { currentWallet } = await import("./session.server");
    const wallet = await currentWallet();
    if (!wallet) return [];
    const { listAiMessages } = await import("./ai-chat.server");
    return listAiMessages(wallet, data.characterId);
  });

export const clearAiHistory = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }) => {
    const wallet = await requireWallet();
    const { clearAiMessages } = await import("./ai-chat.server");
    return clearAiMessages(wallet, data.characterId);
  });
