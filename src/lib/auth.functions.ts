import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const walletSchema = z
  .string()
  .trim()
  .regex(/^NQ[0-9]{2}[ 0-9A-Z]{30,40}$/i, "Not a valid Nimiq address");

const signInSchema = z.object({
  address: walletSchema,
  message: z.string().min(1).max(200),
  signature: z.string().min(8).max(512),
  displayName: z.string().trim().max(16).optional(),
});

export type PlayerInfo = { wallet: string; displayName: string | null } | null;

/** Store the connected wallet in an httpOnly session cookie and upsert its profile. */
export const signInWithWallet = createServerFn({ method: "POST" })
  .inputValidator((data) => signInSchema.parse(data))
  .handler(async ({ data }): Promise<PlayerInfo> => {
    const wallet = data.address.toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { playerSession } = await import("./session.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("wallet", wallet)
      .maybeSingle();

    const displayName = data.displayName?.trim() || existing?.display_name || null;

    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert({ wallet, display_name: displayName, updated_at: new Date().toISOString() });
    if (error) throw new Error("Could not save the player profile");

    const session = await playerSession();
    await session.update({ wallet });
    return { wallet, displayName };
  });

/** Current signed-in player, or null. */
export const getPlayer = createServerFn({ method: "GET" }).handler(async (): Promise<PlayerInfo> => {
  const { currentWallet } = await import("./session.server");
  const wallet = await currentWallet();
  if (!wallet) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("wallet", wallet)
    .maybeSingle();
  return { wallet, displayName: data?.display_name ?? null };
});

/** Update the player's display name (max 16 characters). */
export const setDisplayName = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ displayName: z.string().trim().max(16) }).parse(data))
  .handler(async ({ data }): Promise<PlayerInfo> => {
    const { currentWallet } = await import("./session.server");
    const wallet = await currentWallet();
    if (!wallet) throw new Error("Not signed in");
    const displayName = data.displayName || null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("wallet", wallet);
    if (error) throw new Error("Could not update the name");
    return { wallet, displayName };
  });

/** Sign the player out. */
export const signOutPlayer = createServerFn({ method: "POST" }).handler(async () => {
  const { playerSession } = await import("./session.server");
  const session = await playerSession();
  await session.clear();
  return { ok: true };
});
