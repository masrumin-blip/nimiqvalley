import { useCallback, useEffect, useRef, useState } from "react";
import {
  BomberGame as Engine,
  H,
  POWER_LABEL,
  W,
  type Difficulty,
  type HudState,
  type Mode,
} from "./engine";
import { playSound, primeAudio, type SoundName } from "./sound";
import { Button } from "@/components/ui/button";



type Screen = "start" | "playing";

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const MODE_LABEL: Record<Mode, string> = {
  virus: "VS VIRUS",
  cpu: "VS 3 CPU",
  multi: "MULTIPLAYER",
};

interface Keymap {
  up: string;
  down: string;
  left: string;
  right: string;
  bomb: string;
  detonate: string;
}

const KEYMAPS: Keymap[] = [
  { up: "w", down: "s", left: "a", right: "d", bomb: " ", detonate: "x" },
  {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    bomb: "Enter",
    detonate: "-",
  },
  { up: "i", down: "k", left: "j", right: "l", bomb: "u", detonate: "o" },
  { up: "8", down: "5", left: "4", right: "6", bomb: "0", detonate: "9" },
];

const KEY_HINT = [
  "P1: WASD + Space",
  "P2: Arrows + Enter",
  "P3: IJKL + U",
  "P4: 8456 + 0",
];

const emptyHud: HudState = {
  mode: "virus",
  difficulty: "easy",
  status: "playing",
  winner: null,
  enemiesLeft: 0,
  best: 0,
  score: 0,
  lives: 3,
  bombers: [],
};

