import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AchievementSummary } from "./achievements";

export const fetchAchievements = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ target: z.string().trim().min(4).max(60).optional() }).parse(input))
  .handler(async ({ data }): Promise<AchievementSummary> => {
    const { currentWallet } = await import("./session.server");
    const wallet = await currentWallet();
    if (!wallet) throw new Error("Connect your wallet to view achievements.");
    const { getAchievements } = await import("./achievements.server");
    return getAchievements(data.target ?? wallet);
  });