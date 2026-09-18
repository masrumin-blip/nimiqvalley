import { createFileRoute, Link } from "@tanstack/react-router";
import { CHARACTERS } from "@/lib/characters";

const title = "AI Chat — Nimiq Valley Companions";
const description = "Meet five residents of Nimiq Valley and enter their story rooms.";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatHome,
});

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-full bg-ember-soft/40 ring-1 ring-ink/10">
        <span className="font-display text-lg italic">N</span>
      </div>
      <p className="font-display text-[17px] font-semibold">Nimiq Valley</p>
    </div>
  );
}

function ChatHome() {
  return (
    <main className="min-h-screen bg-parchment text-ink antialiased">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-8 pt-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Brand />
          <Link
            to="/"
            className="rounded-full bg-sand/70 px-3 py-1 font-mono text-[9px] uppercase text-ink/60 transition hover:bg-sand"
          >
            Main menu
          </Link>
        </header>
        <section className="story-rise pb-5 pt-8 sm:pb-7 sm:pt-12">
          <p className="mb-2 font-mono text-[10px] uppercase text-ember">Choose a companion</p>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <h1 className="max-w-2xl text-balance font-display text-[38px] font-semibold leading-[1.02] sm:text-6xl">
              Who would you like to meet today?
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-ink/60 sm:text-right">
              Five souls from one valley, each with a different perspective and story.
            </p>
          </div>
        </section>
        <section className="grid gap-3 pb-7 sm:gap-4">
          {CHARACTERS.map((character, index) => (
            <Link
              key={character.id}
              to="/chat/$characterId"
              params={{ characterId: character.id }}
              className="story-pop group grid grid-cols-[88px_1fr_auto] items-center gap-4 rounded-[20px] bg-card p-2.5 ring-1 ring-ink/5 transition-transform hover:-translate-y-0.5 sm:grid-cols-[112px_1fr_auto] sm:p-3"
              style={{ animationDelay: `${60 + index * 60}ms` }}
            >
              <div className="aspect-square overflow-hidden rounded-2xl bg-sand ring-1 ring-inset ring-ink/5">
                <img
                  src={character.image}
                  alt={character.name}
                  className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-semibold sm:text-2xl">{character.name}</p>
                <p className="mt-1 truncate font-mono text-[9px] uppercase text-ink/45 sm:text-[10px]">
                  {character.role}
                </p>
              </div>
              <span aria-hidden="true" className="mr-2 text-xl text-ember transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          ))}
        </section>
        <p className="pt-6 text-center font-mono text-[9px] uppercase text-ink/35">
          local conversations · backend not connected
        </p>
      </div>
    </main>
  );
}
