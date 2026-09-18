import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "crypto";
import { z } from "zod";

const walletSchema = z
  .string()
  .trim()
  .regex(/^NQ[0-9]{2}[ 0-9A-Z]{30,40}$/i, "Not a valid Nimiq address");

const challengeSchema = z.object({ address: walletSchema });

const keyMaterial = z.string().trim().min(32).max(256);

const signInSchema = z.object({
  address: walletSchema,
  challenge: z.string().uuid(),
  publicKey: keyMaterial,
  signature: keyMaterial,
  displayName: z.string().trim().max(16).optional(),
});

/** Nimiq wallets return hex or base64 encoded key material. */
function decodeKeyMaterial(raw: string): Uint8Array {
  const value = raw.trim();
  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    const out = new Uint8Array(value.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export type PlayerInfo = { wallet: string; displayName: string | null } | null;

/** Single-line ASCII challenge text: wallets mangle multi-line messages. */
function loginMessage(challenge: string): string {
  return `NimiqValley login - nonce: ${challenge}`;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
}

/**
 * Nimiq wallets differ in what exactly they sign: Hub/Keyguard signs
 * sha256(prefix + byteLength + message), other clients sign the raw message or
 * a prefixed variant. Try every known payload; the challenge is single-use so
 * accepting any valid signature over it is safe.
 */
async function verifyLoginSignature(
  publicKey: { verify: (signature: unknown, data: Uint8Array) => boolean },
  signature: unknown,
  message: string,
): Promise<string | null> {
  const encoder = new TextEncoder();
  const raw = encoder.encode(message);
  const candidates: Array<[string, Uint8Array]> = [
    ["prefix+len", encoder.encode(`\u0016Nimiq Signed Message:\n${raw.length}${message}`)],
    ["prefix", encoder.encode(`\u0016Nimiq Signed Message:\n${message}`)],
    ["raw", raw],
  ];
  for (const [label, bytes] of candidates) {
    if (publicKey.verify(signature, await sha256(bytes))) return `sha256(${label})`;
    if (publicKey.verify(signature, bytes)) return label;
  }
  return null;
}

export const createWalletChallenge = createServerFn({ method: "POST" })
  .inputValidator((data) => challengeSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wallet = data.address.toUpperCase();
    const challenge = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const message = loginMessage(challenge);
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

    const message = loginMessage(data.challenge);
    try {
      const { Address, PublicKey, Signature } = await import("@nimiq/core/web");
      const publicKey = new PublicKey(decodeKeyMaterial(data.publicKey));
      const signature = Signature.deserialize(decodeKeyMaterial(data.signature));
      if (!publicKey.toAddress().equals(Address.fromUserFriendlyAddress(wallet))) {
        console.warn("[wallet-login] rejected: public-key mismatch");
        throw new Error("The signing key does not belong to this wallet.");
      }

      const matched = await verifyLoginSignature(
        publicKey as unknown as { verify: (s: unknown, d: Uint8Array) => boolean },
        signature,
        message,
      );
      if (!matched) {
        console.warn("[wallet-login] rejected: signature mismatch");
        throw new Error("The wallet signature could not be verified.");
      }
      console.info(`[wallet-login] verified with ${matched}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("The ")) throw error;
      console.warn("[wallet-login] rejected: invalid response format", error);
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
