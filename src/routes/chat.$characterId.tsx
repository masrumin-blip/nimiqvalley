import { useChat } from "@ai-sdk/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ChatCredits } from "@/components/ChatCredits";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAiHistory } from "@/lib/ai-chat.functions";
import { useCredits } from "@/hooks/useCredits";
import { totalChatsLeft } from "@/lib/credits";
import { getCharacter } from "@/lib/characters";
import { PLAYER_TOKEN_HEADER, readPlayerToken } from "@/lib/player-token";

export const Route = createFileRoute("/chat/$characterId")({
  loader: ({ params }) => {
    const character = getCharacter(params.characterId);
    if (!character) throw notFound();
    return character;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Chat with ${loaderData.name} — Nimiq Valley` : "Story Room — Nimiq Valley" },
      {
        name: "description",
        content: loaderData
          ? `Talk with ${loaderData.name}, a character of Nimiq Valley, in a live AI conversation.`
          : "Conversations with Nimiq Valley characters.",
      },
      { property: "og:title", content: loaderData ? `${loaderData.name} — Nimiq Valley` : "Story Room — Nimiq Valley" },
      {
        property: "og:description",
        content: loaderData
          ? `Talk with ${loaderData.name}, a character of Nimiq Valley, in a live AI conversation.`
          : "Conversations with Nimiq Valley characters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatRoom,
});

function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function reasoningText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "reasoning" ? part.text : ""))
    .join("")
    .trim();
}

function ChatRoom() {
  const character = Route.useLoaderData();
  const historyQuery = useQuery({
    queryKey: ["ai-history", character.id],
    queryFn: () => fetchAiHistory({ data: { characterId: character.id } }),
    staleTime: Infinity,
  });

  if (historyQuery.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-parchment text-sm text-ink/50">
        Opening the story room…
      </main>
    );
  }

  return <ChatRoomBody history={historyQuery.data ?? []} />;
}

function ChatRoomBody({ history }: { history: { id: string; role: "user" | "assistant"; text: string }[] }) {
  const character = Route.useLoaderData();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { credits } = useCredits();
  const left = totalChatsLeft(credits);


  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { characterId: character.id },
        // Nimiq Pay's WebView drops cookies, so the session travels as a token.
        headers: () => {
          const token = readPlayerToken();
          return token ? { [PLAYER_TOKEN_HEADER]: token } : {};
        },
      }),
    [character.id],
  );

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (history.length > 0) {
      return history.map((row) => ({
        id: row.id,
        role: row.role,
        parts: [{ type: "text", text: row.text }],
      }));
    }
    return [
      {
        id: `${character.id}-greeting`,
        role: "assistant",
        parts: [{ type: "text", text: character.greeting }],
      },
    ];
  }, [character.id, character.greeting, history]);

  const { messages, sendMessage, status } = useChat({
    id: character.id,
    messages: initialMessages,
    transport,
    onError: (err) => {
      const m = err.message;
      if (m.includes("402") || m.toLowerCase().includes("credit")) {
        setError("You are out of chat messages. Buy a pack or claim the daily reward.");
      } else if (m.toLowerCase().includes("sign in") || m.includes("401")) {
        setError("Your session expired. Go back and sign in with your wallet again.");
      } else if (m.includes("403")) {
        setError(m || "Lovable AI is currently unavailable for this workspace.");
      } else if (m.includes("429")) {
        setError("The valley is out of ink for now. Please try again in a moment.");
      } else {
        setError(m || "The connection to Lovable AI flickered. Please try again.");
      }
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isBusy]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isBusy) return;
    if (left <= 0) {
      setError("You are out of chat messages. Buy a pack or claim the daily reward.");
      return;
    }
    setError(null);
    setDraft("");
    void sendMessage({ text });
  }

  const lastMessage = messages[messages.length - 1];
  const waiting = isBusy && (!lastMessage || lastMessage.role !== "assistant" || messageText(lastMessage) === "");

  return (
    <main className="min-h-screen bg-parchment p-3 text-ink sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-5xl overflow-hidden rounded-[26px] bg-card ring-1 ring-ink/5 sm:min-h-[calc(100vh-3rem)] sm:grid-cols-[18rem_1fr]">
        <aside className="relative hidden overflow-hidden sm:block">
          <img src={character.image} alt={character.name} className="absolute inset-0 size-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-parchment">
            <p className="font-mono text-[10px] uppercase opacity-70">{character.role}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold">{character.name}</h1>
            <p className="mt-2 text-xs leading-relaxed opacity-80">{character.trait}</p>
          </div>
        </aside>

        <section className="flex min-h-[calc(100vh-1.5rem)] flex-col sm:min-h-0">
          <header className="flex items-center gap-3 border-b border-line/70 px-4 py-3 sm:px-5">
            <Button asChild aria-label="Back" className="size-10 shrink-0 rounded-full bg-sand text-ink">
              <Link to="/chat">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <img src={character.image} alt="" className="size-11 rounded-full object-cover object-top ring-1 ring-ink/10 sm:hidden" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg font-semibold sm:hidden">{character.name}</h1>
              <p className="font-mono text-[9px] uppercase text-ember">{character.role}</p>
            </div>
            <ChatCredits />
          </header>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-7 sm:py-8" aria-live="polite">
            <div className="mx-auto mb-2 max-w-sm text-center">
              <p className="font-display text-2xl font-semibold">Story room</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/45">
                This conversation is saved to your wallet, so you can pick it up any time.
              </p>
            </div>

            {messages.map((message) => {
              const text = messageText(message);
              const reasoning = reasoningText(message);
              if (!text && !reasoning) return null;
              return (
                <div
                  key={message.id}
                  className={`message-in max-w-[82%] whitespace-pre-wrap rounded-[18px] px-4 py-3 text-sm leading-relaxed ${
                    message.role === "assistant"
                      ? "self-start rounded-bl-md bg-parchment ring-1 ring-ink/5"
                      : "self-end rounded-br-md bg-ember text-primary-foreground"
                  }`}
                >
                  {message.role === "assistant" && reasoning && (
                    <details className="mb-2 text-xs text-ink/50">
                      <summary className="cursor-pointer font-mono uppercase">Thinking</summary>
                      <p className="mt-1 whitespace-pre-wrap">{reasoning}</p>
                    </details>
                  )}
                  {text}
                </div>
              );
            })}

            {waiting && (
              <div className="message-in flex items-center gap-1.5 self-start rounded-[18px] rounded-bl-md bg-parchment px-4 py-3 ring-1 ring-ink/5">
                <span className="sr-only">{character.name} is writing</span>
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="size-2 animate-bounce rounded-full bg-ink/30"
                    style={{ animationDelay: `${dot * 0.15}s` }}
                  />
                ))}
              </div>
            )}

            {error && <p className="self-center text-center text-xs text-destructive">{error}</p>}

            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="m-3 flex items-center gap-2 rounded-full bg-parchment py-1.5 pl-4 pr-1.5 ring-1 ring-ink/10 sm:m-5"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Message"
              placeholder={isBusy ? `${character.name} is writing…` : "Write your message…"}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/40"
            />
            <Button
              type="submit"
              aria-label="Send message"
              disabled={isBusy || draft.trim() === ""}
              className="size-10 shrink-0 rounded-full bg-ember text-primary-foreground disabled:opacity-50"
            >
              <ArrowUp className="size-4" />
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
