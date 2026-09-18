import { useState } from "react";
import { CAR_COLORS } from "@/games/race/lib/colors";
import { useGame } from "@/games/race/store/game";
import { makeRoomCode, normalizeRoomCode, setRoomInUrl } from "@/games/race/lib/room";
import { CarPreview } from "./CarPreview";
import { Button } from "@/components/ui/button";

export function Menu() {
  const {
    name,
    colorId,
    laps,
    difficulty,
    setName,
    setColor,
    setLaps,
    setDifficulty,
    startSingle,
    openLobby,
  } = useGame();
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  const createRoom = () => {
    const code = makeRoomCode();
    setRoomInUrl(code);
    openLobby(code);
  };

  const joinRoom = () => {
    const code = normalizeRoomCode(joinCode);
    if (code.length < 4) return;
    setRoomInUrl(code);
    openLobby(code);
  };

  return (
    <main className="min-h-dvh bg-sky px-4 pb-10 pt-6">
      <div className="mx-auto w-full max-w-md">
        <header className="border-l-4 border-primary pl-4 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            Low-Poly Racing Series
          </p>
          <h1 className="mt-1 text-5xl font-extrabold leading-none text-foreground">
            Nimiq <span className="text-primary">Car Race</span>
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Choose your machine, set the distance, and chase the perfect line.
          </p>
        </header>

        <section className="racing-panel mt-5 rounded-md p-4 backdrop-blur">
          <CarPreview />

          <label className="mt-4 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Driver name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-1 w-full rounded-md border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-primary"
          />

          <p className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Car color
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {CAR_COLORS.map((c) => (
              <Button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                aria-label={c.name}
                aria-pressed={colorId === c.id}
                className={`h-11 rounded-sm border-2 transition-transform active:scale-95 ${
                  colorId === c.id
                    ? "border-foreground scale-105"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c.body }}
              />
            ))}
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Rival level · Solo
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                { id: "santai", label: "Rookie" },
                { id: "normal", label: "Normal" },
                { id: "pro", label: "Pro" },
              ] as const
            ).map((d) => (
              <Button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id)}
                className={`rounded-sm border py-2.5 font-display text-base uppercase transition ${
                  difficulty === d.id
                    ? "border-foreground bg-primary text-primary-foreground shadow-pop"
                    : "border-border bg-background text-foreground"
                }`}
              >
                {d.label}
              </Button>
            ))}
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Race distance
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <Button
                key={n}
                type="button"
                onClick={() => setLaps(n)}
                className={`rounded-sm border py-2.5 font-display text-lg transition ${
                  laps === n
                    ? "border-foreground bg-primary text-primary-foreground shadow-pop"
                    : "border-border bg-background text-foreground"
                }`}
              >
                {n} <span className="text-xs">lap{n > 1 ? "s" : ""}</span>
              </Button>
            ))}
          </div>
        </section>

        <div className="mt-5 space-y-3">
          <Button
            type="button"
            onClick={startSingle}
            className="w-full rounded-sm bg-primary py-4 font-display text-xl uppercase text-primary-foreground shadow-pop transition active:translate-y-1 active:shadow-none"
          >
            Start Solo Race
          </Button>

          <Button
            type="button"
            onClick={createRoom}
            className="w-full rounded-sm bg-secondary py-4 font-display text-xl uppercase text-secondary-foreground shadow-pop transition active:translate-y-1 active:shadow-none"
          >
            Create Local Room
          </Button>

          {!showJoin ? (
            <Button
              type="button"
              onClick={() => setShowJoin(true)}
              className="w-full rounded-sm border border-border bg-card/80 py-3 text-base font-bold uppercase text-foreground"
            >
              Join with room code
            </Button>
          ) : (
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
              placeholder="CODE"
                maxLength={4}
                className="w-full rounded-sm border border-border bg-background px-4 py-3 text-center font-display text-2xl tracking-[0.4em] outline-none focus:border-primary"
              />
              <Button
                type="button"
                onClick={joinRoom}
                className="shrink-0 rounded-sm bg-accent px-5 font-display text-lg uppercase text-accent-foreground shadow-pop"
              >
                Join
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-foreground/60">
          Controls: WASD or arrow keys · Space to drift
        </p>
      </div>
    </main>
  );
}
