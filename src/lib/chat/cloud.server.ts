/** Arena chat data access — runs on the server with the admin client. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  CHAT_LIMITS,
  EMPTY_SOCIALS,
  dmKey,
  fallbackName,
  type ChatMessage,
  type DirectMessage,
  type DmThread,
  type FriendRequest,
  type Player,
  type Profile,
} from "./types";

const PRESENCE_TTL_MS = 60_000;

export async function resolveNames(wallets: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(wallets.filter(Boolean)));
  const names = new Map<string, string>();
  for (const wallet of unique) names.set(wallet, fallbackName(wallet));
  if (unique.length === 0) return names;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("wallet, display_name")
    .in("wallet", unique);
  for (const row of data ?? []) {
    if (row.display_name) names.set(row.wallet, row.display_name);
  }
  return names;
}

export async function nameOf(wallet: string) {
  return (await resolveNames([wallet])).get(wallet) ?? fallbackName(wallet);
}

export async function listMessages(): Promise<ChatMessage[]> {
  const { data } = await supabaseAdmin
    .from("chat_messages")
    .select("id, wallet, text, kind, created_at")
    .order("created_at", { ascending: false })
    .limit(CHAT_LIMITS.historySize);
  const rows = (data ?? []).slice().reverse();
  const names = await resolveNames(rows.map((r) => r.wallet));
  return rows.map((r) => ({
    id: r.id,
    wallet: r.wallet,
    name: names.get(r.wallet) ?? fallbackName(r.wallet),
    text: r.text,
    kind: r.kind === "system" ? "system" : "user",
    createdAt: r.created_at,
  }));
}

export async function appendMessage(wallet: string, text: string) {
  const { error } = await supabaseAdmin.from("chat_messages").insert({ wallet, text });
  if (error) throw new Error("Could not send the message");
  return { ok: true };
}

export async function touchPresence(wallet: string) {
  await supabaseAdmin
    .from("chat_presence")
    .upsert({ wallet, last_seen: new Date().toISOString() });
}

export async function onlineCount() {
  const since = new Date(Date.now() - PRESENCE_TTL_MS).toISOString();
  const { count } = await supabaseAdmin
    .from("chat_presence")
    .select("wallet", { count: "exact", head: true })
    .gte("last_seen", since);
  return count ?? 0;
}

export async function getProfile(wallet: string): Promise<Profile> {
  const [{ data }, name] = await Promise.all([
    supabaseAdmin.from("chat_profiles").select("*").eq("wallet", wallet).maybeSingle(),
    nameOf(wallet),
  ]);
  if (!data) {
    return {
      wallet,
      name,
      bio: "",
      socials: { ...EMPTY_SOCIALS },
      visibility: "public",
      dmPolicy: "everyone",
    };
  }
  return {
    wallet,
    name,
    bio: data.bio,
    socials: { twitter: data.twitter, instagram: data.instagram, discord: data.discord },
    visibility: data.visibility === "private" ? "private" : "public",
    dmPolicy: data.dm_policy === "friends" ? "friends" : "everyone",
  };
}

export async function saveProfile(input: {
  wallet: string;
  bio: string;
  twitter: string;
  instagram: string;
  discord: string;
  visibility: string;
  dmPolicy: string;
}) {
  const { error } = await supabaseAdmin.from("chat_profiles").upsert({
    wallet: input.wallet,
    bio: input.bio,
    twitter: input.twitter,
    instagram: input.instagram,
    discord: input.discord,
    visibility: input.visibility,
    dm_policy: input.dmPolicy,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Could not save the profile");
  return getProfile(input.wallet);
}

async function friendRows(wallet: string) {
  const { data } = await supabaseAdmin
    .from("chat_friends")
    .select("*")
    .or(`from_wallet.eq.${wallet},to_wallet.eq.${wallet}`)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listFriends(wallet: string): Promise<Player[]> {
  const rows = (await friendRows(wallet)).filter((r) => r.status === "accepted");
  const others = rows.map((r) => (r.from_wallet === wallet ? r.to_wallet : r.from_wallet));
  const names = await resolveNames(others);
  return others.map((w) => ({ wallet: w, name: names.get(w) ?? fallbackName(w) }));
}

export async function listRequests(wallet: string): Promise<FriendRequest[]> {
  const rows = await friendRows(wallet);
  const names = await resolveNames(rows.flatMap((r) => [r.from_wallet, r.to_wallet]));
  return rows.map((r) => ({
    id: r.id,
    from: r.from_wallet,
    to: r.to_wallet,
    fromName: names.get(r.from_wallet) ?? fallbackName(r.from_wallet),
    toName: names.get(r.to_wallet) ?? fallbackName(r.to_wallet),
    status: r.status === "accepted" ? "accepted" : "pending",
    createdAt: r.created_at,
  }));
}

export async function requestFriend(from: string, to: string) {
  const existing = (await friendRows(from)).find(
    (r) =>
      (r.from_wallet === from && r.to_wallet === to) ||
      (r.from_wallet === to && r.to_wallet === from),
  );
  if (existing) return { ok: true };
  const { error } = await supabaseAdmin
    .from("chat_friends")
    .insert({ from_wallet: from, to_wallet: to, status: "pending" });
  if (error) throw new Error("Could not send the friend request");
  return { ok: true };
}

export async function respondFriend(wallet: string, id: string, accept: boolean) {
  const { data } = await supabaseAdmin
    .from("chat_friends")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.to_wallet !== wallet) throw new Error("Request not found");
  if (accept) {
    await supabaseAdmin.from("chat_friends").update({ status: "accepted" }).eq("id", id);
  } else {
    await supabaseAdmin.from("chat_friends").delete().eq("id", id);
  }
  return { ok: true };
}

export async function listDm(a: string, b: string): Promise<DirectMessage[]> {
  const { data } = await supabaseAdmin
    .from("chat_dms")
    .select("id, from_wallet, to_wallet, text, created_at")
    .eq("pair_key", dmKey(a, b))
    .order("created_at", { ascending: false })
    .limit(CHAT_LIMITS.historySize);
  return (data ?? [])
    .slice()
    .reverse()
    .map((r) => ({
      id: r.id,
      from: r.from_wallet,
      to: r.to_wallet,
      text: r.text,
      createdAt: r.created_at,
    }));
}

export async function appendDm(from: string, to: string, text: string) {
  const { error } = await supabaseAdmin.from("chat_dms").insert({
    pair_key: dmKey(from, to),
    from_wallet: from,
    to_wallet: to,
    text,
  });
  if (error) throw new Error("Could not send the message");
  return { ok: true };
}

export async function listThreads(wallet: string): Promise<DmThread[]> {
  const { data } = await supabaseAdmin
    .from("chat_dms")
    .select("from_wallet, to_wallet, text, created_at")
    .or(`from_wallet.eq.${wallet},to_wallet.eq.${wallet}`)
    .order("created_at", { ascending: false })
    .limit(200);
  const seen = new Map<string, DmThread>();
  for (const row of data ?? []) {
    const other = row.from_wallet === wallet ? row.to_wallet : row.from_wallet;
    if (seen.has(other)) continue;
    seen.set(other, {
      wallet: other,
      name: fallbackName(other),
      lastText: row.text,
      lastAt: row.created_at,
    });
  }
  const names = await resolveNames([...seen.keys()]);
  return [...seen.values()].map((t) => ({ ...t, name: names.get(t.wallet) ?? t.name }));
}

/** Find a player by display name or wallet, for friend requests. */
export async function findPlayer(query: string): Promise<Player | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const byWallet = trimmed.toUpperCase();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("wallet, display_name")
    .or(`wallet.eq.${byWallet},display_name.ilike.${trimmed}`)
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return { wallet: row.wallet, name: row.display_name || fallbackName(row.wallet) };
}
