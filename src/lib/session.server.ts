import { getRequestHeader, useSession } from "@tanstack/react-start/server";

import { PLAYER_TOKEN_HEADER } from "./player-token";

export type PlayerSession = { wallet?: string };

/** Device tokens are short lived and refreshed while the player keeps playing. */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Cookie sessions only exist when a real secret is configured. There is no
 * built-in fallback key: a known key would let anyone forge a session cookie
 * for any wallet. Without the secret the app falls back to device tokens,
 * which are stored (and can be revoked) in the database.
 */
function sessionPassword(): string | null {
  const secret = process.env["SESSION_SECRET"];
  if (secret && secret.length >= 32) return secret;
  console.warn("[session] SESSION_SECRET missing or too short; cookie sessions are disabled");
  return null;
}

export async function playerSession() {
  const password = sessionPassword();
  if (!password) return null;
  return useSession<PlayerSession>({
    password,
    name: "nimiqvalley-player",
    maxAge: 60 * 60 * 24 * 7,
    // The app runs inside the Lovable preview iframe (cross-site), so the
    // session cookie must be SameSite=None; Secure to be stored at all.
    cookie: { httpOnly: true, sameSite: "none" as const, secure: true, path: "/" },
  });
}

function requestToken(): string | null {
  try {
    return getRequestHeader(PLAYER_TOKEN_HEADER) ?? null;
  } catch {
    return null;
  }
}

/** Issue a device token for clients whose cookies are blocked (WebViews). */
export async function issuePlayerToken(wallet: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = crypto.randomUUID();
  const { error } = await supabaseAdmin.from("player_sessions").insert({
    token,
    wallet,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  });
  if (error) throw new Error("Could not start the player session.");
  return token;
}

export async function revokeRequestToken() {
  const token = requestToken();
  if (!token) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("player_sessions").delete().eq("token", token);
}

/** Signs the wallet out everywhere, not just on this device. */
export async function revokeAllSessions(wallet: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("player_sessions").delete().eq("wallet", wallet);
}

/** Wallet address of the signed-in player, or null. */
export async function currentWallet(): Promise<string | null> {
  const session = await playerSession();
  if (session?.data.wallet) return session.data.wallet;

  const token = requestToken();
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("player_sessions")
    .select("wallet, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt <= Date.now()) {
    await supabaseAdmin.from("player_sessions").delete().eq("token", token);
    return null;
  }
  // Rolling expiry: active players stay signed in, forgotten tokens die.
  if (expiresAt - Date.now() < TOKEN_TTL_MS - TOKEN_REFRESH_AFTER_MS) {
    await supabaseAdmin
      .from("player_sessions")
      .update({ expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString() })
      .eq("token", token);
  }
  return data.wallet;
}
