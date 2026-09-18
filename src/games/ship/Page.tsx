import { useCallback, useEffect, useRef, useState } from "react";
import { Game, H, MAX_AMMO, W, type Hud, type PlayerColor } from "@/games/ship/game/engine";
import { Joystick } from "@/games/ship/components/Joystick";
import { Button } from "@/components/ui/button";


type Phase = "menu" | "playing" | "paused" | "over";

const HISCORE_KEY = "neon-rift-hiscore";
const PLAYER_COLOR_KEY = "neon-rift-player-color";
const PLAYER_COLORS: Array<{ value: PlayerColor; label: string; className: string }> = [
  { value: "yellow", label: "Yellow", className: "bg-[#ffd84d]" },
  { value: "orange", label: "Orange", className: "bg-[#ff922b]" },
  { value: "magenta", label: "Magenta", className: "bg-[#ff4db8]" },
  { value: "lime", label: "Lime", className: "bg-[#8dff63]" },
];

/** Keep a narrow safe edge while allowing the square arena to fill the stage. */
const CAMERA_ZOOM = 0.98;

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [hud, setHud] = useState<Hud>({
    hp: 120,
    maxHp: 120,
    score: 0,
    wave: 0,
    enemies: 0,
    ammo: MAX_AMMO,
    maxAmmo: MAX_AMMO,
    rapid: 0,
    shield: 0,
    double: 0,
    doublePermanent: false,
    wavesToBoss: 3,
    bossActive: false,
    bossHp: 0,
    bossName: "",
  });
  const [hiscore, setHiscore] = useState(0);
  const [playerColor, setPlayerColor] = useState<PlayerColor>("yellow");
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const saved = Number(localStorage.getItem(HISCORE_KEY) ?? 0);
    if (!Number.isNaN(saved)) setHiscore(saved);
    const savedColor = localStorage.getItem(PLAYER_COLOR_KEY);
    if (PLAYER_COLORS.some(({ value }) => value === savedColor)) {
      setPlayerColor(savedColor as PlayerColor);
    }
  }, []);

  // Fit the whole arena inside the play area (above the control bar),
  // pulled back a bit so the camera sits farther away.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setScale(Math.min(r.width / W, r.height / H) * CAMERA_ZOOM);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("orientationchange", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", fit);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const game = new Game(ctx);
    const savedColor = localStorage.getItem(PLAYER_COLOR_KEY);
    if (PLAYER_COLORS.some(({ value }) => value === savedColor)) {
      game.setPlayerColor(savedColor as PlayerColor);
    }
    gameRef.current = game;
    game.onHud = setHud;
    game.onOver = (score) => {
      setPhase("over");
      setHiscore((prev) => {
        const next = Math.max(prev, score);
        localStorage.setItem(HISCORE_KEY, String(next));
        return next;
      });
    };

    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      game.keys.add(k);
      if (k === " " || k.startsWith("arrow")) e.preventDefault();
      if (k === "escape" || k === "p") {
        if (game.running && !game.over) {
          game.paused = !game.paused;
          setPhase(game.paused ? "paused" : "playing");
        }
      }
    };
    const up = (e: KeyboardEvent) => game.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      game.stop();
    };
  }, []);

  const startGame = useCallback(() => {
    gameRef.current?.setPlayerColor(playerColor);
    gameRef.current?.start();
    setPhase("playing");
  }, [playerColor]);

  const choosePlayerColor = (color: PlayerColor) => {
    setPlayerColor(color);
    gameRef.current?.setPlayerColor(color);
    localStorage.setItem(PLAYER_COLOR_KEY, color);
  };

  const onMove = useCallback((x: number, y: number) => {
    const g = gameRef.current;
    if (g) g.move = { x, y };
  }, []);
  const onShoot = useCallback((x: number, y: number) => {
    const g = gameRef.current;
    if (g) g.shoot = { x, y };
  }, []);

  // mouse aim / fire on desktop
  const pointerAim = (
    e: React.PointerEvent<HTMLCanvasElement>,
    firing: boolean,
  ) => {
    const g = gameRef.current;
    const canvas = canvasRef.current;
    if (!g || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const cx = (e.clientX - r.left) / scale;
    const cy = (e.clientY - r.top) / scale;
    const ax = cx - g.playerX;
    const ay = cy - g.playerY;
    const len = Math.hypot(ax, ay) || 1;
    g.shoot = {
      x: (ax / len) * (firing ? 1 : 0.5),
      y: (ay / len) * (firing ? 1 : 0.5),
    };
    g.shooting = firing;
  };

  const togglePause = () => {
    const g = gameRef.current;
    if (!g || !g.running || g.over) return;
    g.paused = !g.paused;
    setPhase(g.paused ? "paused" : "playing");
  };

  const inGame = phase === "playing" || phase === "paused";

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-[#04060f] select-none">
      <h1 className="sr-only">nimiqspcship — 2D top-down shooter vs CPU</h1>

      {/* Play area — controls never sit on top of it */}
      <div
        ref={stageRef}
        className="relative mx-auto h-[min(100vw,calc(100dvh-136px))] w-[min(100vw,calc(100dvh-136px))] shrink-0"
      >
        <div
          className="absolute left-1/2 top-1/2 shrink-0 grow-0"
          style={{
            width: W,
            height: H,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block h-full w-full touch-none"
            onPointerDown={(e) => {
              if (e.pointerType === "mouse") pointerAim(e, true);
            }}
            onPointerMove={(e) => {
              if (e.pointerType === "mouse") pointerAim(e, e.buttons === 1);
            }}
            onPointerUp={(e) => {
              if (e.pointerType === "mouse") pointerAim(e, false);
            }}
          />
        </div>

      </div>

      {/* Control bar — its own row below the arena */}
      {inGame && (
        <div className="z-10 flex w-full shrink-0 items-center justify-between border-t border-[color:var(--neon-cyan)]/20 bg-black/60 px-6 pb-4 pt-3">
          <div className="flex flex-col items-center gap-1">
            <Joystick
              rot={0}
              size={63}
              label="Move"
              accent="cyan"
              onChange={onMove}
            />
            <span className="font-mono text-[9px] tracking-[0.3em] text-[color:var(--neon-cyan)]/70">
              MOVE
            </span>
          </div>

          <Button
            variant="ghost"
            onClick={togglePause}
            className="rounded-full border border-[color:var(--neon-cyan)]/50 bg-black/35 px-3 py-1.5 font-mono text-[9px] tracking-[0.3em] text-[color:var(--neon-cyan)] backdrop-blur-[2px] active:bg-[color:var(--neon-cyan)]/15"
          >
            {phase === "paused" ? "RESUME" : "PAUSE"}
          </Button>

          <div className="flex flex-col items-center gap-1">
            <Joystick
              rot={0}
              size={63}
              label="Fire"
              accent="magenta"
              onChange={onShoot}
            />
            <span className="font-mono text-[9px] tracking-[0.3em] text-[color:var(--neon-magenta)]/70">
              FIRE
            </span>
          </div>
        </div>
      )}

      {/* Game status lives in the open area below the controls. */}
      {inGame && (
        <aside
          aria-label="Game status"
          className="pointer-events-none z-10 mx-auto mt-2 grid w-[220px] shrink-0 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] border border-[color:var(--ship-hud-border)] bg-[color:var(--ship-hud-panel)] px-2.5 py-2 font-mono text-[color:var(--neon-cyan)] shadow-[var(--ship-hud-shadow)] backdrop-blur-sm"
        >
          <section className="border-r border-[color:var(--ship-hud-border)] pr-2.5">
            <div className="flex items-center justify-between gap-1 text-[6px] tracking-[0.16em] text-[color:var(--neon-yellow-bright)]">
              <span>HULL</span>
              <span>{Math.max(0, Math.ceil(hud.hp))}</span>
            </div>
            <div className="mt-1 h-1.5 w-full border border-[color:var(--neon-yellow-bright)]/70 bg-[color:var(--ship-meter-empty)] shadow-[var(--ship-meter-frame-shadow)]">
              <div
                className="h-full bg-[color:var(--neon-yellow-bright)] shadow-[var(--ship-meter-glow)] transition-[width] duration-150"
                style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-1 text-[6px] tracking-[0.16em] text-[color:var(--neon-yellow-bright)]">
              <span>RELOAD</span>
              <span>{hud.ammo}/{hud.maxAmmo}</span>
            </div>
            <div className="mt-1 grid grid-cols-5 gap-1" aria-label="Reload charge">
              {Array.from({ length: hud.maxAmmo }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 skew-x-[-18deg] ${
                    i < hud.ammo
                      ? "bg-[color:var(--neon-yellow-bright)] shadow-[var(--ship-meter-glow)]"
                      : "bg-[color:var(--ship-meter-empty)]"
                  }`}
                />
              ))}
            </div>
            <div className="mt-1.5 border-t border-[color:var(--ship-hud-border)] pt-1.5 text-[5px] leading-tight tracking-[0.1em]">
              {hud.bossActive ? (
                <div className="font-bold text-[color:var(--ship-danger)]">{hud.bossName}</div>
              ) : (
                <div className="text-[color:var(--ship-warning)]">
                  BOSS IN {hud.wavesToBoss} WAVE{hud.wavesToBoss === 1 ? "" : "S"}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1 text-[5px] tracking-[0.08em]">
                {hud.rapid > 0 && (
                  <span className="border border-[color:var(--neon-cyan)]/70 px-1 py-0.5">RAPID {Math.ceil(hud.rapid)}s</span>
                )}
                {hud.shield > 0 && (
                  <span className="border border-[color:var(--neon-yellow-bright)]/70 px-1 py-0.5 text-[color:var(--neon-yellow-bright)]">SHIELD {Math.ceil(hud.shield)}s</span>
                )}
                {hud.doublePermanent && (
                  <span className="border border-[color:var(--neon-magenta)]/70 px-1 py-0.5 text-[color:var(--neon-magenta)]">DOUBLE ∞</span>
                )}
              </div>
            </div>
          </section>

          <section className="grid content-start grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 pl-2.5 text-[6px] tracking-[0.12em]">
            <span className="opacity-65">WAVE</span>
            <strong className="text-right text-[9px]">{hud.wave}</strong>
            <span className="opacity-65">ENEMIES</span>
            <strong className="text-right text-[9px]">{hud.enemies}</strong>
            <span className="opacity-65">SCORE</span>
            <strong className="text-right text-[9px] text-[color:var(--neon-magenta)]">{hud.score}</strong>
            <span className="opacity-65">BEST</span>
            <strong className="text-right text-[8px]">{hiscore}</strong>
          </section>
        </aside>
      )}

      {/* Menu / pause / game over overlays */}
      {phase !== "playing" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/75 px-10 text-center font-mono text-[color:var(--neon-cyan)] backdrop-blur-[2px]">
          {phase === "menu" && (
            <>
              <p className="text-[11px] tracking-[0.6em] opacity-70">
                TOP-DOWN SHOOTER
              </p>
              <h2
                className="text-4xl font-black tracking-[0.12em] sm:text-6xl sm:tracking-[0.2em]"
                style={{ textShadow: "0 0 24px var(--neon-cyan)" }}
              >
                nimiqspcship
              </h2>
              <p className="max-w-md text-xs leading-relaxed opacity-80">
                Survive waves of CPU enemies. Left stick to move, right stick to
                fire — your shots are limited, make them count. On desktop: WASD
                and aim with the mouse.
              </p>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] tracking-[0.3em] opacity-70">SHIP COLOR</span>
                <div className="flex gap-3" role="group" aria-label="Player ship color">
                  {PLAYER_COLORS.map((color) => (
                    <Button
                      key={color.value}
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={color.label}
                      aria-pressed={playerColor === color.value}
                      onClick={() => choosePlayerColor(color.value)}
                      className={`h-8 w-8 rounded-full border-2 p-1 ${
                        playerColor === color.value
                          ? "border-[color:var(--neon-cyan)]"
                          : "border-transparent opacity-60"
                      }`}
                    >
                      <span className={`h-full w-full rounded-full ${color.className}`} />
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={startGame}
                className="mt-2 border-2 border-[color:var(--neon-magenta)] px-10 py-3 text-sm tracking-[0.35em] text-[color:var(--neon-magenta)] transition-colors hover:bg-[color:var(--neon-magenta)]/15 active:bg-[color:var(--neon-magenta)]/20"
                style={{ boxShadow: "0 0 30px rgba(255,0,170,0.25)" }}
              >
                START
              </Button>
              {hiscore > 0 && (
                <p className="text-[11px] opacity-70">HIGH SCORE {hiscore}</p>
              )}
            </>
          )}

          {phase === "paused" && (
            <>
              <h2 className="text-4xl font-black tracking-[0.3em]">PAUSED</h2>
              <div className="flex gap-3" role="group" aria-label="Player ship color">
                {PLAYER_COLORS.map((color) => (
                  <Button
                    key={color.value}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={color.label}
                    aria-pressed={playerColor === color.value}
                    onClick={() => choosePlayerColor(color.value)}
                    className={`h-8 w-8 rounded-full border-2 p-1 ${
                      playerColor === color.value
                        ? "border-[color:var(--neon-cyan)]"
                        : "border-transparent opacity-60"
                    }`}
                  >
                    <span className={`h-full w-full rounded-full ${color.className}`} />
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                onClick={togglePause}
                className="border-2 border-[color:var(--neon-cyan)] px-8 py-2 text-sm tracking-[0.3em]"
              >
                RESUME
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  gameRef.current?.stop();
                  setPhase("menu");
                }}
                className="border border-[color:var(--neon-cyan)]/40 px-7 py-2 text-xs tracking-[0.3em] opacity-75"
              >
                MENU
              </Button>
            </>
          )}

          {phase === "over" && (
            <>
              <h2
                className="text-5xl font-black tracking-[0.25em] text-[color:var(--neon-magenta)]"
                style={{ textShadow: "0 0 26px var(--neon-magenta)" }}
              >
                GAME OVER
              </h2>
              <p className="text-sm tracking-[0.2em]">
                SCORE {hud.score} · WAVE {hud.wave}
              </p>
              <p className="text-[11px] opacity-70">BEST {hiscore}</p>
              <div className="mt-2 flex gap-3">
                <Button
                  variant="ghost"
                  onClick={startGame}
                  className="border-2 border-[color:var(--neon-cyan)] px-8 py-2 text-sm tracking-[0.3em]"
                >
                  PLAY AGAIN
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    gameRef.current?.stop();
                    setPhase("menu");
                  }}
                  className="border border-[color:var(--neon-cyan)]/40 px-6 py-2 text-sm tracking-[0.3em] opacity-70"
                >
                  MENU
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}

export default Index;
