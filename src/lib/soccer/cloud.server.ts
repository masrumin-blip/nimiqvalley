/** Online soccer data access — runs on the server with the admin client. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { resolveNames } from "@/lib/chat/cloud.server";
import { TURN_TIMEOUT_MS, type MatchMove, type MatchState } from "./types";

type Row = {
  id: string;
  code: string | null;
  kind: string;
  status: string;
  host_wallet: string;
  guest_wallet: string | null;
  target_goals: number;
  turn_no: number;
  turn_wallet: string | null;
  turn_started_at: string;
  winner_wallet: string | null;
};

const COLUMNS =
  "id, code, kind, status, host_wallet, guest_wallet, target_goals, turn_no, turn_wallet, turn_started_at, winner_wallet";

async function toState(row: Row): Promise<MatchState> {
  const names = await resolveNames([row.host_wallet, row.guest_wallet ?? ""]);
  return {
    id: row.id,
    code: row.code,
    kind: (row.kind as MatchState["kind"]) ?? "quick",
    status: row.status as MatchState["status"],
    hostWallet: row.host_wallet,
    guestWallet: row.guest_wallet,
    hostName: names.get(row.host_wallet) ?? row.host_wallet,
    guestName: row.guest_wallet ? (names.get(row.guest_wallet) ?? row.guest_wallet) : null,
    targetGoals: row.target_goals,
    turnNo: row.turn_no,
    turnWallet: row.turn_wallet,
    turnStartedAt: row.turn_started_at,
    winnerWallet: row.winner_wallet,
  };
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function activeMatch(wallet: string): Promise<MatchState | null> {
  const { data } = await supabaseAdmin
    .from("soccer_matches")
    .select(COLUMNS)
    .in("status", ["waiting", "playing"])
    .or(`host_wallet.eq.${wallet},guest_wallet.eq.${wallet}`)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as Row | undefined;
  return row ? toState(row) : null;
}

export async function invitesFor(wallet: string): Promise<MatchState[]> {
  const { data } = await supabaseAdmin
    .from("soccer_matches")
    .select(COLUMNS)
    .eq("status", "invited")
    .eq("guest_wallet", wallet)
    .order("created_at", { ascending: false })
    .limit(10);
  return Promise.all(((data ?? []) as Row[]).map(toState));
}

export async function getMatchRow(id: string): Promise<Row | null> {
  const { data } = await supabaseAdmin.from("soccer_matches").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as Row | null) ?? null;
}

/** A player who stops polling for this long counts as gone. */
const PRESENCE_TIMEOUT_MS = 15_000;

type PresenceRow = Row & { host_seen_at: string; guest_seen_at: string };

/**
 * Closes a running match when one side disappears (exit button, closed tab,
 * lost signal) and hands the win to the player who stayed.
 */
async function dropAbsent(row: Row, viewer: string): Promise<Row> {
  if (row.status !== "playing" || !row.guest_wallet) return row;
  const now = new Date().toISOString();
  if (row.host_wallet === viewer) {
    await supabaseAdmin.from("soccer_matches").update({ host_seen_at: now }).eq("id", row.id);
  } else if (row.guest_wallet === viewer) {
    await supabaseAdmin.from("soccer_matches").update({ guest_seen_at: now }).eq("id", row.id);
  }
  const { data } = await supabaseAdmin
    .from("soccer_matches")
    .select("host_seen_at, guest_seen_at")
    .eq("id", row.id)
    .maybeSingle();
  const seen = (data as Pick<PresenceRow, "host_seen_at" | "guest_seen_at"> | null) ?? null;
  if (!seen) return row;
  const cutoff = Date.now() - PRESENCE_TIMEOUT_MS;
  const hostGone = new Date(seen.host_seen_at).getTime() < cutoff;
  const guestGone = new Date(seen.guest_seen_at).getTime() < cutoff;
  if (!hostGone && !guestGone) return row;
  const winner = hostGone && guestGone ? null : hostGone ? row.guest_wallet : row.host_wallet;
  const { data: updated } = await supabaseAdmin
    .from("soccer_matches")
    .update({ status: "finished", winner_wallet: winner, updated_at: now })
    .eq("id", row.id)
    .eq("status", "playing")
    .select(COLUMNS)
    .maybeSingle();
  return (updated as Row | null) ?? { ...row, status: "finished", winner_wallet: winner };
}

