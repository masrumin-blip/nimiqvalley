/** Saved AI story-room conversations. One conversation per character, per wallet. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type StoredAiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

const HISTORY_LIMIT = 80;

export async function listAiMessages(
  wallet: string,
  characterId: string,
): Promise<StoredAiMessage[]> {
  const { data } = await supabaseAdmin
    .from("ai_chat_messages")
    .select("id, role, text, created_at")
    .eq("wallet", wallet)
    .eq("character_id", characterId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  return (data ?? [])
    .slice()
    .reverse()
    .map((row) => ({
      id: row.id,
      role: row.role === "assistant" ? "assistant" : "user",
      text: row.text,
      createdAt: row.created_at,
    }));
}

export async function saveAiMessage(
  wallet: string,
  characterId: string,
  role: "user" | "assistant",
  text: string,
) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const { error } = await supabaseAdmin.from("ai_chat_messages").insert({
    wallet,
    character_id: characterId,
    role,
    text: trimmed.slice(0, 4000),
  });
  if (error) console.error("[ai-chat] could not save message", error.message);
}

export async function clearAiMessages(wallet: string, characterId: string) {
  const { error } = await supabaseAdmin
    .from("ai_chat_messages")
    .delete()
    .eq("wallet", wallet)
    .eq("character_id", characterId);
  if (error) throw new Error("Could not clear this conversation");
  return { ok: true };
}