export default function BomberGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const rafRef = useRef<number | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef({ x: 0, y: 0 });
  const soundRef = useRef(true);
  const bestRef = useRef(0);

  const [screen, setScreen] = useState<Screen>("start");
  const [mode, setMode] = useState<Mode>("virus");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [playerCount, setPlayerCount] = useState(2);
  const [hud, setHud] = useState<HudState>(emptyHud);
  const [paused, setPaused] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [best, setBest] = useState(0);



  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("nimiq-bomber-best") ?? 0);
      if (!Number.isNaN(saved)) {
        setBest(saved);
        bestRef.current = saved;
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const onHud = useCallback((h: HudState) => {
    setHud(h);
    if (h.best > bestRef.current) {
      bestRef.current = h.best;
      setBest(h.best);
    }
  }, []);

  const sound = useCallback((name: SoundName) => {
    playSound(name, soundRef.current);
  }, []);

  const start = useCallback(
    (nextMode: Mode, diff: Difficulty, players: number) => {
      primeAudio();
      setMode(nextMode);
      setDifficulty(diff);
      setPlayerCount(players);
      keysRef.current.clear();
      touchRef.current = { x: 0, y: 0 };
      engineRef.current = new Engine({
        mode: nextMode,
        difficulty: diff,
        players,
        best: bestRef.current,
        onHud,
        sound,
      });
      setPaused(false);
      setConfirmExit(false);
      setScreen("playing");
    },
    [onHud, sound],
  );


  const humanCount = mode === "multi" ? playerCount : 1;
  const seatOf = (i: number) => i;

  const dropBomb = useCallback((seat: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    const b = eng.bombers[seat];
    if (!b || !b.alive) return;
    eng.placeBomb(seat);
  }, []);

  const triggerDetonate = useCallback((seat: number) => {
    engineRef.current?.detonate(seat);
  }, []);



  // Game loop
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const eng = engineRef.current;
      if (eng) {
        const keys = keysRef.current;
        for (let i = 0; i < humanCount; i++) {
          const map = KEYMAPS[i]!;
          let dx = 0;
          let dy = 0;
          if (keys.has(map.left)) dx = -1;
          else if (keys.has(map.right)) dx = 1;
          if (keys.has(map.up)) dy = -1;
          else if (keys.has(map.down)) dy = 1;
          if (i === 0) {
            if (dx === 0) dx = touchRef.current.x;
            if (dy === 0) dy = touchRef.current.y;
          }
          eng.setInput(seatOf(i), dx, dy);
        }
        eng.update(dt);
        eng.draw(ctx);
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [screen, humanCount]);

  // Keyboard
  useEffect(() => {
    if (screen !== "playing") return;
    const tracked = new Set<string>();
    for (let i = 0; i < humanCount; i++) {
      const m = KEYMAPS[i]!;
      [m.up, m.down, m.left, m.right, m.bomb, m.detonate].forEach((k) =>
        tracked.add(k),
      );
    }

    const down = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (tracked.has(k)) e.preventDefault();
      if (k === "p" || k === "Escape") {
        setPaused((p) => !p);
        return;
      }
      for (let i = 0; i < humanCount; i++) {
        const m = KEYMAPS[i]!;
        if (k === m.bomb) {
          dropBomb(seatOf(i));
          return;
        }
        if (k === m.detonate) {
          triggerDetonate(seatOf(i));
          return;
        }
      }
      keysRef.current.add(k);
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysRef.current.delete(k);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [screen, humanCount]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.paused = paused;
  }, [paused, hud.status]);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const press = (x: number, y: number) => {
    touchRef.current = { x, y };
  };
  const release = () => {
    touchRef.current = { x: 0, y: 0 };
  };

  const over = hud.status !== "playing";
  const me = hud.bombers[0];


  const resultTitle =
    hud.status === "won"
      ? mode === "virus"
        ? "YOU WIN!"
        : `${hud.winner ?? "P1"} WINS!`
      : hud.status === "draw"
        ? "DRAW"
        : mode === "cpu" || mode === "multi"
          ? `${hud.winner ?? "CPU"} WINS!`
          : "GAME OVER";

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col items-center gap-1">
      {screen === "playing" && (
        <div className="flex w-full max-w-[480px] shrink-0 items-center gap-1">
          <Hud hud={hud} best={best} mode={mode} difficulty={difficulty} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSoundOn((s) => !s)}
            className="h-7 w-7 shrink-0 border-arcade-frame bg-arcade-panel font-display text-[9px] text-arcade-highlight"
            aria-label={soundOn ? "Mute sound" : "Turn sound on"}
          >
            {soundOn ? "♪" : "×"}
          </Button>
          {!over && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                setPaused(true);
                setConfirmExit(true);
              }}
              className="h-7 w-7 shrink-0 border-arcade-frame bg-arcade-panel font-display text-[9px] text-arcade-danger"
              aria-label="Exit to menu"
            >
              ✕
            </Button>
          )}
        </div>
      )}

      {screen === "start" && (
        <StartMenu
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          playerCount={playerCount}
          setPlayerCount={setPlayerCount}
          onStart={(m, d, n) => start(m, d, n)}
        />
      )}


      {screen === "playing" && (
        <div className="flex min-h-0 w-full max-w-[480px] flex-1 items-center justify-center">
          <div className="relative flex max-h-full items-center justify-center overflow-hidden rounded-lg border-2 border-arcade-frame bg-arcade-panel shadow-arcade">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="block max-h-full w-auto max-w-full object-contain"
              style={{ imageRendering: "pixelated", aspectRatio: `${W} / ${H}` }}
              aria-label="Nimiq-Bomber game board"
            />
            {confirmExit && !over && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-arcade-overlay px-4 backdrop-blur-[2px]">
                <strong className="font-display text-lg text-arcade-highlight">
                  EXIT TO MENU?
                </strong>
                <span className="text-[10px] text-arcade-muted">
                  Current game progress will be lost.
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setConfirmExit(false);
                      setPaused(false);
                      setScreen("start");
                    }}
                    variant="outline"
                    className="border-2 border-arcade-danger bg-arcade-panel font-display text-[9px] text-arcade-danger"
                  >
                    YES
                  </Button>

                  <Button
                    onClick={() => {
                      setConfirmExit(false);
                      setPaused(false);
                    }}
                    variant="outline"
                    className="border-2 border-arcade-highlight bg-arcade-panel font-display text-[9px] text-arcade-highlight"
                  >
                    NO
                  </Button>
                </div>
              </div>
            )}
            {over && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-arcade-overlay px-4 backdrop-blur-[2px]">
                <strong
                  className={`font-display text-2xl ${
                    hud.status === "won"
                      ? "text-arcade-highlight"
                      : "text-arcade-danger"
                  }`}
                >
                  {resultTitle}
                </strong>
                <span className="text-xs text-arcade-muted">
                  Score {me?.score ?? 0} · Best {best}
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => start(mode, difficulty, playerCount)}
                    variant="outline"
                    className="border-2 border-arcade-highlight bg-arcade-panel font-display text-[9px] text-arcade-highlight"
                  >
                    PLAY AGAIN
                  </Button>

                  <Button
                    onClick={() => setScreen("start")}
                    variant="outline"
                    className="border-arcade-muted bg-arcade-panel font-display text-[9px] text-arcade-muted"
                  >
                    MENU
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {screen === "playing" && paused && !over && !confirmExit && (
        <div className="flex h-12 w-full max-w-[480px] shrink-0 items-center justify-center gap-3 border border-arcade-frame bg-arcade-panel px-2">
          <strong className="font-display text-sm text-arcade-highlight">
            PAUSED
          </strong>
          <Button
            onClick={() => setPaused(false)}
            variant="outline"
            className="h-8 border-2 border-arcade-highlight bg-arcade-panel font-display text-[9px] text-arcade-highlight"
          >
            RESUME
          </Button>
        </div>
      )}


      {screen === "playing" && !over && !paused && (
        <div className="flex h-[150px] w-full max-w-[480px] shrink-0 select-none items-center justify-between px-2 md:hidden">
          <div className="grid grid-cols-3 grid-rows-3 gap-1 opacity-90">
            <span />
            <PadButton label="▲" onDown={() => press(0, -1)} onUp={release} />
            <span />
            <PadButton label="◀" onDown={() => press(-1, 0)} onUp={release} />
            <span />
            <PadButton label="▶" onDown={() => press(1, 0)} onUp={release} />
            <span />
            <PadButton label="▼" onDown={() => press(0, 1)} onUp={release} />
            <span />
          </div>
          <div className="flex items-center gap-2 opacity-90">
            {me?.remote && (
              <ActionButton
                label="X"
                onPress={() => triggerDetonate(seatOf(0))}
              />
            )}
            <ActionButton
              label="BOMB"
              onPress={() => dropBomb(seatOf(0))}
              primary
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StartMenu({
  difficulty,
  setDifficulty,
  playerCount,
  setPlayerCount,
  onStart,
}: {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  playerCount: number;
  setPlayerCount: (n: number) => void;
  onStart: (mode: Mode, difficulty: Difficulty, players: number) => void;
}) {

  return (
    <div className="flex w-full max-w-[480px] flex-col items-center gap-3 overflow-y-auto border-2 border-arcade-frame bg-arcade-panel px-3 py-3 shadow-arcade">
      <h2 className="font-display text-xl tracking-widest text-arcade-highlight">
        NIMIQ-BOMBER
      </h2>

      <div className="flex w-full flex-col gap-1">
        <span className="font-display text-[9px] text-arcade-muted">
          DIFFICULTY
        </span>
        <div className="flex justify-center gap-2">
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <Button
              key={d}
              onClick={() => setDifficulty(d)}
              variant="outline"
              className={`flex-1 border-2 bg-arcade-panel font-display text-[10px] ${
                difficulty === d
                  ? "border-arcade-highlight text-arcade-highlight"
                  : "border-arcade-frame text-arcade-muted"
              }`}
            >
              {DIFF_LABEL[d]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        <Button
          onClick={() => onStart("virus", difficulty, 1)}
          variant="outline"
          className="w-full border-2 border-arcade-highlight bg-arcade-panel py-5 font-display text-xs text-arcade-highlight transition-transform active:scale-95"
        >
          {MODE_LABEL.virus}
        </Button>
        <p className="-mt-1 text-center text-[9px] text-arcade-muted">
          Wipe out every virus with your bombs.
        </p>

        <Button
          onClick={() => onStart("cpu", difficulty, 1)}
          variant="outline"
          className="w-full border-2 border-arcade-highlight bg-arcade-panel py-5 font-display text-xs text-arcade-highlight transition-transform active:scale-95"
        >
          {MODE_LABEL.cpu}
        </Button>
        <p className="-mt-1 flex items-center justify-center gap-2 text-center text-[9px] text-arcade-muted">
          Battle 3 CPU bombers
          <span className="inline-flex gap-1">
            {["#4aa8ff", "#ff5d8f", "#5ddb8b"].map((c) => (
              <span
                key={c}
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: c }}
              />
            ))}
          </span>
        </p>

        <div className="mt-1 flex flex-col gap-1 border-t border-arcade-frame pt-2">
          <span className="font-display text-[9px] text-arcade-muted">
            {MODE_LABEL.multi} — PLAYERS
          </span>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <Button
                key={n}
                onClick={() => setPlayerCount(n)}
                variant="outline"
                className={`flex-1 border-2 bg-arcade-panel font-display text-[10px] ${
                  playerCount === n
                    ? "border-arcade-highlight text-arcade-highlight"
                    : "border-arcade-frame text-arcade-muted"
                }`}
              >
                {n}P
              </Button>
            ))}
          </div>
          <Button
            onClick={() => onStart("multi", difficulty, playerCount)}
            variant="outline"
            className="w-full border-2 border-arcade-danger bg-arcade-danger/15 py-5 font-display text-xs text-arcade-danger transition-transform active:scale-95"
          >
            START {playerCount}P BATTLE
          </Button>
          <p className="text-center text-[8px] leading-relaxed text-arcade-muted">
            {KEY_HINT.slice(0, playerCount).join(" · ")}
          </p>
        </div>

      </div>

      <p className="text-center text-[9px] text-arcade-muted">
        Space drops a bomb · X detonates · P pauses
      </p>
    </div>
  );
}

