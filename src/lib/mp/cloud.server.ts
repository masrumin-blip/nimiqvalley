/** Generic online-room data access — runs on the server with the admin client. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { resolveNames } from "@/lib/chat/cloud.server";
import {
  TURN_TIMEOUT_MS,
  type MoveRecord,
  type PlayerTick,
  type RoomKind,
  type RoomPlayer,
  type RoomState,
} from "./types";

type RoomRow = {
  id: string;
  game_slug: string;
  code: string | null;
  kind: string;
  status: string;
  host_wallet: string;
  max_players: number;
  settings: unknown;
  turn_no: number;
  turn_wallet: string | null;
  turn_started_at: string;
  started_at: string | null;
  ends_at: string | null;
  winner_wallet: string | null;
};

type PlayerRow = {
  wallet: string;
  seat: number;
  status: string;
  score: number | string;
  stats: unknown;
};

const COLUMNS =
  "id, game_slug, code, kind, status, host_wallet, max_players, settings, turn_no, turn_wallet, turn_started_at, started_at, ends_at, winner_wallet";

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function playersOf(roomIds: string[]): Promise<Map<string, PlayerRow[]>> {
  const map = new Map<string, PlayerRow[]>();
  if (roomIds.length === 0) return map;
  const { data } = await supabaseAdmin
    .from("mp_room_players")
    .select("room_id, wallet, seat, status, score, stats")
    .in("room_id", roomIds)
    .order("seat", { ascending: true });
  for (const row of (data ?? []) as Array<PlayerRow & { room_id: string }>) {
    const list = map.get(row.room_id) ?? [];
    list.push(row);
    map.set(row.room_id, list);
  }
  return map;
}

async function toStates(rows: RoomRow[]): Promise<RoomState[]> {
  if (rows.length === 0) return [];
  const byRoom = await playersOf(rows.map((r) => r.id));
  const wallets = new Set<string>();
  for (const r of rows) {
    wallets.add(r.host_wallet);
    for (const p of byRoom.get(r.id) ?? []) wallets.add(p.wallet);
  }
  const names = await resolveNames([...wallets]);
  return rows.map((row) => ({
    id: row.id,
    gameSlug: row.game_slug,
    code: row.code,
    kind: (row.kind as RoomKind) ?? "quick",
    status: row.status as RoomState["status"],
    hostWallet: row.host_wallet,
    maxPlayers: row.max_players,
    settings: (row.settings as Record<string, string | number | boolean>) ?? {},
    turnNo: row.turn_no,
    turnWallet: row.turn_wallet,
    turnStartedAt: row.turn_started_at,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    winnerWallet: row.winner_wallet,
    players: (byRoom.get(row.id) ?? []).map(
      (p): RoomPlayer => ({
        wallet: p.wallet,
        name: names.get(p.wallet) ?? p.wallet,
        seat: p.seat,
        status: p.status as RoomPlayer["status"],
        score: Number(p.score ?? 0),
        stats: (p.stats as Record<string, number>) ?? {},
      }),
    ),
  }));
}

async function toState(row: RoomRow): Promise<RoomState> {
  const [state] = await toStates([row]);
  return state!;
}

async function getRow(id: string): Promise<RoomRow | null> {
  const { data } = await supabaseAdmin.from("mp_rooms").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as RoomRow | null) ?? null;
}

export async function getRoom(id: string): Promise<RoomState | null> {
  const row = await getRow(id);
  return row ? toState(row) : null;
}

export async function activeRoom(wallet: string, gameSlug: string): Promise<RoomState | null> {
  const { data: mine } = await supabaseAdmin
    .from("mp_room_players")
    .select("room_id")
    .eq("wallet", wallet)
    .in("status", ["joined", "playing", "out"]);
  const ids = ((mine ?? []) as Array<{ room_id: string }>).map((r) => r.room_id);
  if (ids.length === 0) return null;
  const { data } = await supabaseAdmin
    .from("mp_rooms")
    .select(COLUMNS)
    .eq("game_slug", gameSlug)
    .in("id", ids)
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as RoomRow | undefined;
  return row ? toState(row) : null;
}

export async function invitesFor(wallet: string, gameSlug: string): Promise<RoomState[]> {
  const { data: mine } = await supabaseAdmin
    .from("mp_room_players")
    .select("room_id")
    .eq("wallet", wallet)
    .eq("status", "invited");
  const ids = ((mine ?? []) as Array<{ room_id: string }>).map((r) => r.room_id);
  if (ids.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("mp_rooms")
    .select(COLUMNS)
    .eq("game_slug", gameSlug)
    .eq("status", "invited")
    .in("id", ids)
    .order("created_at", { ascending: false })
    .limit(10);
  return toStates((data ?? []) as RoomRow[]);
}

export async function listMoves(id: string, since: number): Promise<MoveRecord[]> {
  const { data } = await supabaseAdmin
    .from("mp_moves")
    .select("turn_no, wallet, kind, payload")
    .eq("room_id", id)
    .gt("turn_no", since)
    .order("turn_no", { ascending: true });
  return ((data ?? []) as Array<{ turn_no: number; wallet: string; kind: string; payload: unknown }>).map(
    (m) => ({
      turnNo: m.turn_no,
      wallet: m.wallet,
      kind: m.kind,
      payload: (m.payload as MoveRecord["payload"]) ?? {},
    }),
  );
}

/**
 * Real-time action games (bomber) have no turn order: every player can fire an
 * event at any moment. Events reuse the move log but grab the next free
 * sequence number instead of waiting for a turn.
 */
