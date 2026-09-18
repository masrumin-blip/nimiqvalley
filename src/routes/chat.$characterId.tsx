import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCharacter } from "@/lib/characters";

type ChatMessage = { id: number; side: "character" | "visitor"; text: string };

export const Route = createFileRoute("/chat/$characterId")({
  loader: ({ params }) => { const character = getCharacter(params.characterId); if (!character) throw notFound(); return character; },
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData ? `Chat with ${loaderData.name} — Nimiq Valley` : "Story Room — Nimiq Valley" },
    { name: "description", content: loaderData ? `A local demo conversation with ${loaderData.name}.` : "Conversations with Nimiq Valley characters." },
    { property: "og:title", content: loaderData ? `${loaderData.name} — Nimiq Valley` : "Story Room — Nimiq Valley" },
    { property: "og:description", content: loaderData ? `A local demo conversation with ${loaderData.name}.` : "Conversations with Nimiq Valley characters." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ChatRoom,
});

function ChatRoom() {
  const character = Route.useLoaderData();
  const [draft, setDraft] = useState("");
  const [replyIndex, setReplyIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 1, side: "character", text: character.greeting }]);

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const nextReply = character.replies[replyIndex % character.replies.length] ?? character.greeting;
    setMessages((current) => [...current, { id: Date.now(), side: "visitor", text }, { id: Date.now() + 1, side: "character", text: nextReply }]);
    setReplyIndex((current) => current + 1);
    setDraft("");
  }

  return (
    <main className="min-h-screen bg-parchment p-3 text-ink sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-5xl overflow-hidden rounded-[26px] bg-card ring-1 ring-ink/5 sm:min-h-[calc(100vh-3rem)] sm:grid-cols-[18rem_1fr]">
        <aside className="relative hidden overflow-hidden sm:block"><img src={character.image} alt={character.name} className="absolute inset-0 size-full object-cover object-top"/><div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent"/><div className="absolute inset-x-0 bottom-0 p-6 text-parchment"><p className="font-mono text-[10px] uppercase opacity-70">{character.role}</p><h1 className="mt-1 font-display text-3xl font-semibold">{character.name}</h1><p className="mt-2 text-xs leading-relaxed opacity-80">{character.trait}</p></div></aside>
        <section className="flex min-h-[calc(100vh-1.5rem)] flex-col sm:min-h-0">
          <header className="flex items-center gap-3 border-b border-line/70 px-4 py-3 sm:px-5">
            <Button asChild aria-label="Back" className="size-10 shrink-0 rounded-full bg-sand text-ink"><Link to="/chat"><ArrowLeft className="size-4"/></Link></Button>
            <img src={character.image} alt="" className="size-11 rounded-full object-cover object-top ring-1 ring-ink/10 sm:hidden"/>
            <div className="min-w-0"><h1 className="truncate font-display text-lg font-semibold sm:hidden">{character.name}</h1><p className="font-mono text-[9px] uppercase text-ember">{character.role} · local demo</p></div>
          </header>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-7 sm:py-8" aria-live="polite">
            <div className="mx-auto mb-2 max-w-sm text-center"><p className="font-display text-2xl font-semibold">Story room</p><p className="mt-1 text-xs leading-relaxed text-ink/45">This conversation runs only in your browser and is not saved.</p></div>
            {messages.map((message) => <div key={message.id} className={`message-in max-w-[82%] rounded-[18px] px-4 py-3 text-sm leading-relaxed ${message.side === "character" ? "self-start rounded-bl-md bg-parchment ring-1 ring-ink/5" : "self-end rounded-br-md bg-ember text-primary-foreground"}`}>{message.text}</div>)}
          </div>
          <form onSubmit={sendMessage} className="m-3 flex items-center gap-2 rounded-full bg-parchment py-1.5 pl-4 pr-1.5 ring-1 ring-ink/10 sm:m-5">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Message" placeholder="Write your message…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/40"/>
            <Button type="submit" aria-label="Send message" className="size-10 shrink-0 rounded-full bg-ember text-primary-foreground"><ArrowUp className="size-4"/></Button>
          </form>
          <p className="pb-3 text-center font-mono text-[8px] uppercase text-ink/35">backend and credentials not included</p>
        </section>
      </div>
    </main>
  );
}
