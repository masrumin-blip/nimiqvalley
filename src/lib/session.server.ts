import { useSession } from "@tanstack/react-start/server";

export type PlayerSession = { wallet?: string };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
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

/** Wallet address of the signed-in player, or null. */
export async function currentWallet(): Promise<string | null> {
  const session = await playerSession();
  return session.data.wallet ?? null;
}
