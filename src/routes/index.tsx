import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Gamepad2, Home, MessageCircle, Sparkles } from "lucide-react";
import valleyBackground from "@/assets/nimiq-valley-menu-bg.jpg";
import { DailyRewardDialog } from "@/components/DailyRewardDialog";

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
    label: "Explore",
  },
  {
    to: "/games",
    icon: Gamepad2,
    title: "Game Hub",
    copy: "Fifteen Nimiq arcade games, from racing and runners to puzzles and shooters.",
    action: "Open hub",
    label: "Play",
  },
  {
    to: "/chat",
    icon: MessageCircle,
    title: "AI Chat",
    copy: "Meet five Nimiq Valley characters and step into their story rooms.",
    action: "Choose character",
    label: "Meet",
  },
] as const;

function MainMenu() {
  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-background px-3 py-5 text-foreground sm:px-6 sm:py-8">
      <img
        src={valleyBackground}
        alt=""
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover object-center"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-background/70" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-5xl flex-col justify-center sm:min-h-[calc(100svh-4rem)]">
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-md">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-primary sm:text-xs">
              Welcome to the valley
            </p>
          </div>
          <h1 className="mt-4 font-display text-5xl font-black leading-none tracking-normal text-foreground sm:text-7xl">
            Nimiq<span className="text-primary">Valley</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-relaxed text-foreground/75 sm:mt-4 sm:text-lg">
            One valley with a village to explore, arcade games to play, and characters ready to chat.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <DailyRewardDialog />
            <MatchPassPanel />
          </div>
        </header>

        <section className="mx-auto mt-6 grid w-full max-w-3xl grid-cols-2 gap-3 sm:mt-8 sm:gap-4">
          {menuItems.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              className={`group relative min-h-48 overflow-hidden rounded-md border border-border/80 bg-card/90 p-4 shadow-lg backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-56 sm:p-6 ${
                index === 2 ? "col-span-2 mx-auto w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)]" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-md border border-primary/25 bg-primary/10 sm:size-12">
                  <item.icon className="size-5 text-primary sm:size-6" aria-hidden="true" strokeWidth={2.4} />
                </span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:text-[10px]">
                  {item.label}
                </span>
              </div>
              <h2 className="mt-4 font-display text-xl font-black leading-tight tracking-normal text-card-foreground sm:mt-5 sm:text-3xl">
                {item.title}
              </h2>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground sm:mt-3 sm:line-clamp-3 sm:text-sm">
                {item.copy}
              </p>
              <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 font-display text-[11px] font-black uppercase text-primary sm:bottom-6 sm:left-6 sm:text-sm">
                {item.action}
                <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:size-4" aria-hidden="true" />
              </span>
              <span className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
