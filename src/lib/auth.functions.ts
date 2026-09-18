import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "crypto";
import { z } from "zod";

const walletSchema = z
  .string()
  .trim()
  .regex(/^NQ[0-9]{2}[ 0-9A-Z]{30,40}$/i, "Not a valid Nimiq address");

const challengeSchema = z.object({ address: walletSchema });

const signInSchema = z.object({
  address: walletSchema,
  challenge: z.string().uuid(),
  publicKey: z.string().regex(/^[0-9a-fA-F]{64}$/),
  signature: z.string().regex(/^[0-9a-fA-F]{128}$/),
  displayName: z.string().trim().max(16).optional(),
});

export type PlayerInfo = { wallet: string; displayName: string | null } | null;

export const createWalletChallenge = createServerFn({ method: "POST" })
  .inputValidator((data) => challengeSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wallet = data.address.toUpperCase();
    const challenge = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const message = `Sign in to NimiqValley\n\nWallet: ${wallet}\nChallenge: ${challenge}\nThis request does not send a transaction.`;
    const { error } = await supabaseAdmin.from("wallet_login_challenges").insert({
      wallet,
      challenge,
      expires_at: expiresAt,
    });
    if (error) throw new Error("Could not start wallet sign-in.");
    return { challenge, message };
  });

/** Store the connected wallet in an httpOnly session cookie and upsert its profile. */
export const signInWithWallet = createServerFn({ method: "POST" })
  .inputValidator((data) => signInSchema.parse(data))
  .handler(async ({ data }): Promise<PlayerInfo> => {
    const wallet = data.address.toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { playerSession } = await import("./session.server");

    const { data: stored, error: challengeError } = await supabaseAdmin
      .from("wallet_login_challenges")
      .select("id, wallet, expires_at, used_at")
      .eq("challenge", data.challenge)
      .maybeSingle();
    if (challengeError || !stored || stored.wallet !== wallet || stored.used_at) {
      throw new Error("This sign-in request is invalid or was already used.");
    }
    if (new Date(stored.expires_at).getTime() <= Date.now()) {
      throw new Error("This sign-in request expired. Please try again.");
    }

    const message = `Sign in to NimiqValley\n\nWallet: ${wallet}\nChallenge: ${data.challenge}\nThis request does not send a transaction.`;
    try {
      const { Address, PublicKey, Signature } = await import("@nimiq/core/web");
      const publicKey = PublicKey.fromHex(data.publicKey);
      const signature = Signature.fromHex(data.signature);
      if (!publicKey.toAddress().equals(Address.fromUserFriendlyAddress(wallet))) {
        throw new Error("The signing key does not belong to this wallet.");
      }

      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);
      const prefix = "\u0016Nimiq Signed Message:\n";
      // Nimiq's length prefix counts bytes, not UTF-16 code units.
      const lengthPrefixed = encoder.encode(`${prefix}${messageBytes.length}${message}`);
      const hubPrefixed = encoder.encode(`${prefix}${message}`);
      const sha256 = async (bytes: Uint8Array) =>
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));

      const candidates: Array<{ label: string; bytes: Uint8Array }> = [
        { label: "sha256(prefix+len+msg)", bytes: await sha256(lengthPrefixed) },
        { label: "sha256(prefix+msg)", bytes: await sha256(hubPrefixed) },
        { label: "sha256(msg)", bytes: await sha256(messageBytes) },
        { label: "raw(prefix+len+msg)", bytes: lengthPrefixed },
        { label: "raw(prefix+msg)", bytes: hubPrefixed },
        { label: "raw(msg)", bytes: messageBytes },
      ];

      const matched = candidates.find((candidate) => {
        try {
          return publicKey.verify(signature, candidate.bytes);
        } catch {
          return false;
        }
      });
      if (!matched) throw new Error("The wallet signature could not be verified.");
      console.info(`[wallet-login] signature verified via ${matched.label}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("The ")) throw error;
      throw new Error("The wallet signature could not be verified.");
    }

    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from("wallet_login_challenges")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stored.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (consumeError || !consumed) throw new Error("This sign-in request was already used.");

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
