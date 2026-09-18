/** Shared types for generic online rooms (checkers, carrom, hexaman). */

export type RoomStatus = "waiting" | "invited" | "playing" | "finished";
export type RoomKind = "quick" | "room" | "friend";
export type PlayerStatus = "joined" | "invited" | "playing" | "out" | "left";

export interface RoomPlayer {
  wallet: string;
  name: string;
  seat: number;
  status: PlayerStatus;
  score: number;
  stats: Record<string, number>;
}

export interface RoomState {
  id: string;
  gameSlug: string;
  code: string | null;
  kind: RoomKind;
  status: RoomStatus;
  hostWallet: string;
  maxPlayers: number;
  settings: Record<string, string | number | boolean>;
  turnNo: number;
  turnWallet: string | null;
  turnStartedAt: string;
  startedAt: string | null;
  endsAt: string | null;
  winnerWallet: string | null;
  players: RoomPlayer[];
}

export interface MoveRecord {
  turnNo: number;
  wallet: string;
  kind: string;
  payload: Record<string, number | string | boolean | null>;
}

export interface PlayerTick {
  wallet: string;
  x: number;
  y: number;
  dir: number;
  score: number;
  alive: boolean;
}

export interface LobbyState {
  room: RoomState | null;
  invites: RoomState[];
  friends: Array<{ wallet: string; name: string }>;
}

/** Turn timers, in ms. */
export const TURN_TIMEOUT_MS = 10_000;
/** Hexaman round length, in ms. */
export const HEXAMAN_ROUND_MS = 180_000;

export const ROOM_POLL_MS = 1000;
export const LOBBY_POLL_MS = 2000;
export const TICK_POLL_MS = 260;

/** Matchmaking queue tuning. */
export const QUEUE_POLL_MS = 1500;
/** How long a player waits before being offered a CPU match instead. */
export const QUEUE_WAIT_CAP_MS = 60_000;

/** Casual is free and unranked; ranked stakes one match pass per player. */
export type QueueMode = "casual" | "ranked";

export interface QueueState {
  waiting: boolean;
  waitedMs: number;
  queueSize: number;
  room: RoomState | null;
  suggestCpu: boolean;
  mode: QueueMode;
  /** Set when the pairing could not charge a player. */
  notice?: string | null;
}
