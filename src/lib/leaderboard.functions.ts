import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { LEADERBOARD_SLUGS, getLeaderboardGame } from "./leaderboard";

export type LeaderboardRow = {
  rank: number;
  wallet: string;
  displayName: string | null;
  value: number;
};

export type LeaderboardResult = {
  rows: LeaderboardRow[];
  you: LeaderboardRow | null;
};

const slugSchema = z.string().refine((s) => LEADERBOARD_SLUGS.includes(s), "Unknown game");

/** Top 50 for a game, plus the signed-in player's own row and rank. */
export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ slug: slugSchema }).parse(data))
  .handler(async ({ data }): Promise<LeaderboardResult> => {
    const game = getLeaderboardGame(data.slug)!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { currentWallet } = await import("./session.server");

    const { data: rowsRaw, error } = await supabaseAdmin
      .from("scores")
      .select("wallet, value, profiles(display_name)")
      .eq("game_slug", data.slug)
      .order("value", { ascending: game.order === "asc" })
      .limit(50);
    if (error) {
      console.error("getLeaderboard failed", error);
      return { rows: [], you: null };
    }

    const rows: LeaderboardRow[] = (rowsRaw ?? []).map((r, i) => ({
      rank: i + 1,
      wallet: r.wallet,
      displayName:
        (r as unknown as { profiles?: { display_name: string | null } | null }).profiles
          ?.display_name ?? null,
      value: Number(r.value),
    }));

    const wallet = await currentWallet();
    if (!wallet) return { rows, you: null };

    const inTop = rows.find((r) => r.wallet === wallet);
    if (inTop) return { rows, you: inTop };

    const { data: mine } = await supabaseAdmin
      .from("scores")
      .select("wallet, value, profiles(display_name)")
      .eq("game_slug", data.slug)
      .eq("wallet", wallet)
      .maybeSingle();
    if (!mine) return { rows, you: null };

    const value = Number(mine.value);
    const comparison =
      game.order === "asc"
        ? await supabaseAdmin
            .from("scores")
            .select("wallet", { count: "exact", head: true })
            .eq("game_slug", data.slug)
            .lt("value", value)
        : await supabaseAdmin
            .from("scores")
            .select("wallet", { count: "exact", head: true })
            .eq("game_slug", data.slug)
            .gt("value", value);

    return {
      rows,
      you: {
        rank: (comparison.count ?? 0) + 1,
        wallet,
        displayName:
          (mine as unknown as { profiles?: { display_name: string | null } | null }).profiles
            ?.display_name ?? null,
        value,
      },
    };
  });

/** Save a finished round; only keeps the player's best result per game. */
export const submitScore = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ slug: slugSchema, value: z.number().finite().min(0).max(1e9) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { currentWallet } = await import("./session.server");
    const wallet = await currentWallet();
    if (!wallet) return { saved: false as const, reason: "not-signed-in" as const };

    const game = getLeaderboardGame(data.slug)!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("scores")
      .select("value")
      .eq("wallet", wallet)
      .eq("game_slug", data.slug)
      .maybeSingle();

    if (existing) {
      const current = Number(existing.value);
      const better = game.order === "asc" ? data.value < current : data.value > current;
      if (!better) return { saved: false as const, reason: "not-better" as const };
    }

    const { error } = await supabaseAdmin.from("scores").upsert(
      {
        wallet,
        game_slug: data.slug,
        value: data.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet,game_slug" },
    );
    if (error) {
      console.error("submitScore failed", error);
      return { saved: false as const, reason: "error" as const };
    }
    return { saved: true as const };
  });