export async function pushEvent(
  wallet: string,
  id: string,
  kind: string,
  payload: Record<string, number | string | boolean | null>,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: last } = await supabaseAdmin
      .from("mp_moves")
      .select("turn_no")
      .eq("room_id", id)
      .order("turn_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const turnNo = Number((last as { turn_no?: number } | null)?.turn_no ?? 0) + 1 + attempt;
    const { error } = await supabaseAdmin
      .from("mp_moves")
      .insert({ room_id: id, turn_no: turnNo, wallet, kind, payload });
    if (!error) return { ok: true, turnNo };
  }
  return { ok: false, turnNo: 0 };
}

export async function listTicks(id: string): Promise<PlayerTick[]> {
  const { data } = await supabaseAdmin
    .from("mp_ticks")
    .select("wallet, x, y, dir, score, alive")
    .eq("room_id", id);
  return ((data ?? []) as PlayerTick[]).map((t) => ({
    wallet: t.wallet,
    x: Number(t.x),
    y: Number(t.y),
    dir: Number(t.dir),
    score: Number(t.score),
    alive: Boolean(t.alive),
  }));
}

/**
 * Leaves every open room of this game the player is still sitting in.
 * Returns the entry costs ("key" / "room") of rooms this player hosted that were
 * never actually played, so the caller can give them back.
 */
