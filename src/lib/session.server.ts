import { getRequestHeader, useSession } from "@tanstack/react-start/server";

import { PLAYER_TOKEN_HEADER } from "./player-token";

export type PlayerSession = { wallet?: string };

const TOKEN_TTL_MS = 60 * 60 * 24 * 60 * 1000;

// h3 throws "Empty password" when the session secret is missing (e.g. the
// sandbox dev server has not been restarted since the secret was added), which
// blanks the whole app. Fall back to a stable local-only key instead.
const FALLBACK_SESSION_SECRET = "nimiqvalley-local-dev-session-secret-0001";

function sessionPassword(): string {
  const secret = process.env["SESSION_SECRET"];
  if (secret && secret.length >= 32) return secret;
  console.warn("[session] SESSION_SECRET missing or too short; using local fallback key");
  return FALLBACK_SESSION_SECRET;
}

function sessionConfig() {
  return {
    password: sessionPassword(),
    name: "nimiqvalley-player",
    maxAge: 60 * 60 * 24 * 60,
    // The app runs inside the Lovable preview iframe (cross-site), so the
    // session cookie must be SameSite=None; Secure to be stored at all.
    cookie: { httpOnly: true, sameSite: "none" as const, secure: true, path: "/" },
  };
}

export async function playerSession() {
  return useSession<PlayerSession>(sessionConfig());
}

function requestToken(): string | null {
  try {
    return getRequestHeader(PLAYER_TOKEN_HEADER) ?? null;
  } catch {
    return null;
  }
}

/** Issue a long-lived token for clients whose cookies are blocked (WebViews). */
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

/** Wallet address of the signed-in player, or null. */
export async function currentWallet(): Promise<string | null> {
  const session = await playerSession();
  if (session.data.wallet) return session.data.wallet;

  const token = requestToken();
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("player_sessions")
    .select("wallet, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.wallet;
}