export async function getMatch(id: string, viewer?: string): Promise<MatchState | null> {
  const row = await getMatchRow(id);
  if (!row) return null;
  return toState(viewer ? await dropAbsent(row, viewer) : row);
}

export async function listMoves(id: string, since: number): Promise<MatchMove[]> {
  const { data } = await supabaseAdmin
    .from("soccer_moves")
    .select("turn_no, wallet, kind, piece, vx, vy")
    .eq("match_id", id)
    .gt("turn_no", since)
    .order("turn_no", { ascending: true });
  return (data ?? []).map((m) => ({
    turnNo: m.turn_no,
    wallet: m.wallet,
    kind: m.kind === "skip" ? "skip" : "shot",
    piece: m.piece,
    vx: m.vx,
    vy: m.vy,
  }));
}

/**
 * Leaves any lobby/match the player is still sitting in.
 * Returns the entry costs of matches this player opened that nobody ever joined.
 */
export async function abandonAll(wallet: string): Promise<Array<"key" | "room">> {
  const { data } = await supabaseAdmin
    .from("soccer_matches")
    .select("id, kind, status, host_wallet, guest_wallet, entry_cost")
    .in("status", ["waiting", "invited", "playing"])
    .or(`host_wallet.eq.${wallet},guest_wallet.eq.${wallet}`);
  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    host_wallet: string;
    guest_wallet: string | null;
    entry_cost: string | null;
  }>;
  if (rows.length === 0) return [];

  const refunds: Array<"key" | "room"> = [];
  for (const row of rows) {
    if (row.host_wallet !== wallet) continue;
    if (row.status === "playing") continue;
    if (row.guest_wallet && row.status !== "invited") continue;
    refunds.push(row.entry_cost === "room" ? "room" : "key");
  }

  await supabaseAdmin
    .from("soccer_matches")
    .update({ status: "finished", updated_at: new Date().toISOString() })
    .in(
      "id",
      rows.map((r) => r.id),
    );
  return refunds;
}

