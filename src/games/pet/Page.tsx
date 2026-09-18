import { useState } from "react";
import { Bath, BedDouble, Coins, Gamepad2, Home, RotateCcw, ShoppingBag, UtensilsCrossed, Volume2, VolumeX } from "lucide-react";
import { Pet } from "@/games/pet/components/pet/Pet";
import { StatBars } from "@/games/pet/components/game/StatBars";
import { Kitchen } from "@/games/pet/components/rooms/Kitchen";
import { Bathroom } from "@/games/pet/components/rooms/Bathroom";
import { Bedroom } from "@/games/pet/components/rooms/Bedroom";
import { Arcade } from "@/games/pet/components/rooms/Arcade";
import { Shop } from "@/games/pet/components/rooms/Shop";
import { GameProvider, useGame } from "@/games/pet/game/store";
import { sfx } from "@/games/pet/game/audio";
import { cn } from "@/lib/utils";


type RoomId = "home" | "kitchen" | "bathroom" | "bedroom" | "arcade" | "shop";

const ROOMS: { id: RoomId; label: string; icon: typeof Home; bg: string }[] = [
  { id: "home", label: "Home", icon: Home, bg: "var(--bg-home)" },
  { id: "kitchen", label: "Kitchen", icon: UtensilsCrossed, bg: "var(--bg-kitchen)" },
  { id: "bathroom", label: "Bath", icon: Bath, bg: "var(--bg-bathroom)" },
  { id: "bedroom", label: "Bedroom", icon: BedDouble, bg: "var(--bg-bedroom)" },
  { id: "arcade", label: "Arcade", icon: Gamepad2, bg: "var(--bg-arcade)" },
  { id: "shop", label: "Shop", icon: ShoppingBag, bg: "var(--bg-shop)" },
];

function LivingRoom() {
  const { state, mood, bump, flash } = useGame();
  const messages: Record<string, string> = {
    hungry: "My tummy is rumbling… 🍎",
    dirty: "I feel all sticky! 🛁",
    sleepy: "So… sleepy… 💤",
    sad: "I could use some attention 🥺",
    neutral: "Hi there! What shall we do?",
    happy: "I'm having the best day! 💚",
    sleeping: "Zzz…",
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden">
      <p className="mb-1 rounded-3xl border border-border/60 bg-card/90 px-3 py-1.5 text-center text-xs font-semibold shadow-sm sm:text-sm">
        {messages[mood] ?? "Hi there! What shall we do?"}
      </p>
      <div className="relative min-h-0 w-full flex-1">
        <div className="absolute inset-x-4 bottom-2 h-14 rounded-[2rem] bg-[var(--room-rug)] sm:h-20" />
        <div className="flex h-full items-end justify-center pb-4">
          <Pet
            mood={mood}
            hat={state.hat}
            glasses={state.glasses}
            dirt={state.dirt}
            onTap={() => {
              sfx.giggle();
              bump({ fun: 1.5 });
              if (Math.random() < 0.2) flash("Hehe, that tickles! 😄");
            }}
            className="relative z-10 aspect-square h-full max-h-72 w-auto"
          />
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
        Tap your pet to pet it — it boosts fun.
      </p>
    </div>
  );
}

function GameShell() {
  const { state, toggleMute, reset, flashText } = useGame();
  const [room, setRoom] = useState<RoomId>("home");
  const active = ROOMS.find((r) => r.id === room)!;

  return (
    <main
      className="h-full w-full overflow-hidden px-2 pb-2 pt-2 transition-colors duration-500 sm:px-6 sm:pb-4"
      style={{ background: active.bg }}
    >
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
        <header className="mb-2 flex items-center gap-2 pl-10">
          <h1 className="truncate font-display text-xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {state.name}
          </h1>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 shadow-sm sm:text-sm">
            <Coins className="size-4" /> {state.coins}
          </span>
          <button
            onClick={toggleMute}
            aria-label={state.muted ? "Turn sound on" : "Turn sound off"}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card shadow-sm transition hover:bg-accent sm:size-9"
          >
            {state.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button
            onClick={() => {
              if (window.confirm("Start over with a brand new pet?")) reset();
            }}
            aria-label="Start over"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card shadow-sm transition hover:bg-accent sm:size-9"
          >
            <RotateCcw className="size-4" />
          </button>
        </header>

        <StatBars className="mb-2" />

        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-white/50 bg-white/25 p-2.5 shadow-lg backdrop-blur-sm sm:rounded-[2rem] sm:p-3">
          {flashText && (
            <div
              className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background shadow-lg"
              style={{ animation: "flash-pop 0.3s ease-out" }}
            >
              {flashText}
            </div>
          )}
          {room === "home" && <LivingRoom />}
          {room === "kitchen" && <Kitchen />}
          {room === "bathroom" && <Bathroom />}
          {room === "bedroom" && <Bedroom />}
          {room === "arcade" && <Arcade />}
          {room === "shop" && <Shop />}
        </section>

        <nav className="mt-2 grid shrink-0 grid-cols-6 gap-1 rounded-3xl border border-border/60 bg-card/90 p-1.5 shadow-lg backdrop-blur sm:gap-1.5 sm:p-2">
          {ROOMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setRoom(id);
                sfx.pop();
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition sm:text-xs",
                room === id
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}

export default function PetPage() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}
