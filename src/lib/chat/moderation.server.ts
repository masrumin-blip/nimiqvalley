import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PROFANITY = new Set([
  "anjing",
  "anjir",
  "anjrit",
  "bangsat",
  "bajingan",
  "babi",
  "bedebah",
  "brengsek",
  "goblok",
  "jancok",
  "jancuk",
  "kampret",
  "kontol",
  "lonte",
  "memek",
  "ngentot",
  "pelacur",
  "perek",
  "sange",
  "tai",
  "tolol",
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cunt",
  "dick",
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "nigger",
  "pussy",
  "shit",
  "slut",
  "whore",
]);

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  "$": "s",
};

function simplify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[0134578@$]/g, (character) => LEET_MAP[character] ?? character)
    .replace(/(.)\1{2,}/g, "$1$1");
}

export function normalizeChatText(value: string) {
  return simplify(value)
    .replace(/[^a-z0-9]/g, "")
    .replace(/(.)\1+/g, "$1");
}

export function containsProfanity(value: string) {
  const simplified = simplify(value);
  const words = simplified.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((word) => PROFANITY.has(word) || PROFANITY.has(word.replace(/(.)\1+/g, "$1")))) {
    return true;
  }

  const compact = simplified.replace(/[^a-z0-9]/g, "");
  return [...PROFANITY].some((word) => word.length >= 4 && compact.includes(word));
}

type ModerationResult = {
  allowed?: boolean;
  reason?: "muted" | "profanity" | "spam" | "duplicate";
  warningCount?: number;
  mutedUntil?: string | null;
};

function muteDuration(until?: string | null) {
  if (!until) return "temporarily";
  const remaining = Math.max(1, new Date(until).getTime() - Date.now());
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes >= 60) return `${Math.ceil(minutes / 60)} hour${minutes > 60 ? "s" : ""}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function moderationError(result: ModerationResult) {
  const duration = muteDuration(result.mutedUntil);
  if (result.reason === "muted") return `You are muted for ${duration}. Please try again later.`;
  if (result.reason === "spam") return `Too many messages. You are muted for ${duration}.`;
  if (result.reason === "duplicate") return `Repeated messages are not allowed. You are muted for ${duration}.`;
  if (result.warningCount === 1) {
    return "Message blocked for inappropriate language. Warning 1 of 3; another violation will mute you.";
  }
  if (result.warningCount === 2) {
    return `Message blocked for inappropriate language. Warning 2 of 3; you are muted for ${duration}.`;
  }
  return `Message blocked for repeated inappropriate language. You are muted for ${duration}.`;
}

export async function moderateMessage(wallet: string, text: string) {
  const { data, error } = await supabaseAdmin.rpc("moderate_chat_submission", {
    _wallet: wallet,
    _normalized_text: normalizeChatText(text),
    _is_profane: containsProfanity(text),
  });
  if (error) throw new Error("Could not check the message. Please try again.");

  const result = data as ModerationResult | null;
  if (!result?.allowed) throw new Error(moderationError(result ?? {}));
}