export async function createMatch(
  wallet: string,
  kind: MatchState["kind"],
  targetGoals: number,
  guest: string | null,
  entry: "key" | "room" = "key",
): Promise<MatchState> {
  await abandonAll(wallet);
  const { data, error } = await supabaseAdmin
    .from("soccer_matches")
    .insert({
      kind,
      code: kind === "room" ? randomCode() : null,
      host_wallet: wallet,
      guest_wallet: guest,
      status: guest && kind === "friend" ? "invited" : "waiting",
      target_goals: targetGoals,
      turn_wallet: wallet,
      entry_cost: entry,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error("Could not create the match.");
  return toState(data as Row);
}

async function startAsGuest(row: Row, wallet: string): Promise<MatchState> {
  const { data, error } = await supabaseAdmin
    .from("soccer_matches")
    .update({
      guest_wallet: wallet,
      status: "playing",
      turn_wallet: row.host_wallet,
      turn_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Both sides start "seen now", so the absence check has a fair baseline.
      host_seen_at: new Date().toISOString(),
      guest_seen_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .in("status", ["waiting", "invited"])
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error("That match is no longer available.");
  return toState(data as Row);
}

export async function quickMatch(wallet: string, targetGoals: number): Promise<MatchState> {
  const { data } = await supabaseAdmin
    .from("soccer_matches")
    .select(COLUMNS)
    .eq("status", "waiting")
    .eq("kind", "quick")
    .neq("host_wallet", wallet)
    .is("guest_wallet", null)
    .order("created_at", { ascending: true })
    .limit(1);
  const row = (data ?? [])[0] as Row | undefined;
  if (row) {
    await abandonAll(wallet);
    return startAsGuest(row, wallet);
  }
  return createMatch(wallet, "quick", targetGoals, null);
}

export async function joinRoom(wallet: string, code: string): Promise<MatchState> {
  // Look the code up without a status filter so every case gets its own message.
  const { data } = await supabaseAdmin
    .from("soccer_matches")
    .select(COLUMNS)
    .eq("code", code.trim().toUpperCase())
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as Row | undefined;
  if (!row) throw new Error("No room with that code.");
  if (row.host_wallet === wallet || row.guest_wallet === wallet) {
    // Rejoining a match you are already part of just returns it.
    if (row.status === "playing") return toState(row);
    if (row.host_wallet === wallet) throw new Error("This is your own room — wait for a rival.");
  }
  if (row.status === "finished") throw new Error("That room is already closed.");
  if (row.guest_wallet && row.guest_wallet !== wallet)
    throw new Error("That room is already full.");
  await abandonAll(wallet);
  return startAsGuest(row, wallet);
}

export async function respondInvite(wallet: string, id: string, accept: boolean) {
  const row = await getMatchRow(id);
  if (!row || row.guest_wallet !== wallet || row.status !== "invited")
    throw new Error("That challenge is no longer available.");
  if (!accept) {
    await supabaseAdmin
      .from("soccer_matches")
      .update({ status: "finished", updated_at: new Date().toISOString() })
      .eq("id", id);
    return null;
  }
  await abandonAll(wallet);
  return startAsGuest(row, wallet);
}

export async function submitMove(
  wallet: string,
  id: string,
  turnNo: number,
  piece: number,
  vx: number,
  vy: number,
) {
  const row = await getMatchRow(id);
  if (!row || row.status !== "playing") throw new Error("The match is not running.");
  if (row.turn_wallet !== wallet) throw new Error("It is not your turn.");
  if (row.turn_no !== turnNo) throw new Error("That turn already happened.");
  const other = row.host_wallet === wallet ? row.guest_wallet : row.host_wallet;
  const { error } = await supabaseAdmin
    .from("soccer_moves")
    .insert({ match_id: id, turn_no: turnNo, wallet, kind: "shot", piece, vx, vy });
  if (error) throw new Error("That turn already happened.");
  await supabaseAdmin
    .from("soccer_matches")
    .update({
      turn_no: turnNo + 1,
      turn_wallet: other,
      turn_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return { ok: true };
}

export async function skipTurn(wallet: string, id: string, turnNo: number) {
  const row = await getMatchRow(id);
  if (!row || row.status !== "playing") return { ok: false };
  // Only the two players of this match may move its clock forward.
  if (row.host_wallet !== wallet && row.guest_wallet !== wallet) return { ok: false };
  if (row.turn_no !== turnNo || !row.turn_wallet) return { ok: false };
  const elapsed = Date.now() - new Date(row.turn_started_at).getTime();
  if (elapsed < TURN_TIMEOUT_MS) return { ok: false };
  const other = row.host_wallet === row.turn_wallet ? row.guest_wallet : row.host_wallet;
  const { error } = await supabaseAdmin
    .from("soccer_moves")
    .insert({ match_id: id, turn_no: turnNo, wallet: row.turn_wallet, kind: "skip" });
  if (error) return { ok: false };
  await supabaseAdmin
    .from("soccer_matches")
    .update({
      turn_no: turnNo + 1,
      turn_wallet: other,
      turn_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return { ok: true };
}

export async function finishMatch(wallet: string, id: string, winnerWallet: string) {
  const row = await getMatchRow(id);
  if (!row) return { ok: false };
  if (row.host_wallet !== wallet && row.guest_wallet !== wallet) return { ok: false };
  // The winner has to be one of the two players, and the first report wins.
  if (winnerWallet !== row.host_wallet && winnerWallet !== row.guest_wallet) return { ok: false };
  if (row.status === "finished") return { ok: true };
  await supabaseAdmin
    .from("soccer_matches")
    .update({ status: "finished", winner_wallet: winnerWallet, updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "finished");
  return { ok: true };
}
