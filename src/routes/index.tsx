import { createFileRoute, Link } from "@tanstack/react-router";
import { Gamepad2, Home, MessageCircle } from "lucide-react";

const title = "NimiqValley — Village, Games & AI Chat";
const description =
  "Enter Nimiq Village, play fifteen arcade games, or meet the NimiqValley AI chat characters.";

export const Route = createFileRoute("/")({
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
  component: MainMenu,
});

const menuItems = [
  {
    to: "/village",
    icon: Home,
    title: "Nimiq Village",
    copy: "Walk around the village, meet neighbours, and connect with Nimiq wallet tools.",
    action: "Enter village",
  },
  {
    to: "/games",
    icon: Gamepad2,
    title: "Game Hub",
    copy: "Fifteen Nimiq arcade games, from racing and runners to puzzles and shooters.",
    action: "Open hub",
  },
  {
    to: "/chat",
    icon: MessageCircle,
    title: "AI Chat",
    copy: "Meet five Nimiq Valley characters and step into their story rooms.",
    action: "Choose character",
  },
] as const;

function MainMenu() {
  return (
    <main className="min-h-[100svh] overflow-hidden bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col justify-center">
        <header className="max-w-3xl">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-primary">
            Welcome to
          </p>
          <h1 className="mt-3 font-display text-5xl font-black leading-none tracking-tight sm:text-7xl">
            NimiqValley
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            One valley with a village to explore, arcade games to play, and characters ready to chat.
          </p>
        </header>

        <section className="mt-9 grid gap-4 md:grid-cols-3">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group relative min-h-64 overflow-hidden rounded-md border border-border bg-card p-5 shadow-lg transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <item.icon className="size-9 text-primary" aria-hidden="true" strokeWidth={2.4} />
              <h2 className="mt-5 font-display text-3xl font-black leading-none text-card-foreground">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.copy}</p>
              <span className="absolute bottom-5 left-5 inline-flex items-center gap-1 font-display text-sm font-black uppercase text-primary transition-transform group-hover:translate-x-1">
                {item.action} <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