export async function abandonAll(
  wallet: string,
  gameSlug: string,
): Promise<Array<"key" | "room">> {
  const { data: mine } = await supabaseAdmin
    .from("mp_room_players")
    .select("room_id")
    .eq("wallet", wallet);
  const ids = ((mine ?? []) as Array<{ room_id: string }>).map((r) => r.room_id);
  if (ids.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("mp_rooms")
    .select("id, host_wallet, status, settings")
    .eq("game_slug", gameSlug)
    .in("id", ids)
    .in("status", ["waiting", "invited", "playing"]);
  const rows = (data ?? []) as Array<{
    id: string;
    host_wallet: string;
    status: string;
    settings: Record<string, unknown> | null;
  }>;
  if (rows.length === 0) return [];

  // A room the host leaves before anyone else sat down was never used.
  const refunds: Array<"key" | "room"> = [];
  for (const row of rows) {
    if (row.host_wallet !== wallet) continue;
    if (row.status === "playing") continue;
    if ((await seatCount(row.id)) > 1) continue;
    const entry = row.settings?.["__entry"];
    refunds.push(entry === "room" ? "room" : "key");
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("mp_room_players")
    .update({ status: "left", updated_at: now })
    .eq("wallet", wallet)
    .in(
      "room_id",
      rows.map((r) => r.id),
    );
  await supabaseAdmin
    .from("mp_rooms")
    .update({ status: "finished", updated_at: now })
    .in(
      "id",
      rows.map((r) => r.id),
    );
  return refunds;
}

async function addPlayer(roomId: string, wallet: string, seat: number, status: string) {
  await supabaseAdmin
    .from("mp_room_players")
    .upsert(
      { room_id: roomId, wallet, seat, status, updated_at: new Date().toISOString() },
      { onConflict: "room_id,wallet" },
    );
}

export async function createRoom(
  wallet: string,
  gameSlug: string,
  kind: RoomKind,
  maxPlayers: number,
  settings: Record<string, string | number | boolean>,
  guest: string | null,
): Promise<RoomState> {
  await abandonAll(wallet, gameSlug);
  const { data, error } = await supabaseAdmin
    .from("mp_rooms")
    .insert({
      game_slug: gameSlug,
      kind,
      code: kind === "quick" ? null : randomCode(),
      host_wallet: wallet,
      status: guest && kind === "friend" ? "invited" : "waiting",
      max_players: maxPlayers,
      settings,
      turn_wallet: wallet,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error("Could not create the room.");
  const row = data as RoomRow;
  await addPlayer(row.id, wallet, 0, "joined");
  if (guest) await addPlayer(row.id, guest, 1, "invited");
  return toState(row);
}

async function seatCount(roomId: string) {
  const { data } = await supabaseAdmin
    .from("mp_room_players")
    .select("wallet, status")
    .eq("room_id", roomId);
  return ((data ?? []) as Array<{ status: string }>).filter((p) => p.status !== "left").length;
}

async function joinExisting(row: RoomRow, wallet: string): Promise<RoomState> {
  const seats = await seatCount(row.id);
  if (seats >= row.max_players) throw new Error("That room is already full.");
  await abandonAll(wallet, row.game_slug);
  await addPlayer(row.id, wallet, seats, "joined");
  const now = new Date().toISOString();
  const full = seats + 1 >= row.max_players;
  // Two-player games start as soon as the second player sits down.
  const patch =
    row.max_players === 2 && full
      ? {
          status: "playing",
          turn_wallet: row.host_wallet,
          turn_no: 0,
          turn_started_at: now,
          started_at: now,
          updated_at: now,
        }
      : { updated_at: now };
  const { data } = await supabaseAdmin
    .from("mp_rooms")
    .update(patch)
    .eq("id", row.id)
    .select(COLUMNS)
    .single();
  return toState((data ?? row) as RoomRow);
}

export async function quickMatch(
  wallet: string,
  gameSlug: string,
  maxPlayers: number,
  settings: Record<string, string | number | boolean>,
): Promise<RoomState> {
  const { data } = await supabaseAdmin
    .from("mp_rooms")
    .select(COLUMNS)
    .eq("game_slug", gameSlug)
    .eq("status", "waiting")
    .eq("kind", "quick")
    .neq("host_wallet", wallet)
    .order("created_at", { ascending: true })
    .limit(5);
  for (const row of (data ?? []) as RoomRow[]) {
    const seats = await seatCount(row.id);
    if (seats < row.max_players) return joinExisting(row, wallet);
  }
  return createRoom(wallet, gameSlug, "quick", maxPlayers, settings, null);
}

export async function joinByCode(wallet: string, gameSlug: string, code: string): Promise<RoomState> {
  const { data } = await supabaseAdmin
    .from("mp_rooms")
    .select(COLUMNS)
    .eq("game_slug", gameSlug)
    .eq("code", code.toUpperCase())
    .in("status", ["waiting"])
    .limit(1);
  const row = (data ?? [])[0] as RoomRow | undefined;
  if (!row) throw new Error("No open room with that code.");
  if (row.host_wallet === wallet) throw new Error("This is your own room.");
  return joinExisting(row, wallet);
}

export async function respondInvite(wallet: string, id: string, accept: boolean) {
  const row = await getRow(id);
  if (!row || row.status !== "invited") throw new Error("That challenge is no longer available.");
  const now = new Date().toISOString();
  if (!accept) {
    await supabaseAdmin.from("mp_rooms").update({ status: "finished", updated_at: now }).eq("id", id);
    return null;
  }
  await abandonAll(wallet, row.game_slug);
  await addPlayer(id, wallet, 1, "joined");
  const { data } = await supabaseAdmin
    .from("mp_rooms")
    .update({
      status: "playing",
      turn_wallet: row.host_wallet,
      turn_no: 0,
      turn_started_at: now,
      started_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  return toState((data ?? row) as RoomRow);
}

/** Host kicks off a lobby that waits for several players (hexaman). */
export async function startRoom(wallet: string, id: string, durationMs: number) {
  const row = await getRow(id);
  if (!row || row.host_wallet !== wallet) throw new Error("Only the host can start the round.");
  if (row.status !== "waiting") return toState(row);
  const now = Date.now();
  const { data } = await supabaseAdmin
    .from("mp_rooms")
    .update({
      status: "playing",
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + durationMs).toISOString(),
      turn_started_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  await supabaseAdmin
    .from("mp_room_players")
    .update({ status: "playing", updated_at: new Date(now).toISOString() })
    .eq("room_id", id)
    .neq("status", "left");
  return toState((data ?? row) as RoomRow);
}

async function nextWallet(roomId: string, current: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("mp_room_players")
    .select("wallet, seat, status")
    .eq("room_id", roomId)
    .neq("status", "left")
    .order("seat", { ascending: true });
  const list = (data ?? []) as Array<{ wallet: string }>;
  if (list.length === 0) return null;
  const i = list.findIndex((p) => p.wallet === current);
  return list[(i + 1) % list.length]?.wallet ?? null;
}

export async function submitMove(
  wallet: string,
  id: string,
  turnNo: number,
  kind: string,
  payload: Record<string, number | string | boolean | null>,
) {
  const row = await getRow(id);
  if (!row || row.status !== "playing") throw new Error("The match is not running.");
  // Carrom keeps the turn locally (a valid pocket shoots again), so those
  // rooms only rely on the move sequence number.
  const freeTurn = (row.settings as { freeTurn?: boolean } | null)?.freeTurn === true;
  if (!freeTurn && row.turn_wallet !== wallet) throw new Error("It is not your turn.");
  if (row.turn_no !== turnNo) throw new Error("That turn already happened.");
  const { error } = await supabaseAdmin
    .from("mp_moves")
    .insert({ room_id: id, turn_no: turnNo, wallet, kind, payload });
  if (error) throw new Error("That turn already happened.");
  const other = (await nextWallet(id, wallet)) ?? wallet;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("mp_rooms")
    .update({ turn_no: turnNo + 1, turn_wallet: other, turn_started_at: now, updated_at: now })
    .eq("id", id);
  return { ok: true };
}

export async function skipTurn(id: string, turnNo: number) {
  const row = await getRow(id);
  if (!row || row.status !== "playing") return { ok: false };
  if (row.turn_no !== turnNo || !row.turn_wallet) return { ok: false };
  if (Date.now() - new Date(row.turn_started_at).getTime() < TURN_TIMEOUT_MS) return { ok: false };
  const { error } = await supabaseAdmin
    .from("mp_moves")
    .insert({ room_id: id, turn_no: turnNo, wallet: row.turn_wallet, kind: "skip", payload: {} });
  if (error) return { ok: false };
  const other = (await nextWallet(id, row.turn_wallet)) ?? row.turn_wallet;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("mp_rooms")
    .update({ turn_no: turnNo + 1, turn_wallet: other, turn_started_at: now, updated_at: now })
    .eq("id", id);
  return { ok: true };
}

export async function pushTick(
  wallet: string,
  id: string,
  tick: { x: number; y: number; dir: number; score: number; alive: boolean },
) {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("mp_ticks")
    .upsert({ room_id: id, wallet, ...tick, updated_at: now }, { onConflict: "room_id,wallet" });
  await supabaseAdmin
    .from("mp_room_players")
    .update({
      score: tick.score,
      status: tick.alive ? "playing" : "out",
      updated_at: now,
    })
    .eq("room_id", id)
    .eq("wallet", wallet)
    .neq("status", "left");
  return { ok: true };
}

export async function saveStats(
  wallet: string,
  id: string,
  score: number,
  stats: Record<string, number>,
) {
  await supabaseAdmin
    .from("mp_room_players")
    .update({ score, stats, updated_at: new Date().toISOString() })
    .eq("room_id", id)
    .eq("wallet", wallet);
  return { ok: true };
}

export async function finishRoom(wallet: string, id: string, winner: string | null) {
  const row = await getRow(id);
  if (!row) return { ok: false };
  await supabaseAdmin
    .from("mp_rooms")
    .update({
      status: "finished",
      winner_wallet: winner,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return { ok: true, by: wallet };
}

/* ---------------------------------------------------------------- */
/* Matchmaking queue                                                  */
/* ---------------------------------------------------------------- */

import { QUEUE_WAIT_CAP_MS, type QueueState } from "./types";

type QueueRow = {
  id: string;
  wallet: string;
  game_slug: string;
  max_players: number;
  rank_hint: number;
  settings: unknown;
  room_id: string | null;
  joined_at: string;
};

const QUEUE_COLUMNS = "id, wallet, game_slug, max_players, rank_hint, settings, room_id, joined_at";
const STALE_MS = 90_000;

/** Leaderboard value for this game, used as a rough skill hint. */
async function rankHint(wallet: string, gameSlug: string) {
  const { data } = await supabaseAdmin
    .from("scores")
    .select("value")
    .eq("wallet", wallet)
    .eq("game_slug", gameSlug)
    .maybeSingle();
  return Math.round(Number((data as { value?: number } | null)?.value ?? 0));
}

async function clearStale(gameSlug: string) {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  await supabaseAdmin
    .from("mp_queue")
    .delete()
    .eq("game_slug", gameSlug)
    .is("room_id", null)
    .lt("heartbeat_at", cutoff);
}

export async function joinQueue(
  wallet: string,
  gameSlug: string,
  maxPlayers: number,
  settings: Record<string, string | number | boolean>,
) {
  await clearStale(gameSlug);
  const now = new Date().toISOString();
  await supabaseAdmin.from("mp_queue").upsert(
    {
      game_slug: gameSlug,
      wallet,
      max_players: maxPlayers,
      settings,
      rank_hint: await rankHint(wallet, gameSlug),
      room_id: null,
      joined_at: now,
      heartbeat_at: now,
    },
    { onConflict: "game_slug,wallet" },
  );
  return { ok: true };
}

export async function leaveQueue(wallet: string, gameSlug: string) {
  const { data } = await supabaseAdmin
    .from("mp_queue")
    .select("id, room_id")
    .eq("game_slug", gameSlug)
    .eq("wallet", wallet)
    .maybeSingle();
  await supabaseAdmin.from("mp_queue").delete().eq("game_slug", gameSlug).eq("wallet", wallet);
  const row = data as { room_id: string | null } | null;
  return { ok: true, wasWaiting: Boolean(row) && !row?.room_id };
}

/**
 * Heartbeat + pairing step.
 * The player who has waited longest creates the room; the other one picks it
 * up on its next poll, so a pair never ends up in two different rooms.
 */
export async function pollQueue(wallet: string, gameSlug: string): Promise<QueueState> {
  await clearStale(gameSlug);
  const now = Date.now();

  const { data: mineRow } = await supabaseAdmin
    .from("mp_queue")
    .select(QUEUE_COLUMNS)
    .eq("game_slug", gameSlug)
    .eq("wallet", wallet)
    .maybeSingle();
  const mine = mineRow as QueueRow | null;
  if (!mine) return { waiting: false, waitedMs: 0, queueSize: 0, room: null, suggestCpu: false };

  // Someone already paired us up.
  if (mine.room_id) {
    const room = await getRoom(mine.room_id);
    await leaveQueue(wallet, gameSlug);
    return { waiting: false, waitedMs: 0, queueSize: 0, room, suggestCpu: false };
  }

  await supabaseAdmin
    .from("mp_queue")
    .update({ heartbeat_at: new Date().toISOString() })
    .eq("id", mine.id);

  const waitedMs = now - new Date(mine.joined_at).getTime();

  const { data: others } = await supabaseAdmin
    .from("mp_queue")
    .select(QUEUE_COLUMNS)
    .eq("game_slug", gameSlug)
    .is("room_id", null)
    .neq("wallet", wallet)
    .eq("max_players", mine.max_players)
    .order("joined_at", { ascending: true })
    .limit(20);
  const pool = (others ?? []) as QueueRow[];

  // Rank window widens every 10 seconds and disappears after the wait cap.
  const steps = Math.floor(waitedMs / 10_000);
  const window = waitedMs >= QUEUE_WAIT_CAP_MS ? Infinity : 500 * (steps + 1);
  const candidate = pool.find((row) => Math.abs(row.rank_hint - mine.rank_hint) <= window);

  if (!candidate) {
    return {
      waiting: true,
      waitedMs,
      queueSize: pool.length + 1,
      room: null,
      suggestCpu: waitedMs >= QUEUE_WAIT_CAP_MS,
    };
  }

  const candidateWaited = now - new Date(candidate.joined_at).getTime();
  const iCreate = candidateWaited < waitedMs || (candidateWaited === waitedMs && wallet < candidate.wallet);
  if (!iCreate) {
    return {
      waiting: true,
      waitedMs,
      queueSize: pool.length + 1,
      room: null,
      suggestCpu: waitedMs >= QUEUE_WAIT_CAP_MS,
    };
  }

  const settings = (mine.settings as Record<string, string | number | boolean>) ?? {};
  const created = await createRoom(wallet, gameSlug, "quick", mine.max_players, settings, null);
  const row = await getRow(created.id);
  const room = row ? await joinExisting(row, candidate.wallet) : created;
  await supabaseAdmin.from("mp_queue").update({ room_id: room.id }).eq("id", candidate.id);
  await leaveQueue(wallet, gameSlug);
  return { waiting: false, waitedMs, queueSize: 0, room, suggestCpu: false };
}
