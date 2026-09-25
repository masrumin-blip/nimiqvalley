/** Platform owner checks. Server only. */
import { currentWallet } from "./session.server";

const norm = (a: string) => a.replace(/\s+/g, "").toUpperCase();

export async function adminWallet(): Promise<string | null> {
  const wallet = await currentWallet();
  if (!wallet) return null;
  const list = (process.env["ADMIN_WALLETS"] ?? "").split(",").map(norm).filter(Boolean);
  return list.includes(norm(wallet)) ? wallet : null;
}

export async function requireAdmin(): Promise<string> {
  const w = await adminWallet();
  if (!w) throw new Error("No access.");
  return w;
}

/**
 * NIM address that receives league prize pool deposits and pays out prizes.
 * Falls back to the first admin wallet when LEAGUE_TREASURY_NIM is not set.
 */
export function treasuryNim(): string | null {
  const direct = (process.env["LEAGUE_TREASURY_NIM"] ?? "").trim();
  if (direct) return direct;
  const firstAdmin = (process.env["ADMIN_WALLETS"] ?? "").split(",")[0]?.replace(/\s+/g, "");
  return firstAdmin || null;
}
