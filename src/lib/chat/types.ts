/** Shared Arena chat types — safe for both client and server. */

export type ChatMessageKind = "user" | "system";
export type DmPolicy = "everyone" | "friends";
export type Visibility = "public" | "private";

export interface Socials {
  twitter: string;
  instagram: string;
  discord: string;
}

export interface ChatMessage {
  id: string;
  wallet: string;
  name: string;
  text: string;
  kind: ChatMessageKind;
  createdAt: string;
}

export interface ChatSnapshot {
  messages: ChatMessage[];
  onlineCount: number;
}

export interface Profile {
  wallet: string;
  name: string;
  bio: string;
  socials: Socials;
  visibility: Visibility;
  dmPolicy: DmPolicy;
}

export interface ProfileView {
  wallet: string;
  name: string;
  bio: string;
  socials: Socials | null;
  visibility: Visibility;
  hidden: boolean;
  canDm: boolean;
  relation: "self" | "friend" | "pending" | "none";
}

export type FriendStatus = "pending" | "accepted";

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  status: FriendStatus;
  createdAt: string;
}

export interface Player {
  wallet: string;
  name: string;
}

export interface DirectMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  createdAt: string;
}

export interface DmThread {
  wallet: string;
  name: string;
  lastText: string;
  lastAt: string;
}

export interface SocialSnapshot {
  profile: Profile;
  friends: Player[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  threads: DmThread[];
}

export const CHAT_LIMITS = {
  textMax: 240,
  bioMax: 140,
  socialMax: 32,
  historySize: 100,
} as const;

export const EMPTY_SOCIALS: Socials = { twitter: "", instagram: "", discord: "" };

/** Client polling interval for new messages. */
export const POLL_INTERVAL_MS = 2000;

/** Readable fallback name when a player has not set a display name. */
export function fallbackName(wallet: string) {
  const compact = wallet.replace(/\s+/g, "");
  return compact.length > 10 ? `${compact.slice(0, 6)}…${compact.slice(-4)}` : compact;
}

/** Stable conversation key for any pair of wallets. */
export function dmKey(a: string, b: string) {
  return [a.toUpperCase(), b.toUpperCase()].sort().join("|");
}
