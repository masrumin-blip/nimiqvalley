import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { MAX_TICKS, simulateRun } from "@/games/tappy/tappy-sim";

/**
 * Games verified by deterministic-replay (see tappy-sim.ts for the pattern).
 * Add a game here only once it has its own pure, seeded simulation module —
 * this is what lets the server recompute a score instead of trusting the
 * client's claim.
 */
const RUNNABLE_GAMES = ["tappy"] as const;
type RunnableSlug = (typeof RUNNABLE_GAMES)[number];

function simulatorFor(slug: RunnableSlug) {
  if (slug === "tappy") return simulateRun;
  throw new Error(`No verified simulator registered for "${slug}"`);
}

/** How long a player has to actually finish a round after requesting a seed. */
const SESSION_TTL_MS = 15 * 60_000;

interface GameRunSession {
  id: string;
  wallet: string;
  game_slug: string;
  seed: number;
  expires_at: string;
  consumed_at: string | null;
}

const slugSchema = z.enum(RUNNABLE_GAMES);

/** Issues a fresh, server-chosen seed for a new run. The client never picks its own seed. */
export const startGameRun = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ slug: slugSchema }).parse(data))
  .handler(async ({ data }): Promise<{ sessionId: string; seed: number }> => {
    const { currentWallet } = await import("./session.server");
    const wallet = await currentWallet();
    if (!wallet) throw new Error("Not signed in");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // NOTE: game_run_sessions was added in migration 0017. Until `Database` in
    // integrations/supabase/types.ts is regenerated to include it, this cast
    // is needed. Regenerate types and this `as any` can be dropped.
    const db = supabaseAdmin as unknown as {
      from(table: "game_run_sessions"): {
        insert(row: {
          wallet: string;
          game_slug: string;
          seed: number;
          expires_at: string;
        }): { select(cols: string): { single(): Promise<{ data: { id: string } | null; error: unknown }> } };
        select(cols: string): {
          eq(col: string, val: string): {
            maybeSingle(): Promise<{ data: GameRunSession | null; error: unknown }>;
          };
        };
        update(row: { consumed_at: string }): {
          eq(col: string, val: string): {
            is(col: string, val: null): {
              select(cols: string): { maybeSingle(): Promise<{ data: { id: string } | null; error: unknown }> };
            };
          };
        };
      };
    };

    // Not security-sensitive (it's a game seed, not a secret), so Math.random is fine here.
    const seed = Math.floor(Math.random() * 2 ** 31);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const { data: row, error } = await db
      .from("game_run_sessions")
      .insert({ wallet, game_slug: data.slug, seed, expires_at: expiresAt })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not start the run");

    return { sessionId: row.id, seed };
  });

const submitSchema = z.object({
  slug: slugSchema,
  sessionId: z.string().uuid(),
  // The input log: which ticks (0-based, 60 ticks/sec) a flap happened on.
  inputs: z.array(z.number().int().min(0).max(MAX_TICKS)).max(20_000),
});

export type SubmitGameRunResult =
  | { saved: true; score: number }
  | { saved: false; reason: "not-signed-in" | "invalid-session" | "not-better" | "error"; score?: number };

/**
 * The only way a score can reach the leaderboard. The client sends its
 * input log, never a score — this function replays the same deterministic
 * simulation server-side and writes whatever score *that* produces.
 */
export const submitGameRun = createServerFn({ method: "POST" })
  .inputValidator((data) => submitSchema.parse(data))
  .handler(async ({ data }): Promise<SubmitGameRunResult> => {
    const { currentWallet } = await import("./session.server");
    const wallet = await currentWallet();
    if (!wallet) return { saved: false, reason: "not-signed-in" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Same not-yet-generated-types situation as startGameRun above.
    const db = supabaseAdmin as unknown as {
      from(table: "game_run_sessions"): {
        select(cols: string): {
          eq(col: string, val: string): {
            maybeSingle(): Promise<{ data: GameRunSession | null; error: unknown }>;
          };
        };
        update(row: { consumed_at: string }): {
          eq(col: string, val: string): {
            is(col: string, val: null): {
              select(cols: string): { maybeSingle(): Promise<{ data: { id: string } | null; error: unknown }> };
            };
          };
        };
      };
    };

    const { data: session } = await db
      .from("game_run_sessions")
      .select("id, wallet, game_slug, seed, expires_at, consumed_at")
      .eq("id", data.sessionId)
      .maybeSingle();

    if (
      !session ||
      session.wallet !== wallet ||
      session.game_slug !== data.slug ||
      session.consumed_at ||
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      return { saved: false, reason: "invalid-session" };
    }

    // Consume the session atomically (guarded by consumed_at IS NULL) so the
    // exact same run can never be submitted twice, even under a race.
    const { data: consumedRow } = await db
      .from("game_run_sessions")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();
    if (!consumedRow) return { saved: false, reason: "invalid-session" };

    // The client's input log is the only untrusted input from here on. The
    // score below is computed entirely server-side from the seed + inputs.
    const result = simulatorFor(data.slug)(session.seed, data.inputs);

    const { getLeaderboardGame } = await import("./leaderboard");
    const game = getLeaderboardGame(data.slug)!;

    const { data: existing } = await supabaseAdmin
      .from("scores")
      .select("value")
      .eq("wallet", wallet)
      .eq("game_slug", data.slug)
      .maybeSingle();

    if (existing) {
      const current = Number(existing.value);
      const better = game.order === "asc" ? result.score < current : result.score > current;
      if (!better) return { saved: false, reason: "not-better", score: result.score };
    }

    const { error } = await supabaseAdmin.from("scores").upsert(
      { wallet, game_slug: data.slug, value: result.score, updated_at: new Date().toISOString() },
      { onConflict: "wallet,game_slug" },
    );
    if (error) return { saved: false, reason: "error", score: result.score };

    return { saved: true, score: result.score };
  });