function PadButton({
  label,
  onDown,
  onUp,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-[52px] w-[52px] border-2 border-arcade-frame bg-arcade-panel font-display text-base text-arcade-highlight active:bg-arcade-frame"
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      aria-label={label}
    >
      {label}
    </Button>
  );
}

function ActionButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className={`h-[62px] w-[62px] rounded-full border-2 bg-arcade-panel font-display text-[10px] active:scale-95 ${
        primary
          ? "border-arcade-danger bg-arcade-danger/20 text-arcade-danger"
          : "border-arcade-highlight text-arcade-highlight"
      }`}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
    >
      {label}
    </Button>
  );
}

function Hud({
  hud,
  best,
  mode,
  difficulty,
}: {
  hud: HudState;
  best: number;
  mode: Mode;
  difficulty: Difficulty;
}) {
  const me = hud.bombers[0];
  return (
    <div className="grid min-h-7 min-w-0 flex-1 grid-cols-4 items-center gap-1 rounded-md border border-arcade-frame bg-arcade-panel px-1.5 py-0.5 font-display text-[7px] text-arcade-highlight sm:text-[9px]">
      <span>SCORE {me?.score ?? 0}</span>
      <span>BEST {best}</span>
      <span>{DIFF_LABEL[difficulty]}</span>
      <span>
        {mode === "virus" ? `FOES ${hud.enemiesLeft}` : `ALIVE ${hud.bombers.filter((b) => b.alive).length}`}
      </span>
      <span className="col-span-4 flex flex-wrap items-center gap-x-2 text-arcade-muted">
        {mode === "virus" ? (
          <span>
            LIVES{" "}
            <span className="text-arcade-danger">
              {"*".repeat(Math.max(0, me?.lives ?? 0)) || "-"}
            </span>
          </span>
        ) : (
          hud.bombers.map((b) => (
            <span
              key={b.id}
              className={b.alive ? "" : "line-through opacity-50"}
              style={{ color: b.color }}
            >
              {b.name}
            </span>
          ))
        )}
        <span>FIRE x{me?.range ?? 1}</span>
        <span>BOMB x{me?.maxBombs ?? 1}</span>
        <span>SPD x{(me?.speedLevel ?? 0) + 1}</span>
        {me?.glove && (
          <span className="text-arcade-highlight">
            {POWER_LABEL.glove.toUpperCase()}
          </span>
        )}
        {me?.remote && <span className="text-arcade-highlight">REMOTE</span>}
        {me?.vest && <span className="text-arcade-highlight">VEST</span>}
      </span>
    </div>
  );
}
