import { useChat } from "@ai-sdk/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ChatCredits } from "@/components/ChatCredits";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useCredits } from "@/hooks/useCredits";
import { totalChatsLeft } from "@/lib/credits";
import { getCharacter } from "@/lib/characters";

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

function ChatRoom() {
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
      }),
    [character.id],
  );

  const greeting = useMemo<UIMessage[]>(
    () => [
      {
        id: `${character.id}-greeting`,
        role: "assistant",
        parts: [{ type: "text", text: character.greeting }],
      },
    ],
    [character.id, character.greeting],
  );

  const { messages, sendMessage, status } = useChat({
    id: character.id,
    messages: greeting,
    transport,
    onError: (err) => {
      const m = err.message;
      if (m.includes("402")) {
        setError("You are out of chat messages. Buy a pack or claim the daily reward.");
      } else if (m.includes("401") || m.includes("403")) {
        setError("The valley gate key was refused. Please check the chat service key.");
      } else if (m.includes("429")) {
        setError("The valley is out of ink for now. Please try again in a moment.");
      } else {
        setError("The connection to the valley flickered. Please try again.");
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
                This conversation is not saved; it fades when you leave the room.
              </p>
            </div>

            {messages.map((message) => {
              const text = messageText(message);
              if (!text) return null;
              return (
                <div
                  key={message.id}
                  className={`message-in max-w-[82%] whitespace-pre-wrap rounded-[18px] px-4 py-3 text-sm leading-relaxed ${
                    message.role === "assistant"
                      ? "self-start rounded-bl-md bg-parchment ring-1 ring-ink/5"
                      : "self-end rounded-br-md bg-ember text-primary-foreground"
                  }`}
                >
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
