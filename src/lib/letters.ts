export type LetterToken = "none" | "nim" | "usdt";

export interface Letter {
  id: string;
  from: string;
  to: string;
  message: string;
  token: LetterToken;
  amount: number;
  txHash: string | null;
  createdAt: string;
  openedAt: string | null;
}

export interface SendLetterInput {
  to: string;
  message: string;
  token: LetterToken;
  amount: number;
  txHash?: string | undefined;
  usdtTo?: string | undefined;
  memo?: string | undefined;
}

export const LETTER_MAX = 280;

export function letterLink(id: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://nimiqvalley.lovable.app";
  return `${origin}/village?letter=${id}`;
}

export function shortAddr(a: string) {
  const c = a.replace(/\s+/g, "");
  return c.length > 12 ? `${c.slice(0, 4)}…${c.slice(-4)}` : c;
}
