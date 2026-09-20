/** Shared pricing and credit constants (client-safe). */

/** Every NIM payment in the app goes to this address. */
export const PAY_TO_ADDRESS = "NQ79 MC3X FDQK 6T5S 7T0Q 60TS B1DH BUHV RN2R";

/** Free AI chat messages every player gets each day. */
export const FREE_CHATS_PER_DAY = 3;

/** Cost of creating one online multiplayer room. */
export const ROOM_COST_NIM = 25;

/** Cost of one match key (needed to enter online matchmaking). */
export const KEY_COST_NIM = 20;

/** Extra rewards for the daily Twitter visit. */
export const DAILY_REWARD = { chats: 3, keys: 2 } as const;

/** Free match keys every player gets automatically each day. */
export const FREE_KEYS_PER_DAY = 15;


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
  roomCredits: number;
  matchKeys: number;
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
