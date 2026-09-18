/** Shared types for online Nimiq Soccer matches. */

export type MatchStatus = "waiting" | "invited" | "playing" | "finished";

export interface MatchState {
  id: string;
  code: string | null;
  kind: "quick" | "room" | "friend";
  status: MatchStatus;
  hostWallet: string;
  guestWallet: string | null;
  hostName: string;
  guestName: string | null;
  targetGoals: number;
  turnNo: number;
  turnWallet: string | null;
  turnStartedAt: string;
  winnerWallet: string | null;
}

export interface MatchMove {
  turnNo: number;
  wallet: string;
  kind: "shot" | "skip";
  piece: number;
  vx: number;
  vy: number;
}

export interface LobbyState {
  match: MatchState | null;
  invites: MatchState[];
  friends: Array<{ wallet: string; name: string }>;
}

/** A turn is skipped when the player does not shoot within this window. */
export const TURN_TIMEOUT_MS = 10_000;
export const MATCH_POLL_MS = 1000;
export const LOBBY_POLL_MS = 2000;
