import { useState } from "react";
import { CAR_COLORS, colorById } from "@/games/race/lib/colors";
import { useGame } from "@/games/race/store/game";
import { playerId, useNet } from "@/games/race/net/NetContext";
import { setRoomInUrl } from "@/games/race/lib/room";
import { Button } from "@/components/ui/button";

export function Lobby() {
  const { roomCode, laps, setLaps, colorId, setColor, backToMenu, startRace } =
    useGame();
  const net = useNet();
  const [copied, setCopied] = useState(false);

  const roster = net?.roster ?? [];
  const isHost = net?.isHost ?? true;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const start = () => {
    net?.send("start", { laps });
    startRace(laps);
  };

  return (
    <main className="min-h-dvh bg-sky px-4 pb-10 pt-8">
      <div className="mx-auto w-full max-w-md">
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            setRoomInUrl(null);
            backToMenu();
          }}
          className="text-sm font-bold uppercase text-muted-foreground"
        >
          ← Back
        </Button>

        <h1 className="mt-3 text-4xl text-foreground">Race Lobby</h1>

        <div className="racing-panel mt-4 rounded-md p-4 text-center backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Room code
          </p>
          <p className="font-display text-5xl tracking-[0.3em] text-primary">
            {roomCode}
          </p>
          <Button
            type="button"
            onClick={copyLink}
            className="mt-3 rounded-sm bg-secondary px-5 py-2 text-sm font-bold uppercase text-secondary-foreground shadow-pop"
          >
            {copied ? "Room link copied" : "Copy room link"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Local room ready
          </p>
        </div>

        <section className="racing-panel mt-4 rounded-md p-4 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Drivers ({roster.length || 1})
          </p>
          <ul className="mt-2 space-y-2">
            {(roster.length
              ? roster
              : [{ id: playerId, name: "You", color: colorId }]
            ).map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-sm bg-background px-3 py-2"
              >
                <span
                  className="h-7 w-7 rounded-lg border-2 border-foreground/20"
                  style={{ backgroundColor: colorById(p.color).body }}
                />
                <span className="font-bold text-foreground">{p.name}</span>
                {p.id === playerId && (
                  <span className="text-xs text-muted-foreground">(you)</span>
                )}
                {i === 0 && (
                  <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    HOST
                  </span>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Change color
          </p>
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {CAR_COLORS.map((c) => (
              <Button
                key={c.id}
                type="button"
                aria-label={c.name}
                onClick={() => setColor(c.id)}
                className={`h-8 rounded-lg border-4 ${
                  colorId === c.id ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: c.body }}
              />
            ))}
          </div>
        </section>

        {isHost ? (
          <>
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-foreground/70">
              Race distance
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((n) => (
                <Button
                  key={n}
                  type="button"
                  onClick={() => setLaps(n)}
                    className={`rounded-sm border py-2.5 font-display text-lg ${
                    laps === n
                      ? "border-foreground bg-primary text-primary-foreground shadow-pop"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  {n}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              onClick={start}
              className="mt-4 w-full rounded-sm bg-primary py-4 font-display text-xl uppercase text-primary-foreground shadow-pop active:translate-y-1 active:shadow-none"
            >
              Start Race
            </Button>
          </>
        ) : (
          <p className="mt-6 animate-float text-center font-display text-lg text-foreground">
            Waiting for the host to start...
          </p>
        )}
      </div>
    </main>
  );
}
