/** Shared pricing and credit constants (client-safe). */

/** Every NIM payment in the app goes to this address. */
export const PAY_TO_ADDRESS = "NQ79 MC3X FDQK 6T5S 7T0Q 60TS B1DH BUHV RN2R";

/** Free AI chat messages every player gets each day. */
export const FREE_CHATS_PER_DAY = 3;

/**
 * One match pass costs this much NIM. The same pass opens a private room or
 * enters one ranked quick match.
 */
export const ROOM_COST_NIM = 25;

/** Ranked quick match: both players stake one pass. */
export const RANKED_STAKE_NIM = ROOM_COST_NIM;
/** The winner of a ranked quick match receives this NIM as in-app balance. */
export const RANKED_PAYOUT_NIM = 40;

/** Match-pass packs, bought with NIM. */
export const TICKET_PACKS = [
  { id: "single", nim: 25, passes: 1, label: "1 match pass" },
  { id: "ten", nim: 250, passes: 10, label: "10 match passes" },
] as const;

/** Extra rewards for the daily Twitter visit. Passes work for rooms or ranked. */
export const DAILY_REWARD = { rooms: 2, chats: 3 } as const;

export type ChatPack = { id: string; nim: number; chats: number; label: string };

export const CHAT_PACKS: ChatPack[] = [
  { id: "starter", nim: 100, chats: 10, label: "Starter" },
  { id: "storyteller", nim: 250, chats: 30, label: "Storyteller" },
  { id: "valley", nim: 500, chats: 75, label: "Valley Pass" },
];

export const ROOM_PACKS: ChatPack[] = [];

export type CreditState = {
  wallet: string;
  chatCredits: number;
  /** Match passes: one private room, or one ranked quick match. */
  roomCredits: number;
  /** Winnings held in the app, in NIM. */
  nimBalance: number;
  freeChatsLeft: number;
  claimedToday: boolean;
};

/** The two X accounts a player must visit for the daily reward. */
export const DAILY_LINKS = [
  { id: "nimiq", label: "Nimiq Pay on X", url: "https://x.com/nimiq" },
  { id: "valley", label: "NimiqValley on X", url: "https://x.com/nimiqvalley" },
] as const;

export function totalChatsLeft(credits: CreditState | null | undefined) {
  if (!credits) return 0;
  return credits.freeChatsLeft + credits.chatCredits;
}
