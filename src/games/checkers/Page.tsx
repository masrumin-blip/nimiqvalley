import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Board } from "@/games/checkers/components/Board";
import { Controls } from "@/games/checkers/components/Controls";
import { Menu } from "@/games/checkers/components/Menu";
import { MatchResultDialog, type ResultRow } from "@/components/MatchResultDialog";
import { OnlinePanel } from "@/games/_shared/online/OnlinePanel";
import { useOnlineRoom } from "@/games/_shared/online/useOnlineRoom";
import { TURN_TIMEOUT_MS } from "@/lib/mp/types";
import { playSfx } from "@/lib/sfx";
import { NEON_COLORS, OPPONENT_COLORS, type NeonColor } from "@/games/checkers/components/Piece";
import { chooseMove, type Difficulty } from "@/games/checkers/lib/ai";
import {
  advanceDrawState,
  applyMove,
  boardKey,
  countPieces,
  createBoard,
  drawCountdown,
  getOutcome,
  initialDrawState,
  legalMoves,
  type Board as BoardModel,
  type DrawState,
  type Move,
  type Outcome,
  type Player,
} from "@/games/checkers/lib/engine";

const FRAME_W = 778;
const FRAME_H = 972;

function useFrameScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const update = () => {
      const s = Math.min(1, window.innerWidth / FRAME_W, window.innerHeight / FRAME_H);
      setScale(s);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

function CheckersGame() {
  const scale = useFrameScale();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"cpu" | "online">("cpu");
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [playerColor, setPlayerColor] = useState<NeonColor>("yellow");
  const [cpuColor, setCpuColor] = useState<NeonColor>("blue");
  const [board, setBoard] = useState<BoardModel>(() => createBoard());
  const [turn, setTurn] = useState<Player>("y");
  const [selected, setSelected] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [drawState, setDrawState] = useState<DrawState>(() => initialDrawState());
  const [repetitions, setRepetitions] = useState<Map<string, number>>(
    () => new Map([[boardKey(createBoard(), "y"), 1]]),
  );
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [thinking, setThinking] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [moveCounts, setMoveCounts] = useState({ y: 0, b: 0 });
  const [clock, setClock] = useState(TURN_TIMEOUT_MS);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const online = useOnlineRoom({ gameSlug: "checkers", active: mode === "online", maxPlayers: 2 });
  const room = online.room;
  const isOnline = mode === "online" && Boolean(room);
  const mySide: Player = isOnline && !online.isHost ? "b" : "y";
  const oppSide: Player = mySide === "y" ? "b" : "y";

  const outcome: Outcome = useMemo(
    () => getOutcome(board, turn, drawState, repetitions),
    [board, turn, drawState, repetitions],
  );

  const countdown = useMemo(
    () => (outcome === "playing" ? drawCountdown(drawState) : null),
    [drawState, outcome],
  );

  const humanMoves = useMemo(
    () => (turn === mySide && outcome === "playing" ? legalMoves(board, mySide) : []),
    [board, turn, outcome, mySide],
  );

  const movable = useMemo(() => new Set(humanMoves.map((m) => m.from)), [humanMoves]);
  const targets = useMemo(
    () => (selected === null ? [] : humanMoves.filter((m) => m.from === selected)),
    [humanMoves, selected],
  );

  const play = useCallback((current: BoardModel, move: Move) => {
    const next = applyMove(current, move);
    const mover = current[move.from]?.player === "y" ? "y" : "b";
    const nextTurn: Player = mover === "y" ? "b" : "y";
    if (move.captures.length > 0) playSfx("collision", 0.5);
    else playSfx("move", 0.5);
    if (move.crowned) playSfx("powerup", 0.6);
    setBoard(next);
    setLastMove(move);
    setSelected(null);
    setMoveCounts((prev) => ({ ...prev, [mover]: prev[mover] + 1 }));
    setDrawState((previous) => advanceDrawState(current, move, next, previous));
    setRepetitions((prev) => {
      const key = boardKey(next, nextTurn);
      const map = new Map(prev);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    });
    setTurn(nextTurn);
  }, []);

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const fresh = createBoard();
    setBoard(fresh);
    setTurn("y");
    setSelected(null);
    setLastMove(null);
    setDrawState(initialDrawState());
    setRepetitions(new Map([[boardKey(fresh, "y"), 1]]));
    setMoveCounts({ y: 0, b: 0 });
    setThinking(false);
  }, []);

  const startGame = useCallback(() => {
    restart();
    setScreen("game");
  }, [restart]);

  const exitToMenu = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setThinking(false);
    setConfirmExit(false);
    if (mode === "online") online.leave.mutate();
    setScreen("menu");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const requestExit = useCallback(() => {
    if (outcome === "playing") setConfirmExit(true);
    else exitToMenu();
  }, [outcome, exitToMenu]);

  const outcomeSfxRef = useRef<Outcome | null>(null);
  useEffect(() => {
    if (outcome === "playing") {
      outcomeSfxRef.current = null;
      return;
    }
    if (outcomeSfxRef.current === outcome) return;
    outcomeSfxRef.current = outcome;
    if (outcome === mySide) playSfx("win");
    else if (outcome === oppSide) playSfx("gameover");
  }, [outcome, mySide, oppSide]);

  // --- CPU turn (offline only) ---
  useEffect(() => {
    if (mode !== "cpu") return;
    if (screen !== "game" || turn !== "b" || outcome !== "playing") return;
    setThinking(true);
    timer.current = setTimeout(() => {
      const move = chooseMove(board, "b", difficulty, repetitions);
      setThinking(false);
      if (move) play(board, move);
    }, 420);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mode, screen, turn, outcome, board, difficulty, play, repetitions]);

  // --- online: enter the board as soon as the room starts ---
  useEffect(() => {
    if (mode !== "online") return;
    if (room?.status === "playing" && screen === "menu") {
      restart();
      setScreen("game");
    }
  }, [mode, room?.status, screen, restart]);

  // --- online: replay opponent moves ---
  const applied = useRef(0);
  useEffect(() => {
    if (!isOnline) return;
    const fresh = online.moves.slice(applied.current);
    if (fresh.length === 0) return;
    applied.current = online.moves.length;
    let current = board;
    for (const rec of fresh) {
      if (rec.wallet === online.wallet) continue;
      if (rec.kind !== "move") continue;
      const move: Move = {
        from: Number(rec.payload["from"]),
        to: Number(rec.payload["to"]),
        captures: String(rec.payload["captures"] ?? "")
          .split(",")
          .filter(Boolean)
          .map(Number),
        crowned: Boolean(rec.payload["crowned"]),
      };
      play(current, move);
      current = applyMove(current, move);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online.moves, isOnline]);

  useEffect(() => {
    applied.current = 0;
  }, [room?.id]);

  const submitOnline = useCallback(
    (move: Move) => {
      if (!isOnline || !room) return;
      online.sendMove(room.turnNo, "move", {
        from: move.from,
        to: move.to,
        captures: move.captures.join(","),
        crowned: move.crowned,
      });
    },
    [isOnline, online, room],
  );

  // --- online turn clock: auto-plays the best move when time runs out ---
  useEffect(() => {
    if (!isOnline || outcome !== "playing" || screen !== "game") return;
    const started = room ? new Date(room.turnStartedAt).getTime() : Date.now();
    const id = setInterval(() => {
      const left = Math.max(0, TURN_TIMEOUT_MS - (Date.now() - started));
      setClock(left);
      if (left === 0 && turn === mySide) {
        const auto = chooseMove(board, mySide, "easy", repetitions);
        if (auto) {
          submitOnline(auto);
          play(board, auto);
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [isOnline, outcome, screen, room, turn, mySide, board, repetitions, submitOnline, play]);

  // --- online: publish the result once ---
  const reported = useRef(false);
  useEffect(() => {
    if (!isOnline || !room) return;
    if (outcome === "playing") {
      reported.current = false;
      return;
    }
    if (reported.current) return;
    reported.current = true;
    const hostWallet = room.hostWallet;
    const guestWallet = room.players.find((p) => p.wallet !== hostWallet)?.wallet ?? null;
    const winner = outcome === "draw" ? null : outcome === "y" ? hostWallet : guestWallet;
    online.finish(winner);
  }, [isOnline, outcome, room, online]);

  const handleSquare = (index: number) => {
    if (turn !== mySide || outcome !== "playing") return;
    if (isOnline && !online.myTurn) return;
    const target = targets.find((m) => m.to === index);
    if (target) {
      if (isOnline) submitOnline(target);
      play(board, target);
      return;
    }
    if (movable.has(index)) {
      if (index !== selected) playSfx("select", 0.6);
      setSelected(index === selected ? null : index);
    } else setSelected(null);
  };

  const you = countPieces(board, mySide);
  const them = countPieces(board, oppSide);
  const youLabel = NEON_COLORS[playerColor].label;
  const youTone = NEON_COLORS[playerColor].stroke;
  const cpuTone = NEON_COLORS[cpuColor].stroke;

  const rivalName = isOnline
    ? (room?.players.find((p) => p.wallet !== online.wallet)?.name ?? "Rival")
    : "CPU";

  const status =
    outcome === mySide
      ? "You win!"
      : outcome === oppSide
        ? `${rivalName} wins.`
        : outcome === "draw"
          ? "Draw."
          : turn === mySide
            ? "Your turn"
            : thinking
              ? "CPU is thinking…"
              : `${rivalName}'s turn`;

  const resultRows: ResultRow[] = useMemo(() => {
    const mine = {
      wallet: online.wallet ?? "you",
      name: "You",
      isYou: true,
      pieces: you.total,
      stats: [
        { label: "Pieces left", value: String(you.total) },
        { label: "Captured", value: String(20 - them.total) },
        { label: "Moves", value: String(moveCounts[mySide]) },
      ],
    };
    const rival = {
      wallet: "rival",
      name: rivalName,
      isYou: false,
      pieces: them.total,
      stats: [
        { label: "Pieces left", value: String(them.total) },
        { label: "Captured", value: String(20 - you.total) },
        { label: "Moves", value: String(moveCounts[oppSide]) },
      ],
    };
    return [mine, rival]
      .sort((a, b) => b.pieces - a.pieces)
      .map(({ wallet, name, isYou, stats }) => ({ wallet, name, isYou, stats }));
  }, [you.total, them.total, moveCounts, mySide, oppSide, rivalName, online.wallet]);

  return (
    <main className="fixed inset-0 flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-arena">
      <div
        style={{
          width: FRAME_W,
          height: FRAME_H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        className="flex shrink-0 flex-col gap-6 p-6"
      >
        {screen === "menu" ? (
          <div className="flex h-full flex-col gap-6">
            <div className="mx-auto mt-6 flex gap-2 rounded-xl bg-arena-panel p-1">
              {(["cpu", "online"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={[
                    "rounded-lg px-6 py-2 text-sm font-bold uppercase tracking-wide transition-colors",
                    mode === m ? "bg-neon-yellow/20 text-neon-yellow" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {m === "cpu" ? "VS CPU" : "Online"}
                </button>
              ))}
            </div>

            {mode === "cpu" ? (
              <Menu
                color={playerColor}
                cpuColor={cpuColor}
                difficulty={difficulty}
                onColor={(color) => {
                  setPlayerColor(color);
                  if (color === cpuColor) setCpuColor(OPPONENT_COLORS[color]);
                }}
                onCpuColor={(color) => {
                  setCpuColor(color);
                  if (color === playerColor) setPlayerColor(OPPONENT_COLORS[color]);
                }}
                onDifficulty={setDifficulty}
                onStart={startGame}
              />
            ) : (
              <div className="mx-auto w-full max-w-md">
                <h2 className="mb-4 text-center text-2xl font-black text-neon-yellow">
                  ONLINE MATCH
                </h2>
                <OnlinePanel online={online} maxPlayers={2} />
              </div>
            )}
          </div>
        ) : (
          <>
            <header className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-black text-neon-yellow drop-shadow-[0_0_12px_var(--color-neon-yellow-deep)]">
                  NIMIQ CHECKERS
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  International Draughts · You are {youLabel.toLowerCase()}
                  {isOnline ? ` · vs ${rivalName}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p
                  className="text-lg font-bold"
                  style={{ color: turn === mySide ? youTone : cpuTone }}
                >
                  {status}
                </p>
                <p className="text-xs text-muted-foreground">
                  You {you.total} ({you.kings} kings) · {rivalName} {them.total} ({them.kings} kings)
                </p>
                {isOnline && outcome === "playing" && (
                  <p className="text-xs font-semibold text-neon-blue">
                    {turn === mySide ? "Your move" : "Waiting"} · {Math.ceil(clock / 1000)}s
                  </p>
                )}
                {countdown !== null && (
                  <p className="text-xs font-semibold text-neon-yellow/80">
                    Draw in {countdown} moves without progress
                  </p>
                )}
              </div>
            </header>

            <Controls difficulty={difficulty} onRestart={isOnline ? requestExit : restart} onExit={requestExit} />

            <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave the match?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your current game will be lost. Do you want to exit to the main menu?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No, keep playing</AlertDialogCancel>
                  <AlertDialogAction onClick={exitToMenu}>Yes, exit</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className={`mx-auto w-[664px] ${isOnline && mySide === "b" ? "rotate-180" : ""}`}>
              <Board
                board={board}
                playerColor={playerColor}
                cpuColor={cpuColor}
                selected={selected}
                targets={targets}
                movable={movable}
                lastMove={lastMove}
                onSquare={handleSquare}
              />
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Select a piece, then a glowing destination. Captures are mandatory; the longest
              capture sequence must be played.
            </p>

            <MatchResultDialog
              open={isOnline && outcome !== "playing"}
              title={outcome === "draw" ? "Draw" : outcome === mySide ? "You win!" : `${rivalName} wins`}
              subtitle="Final standings"
              rows={resultRows}
              payout={rankedPayout}
              onPlayAgain={exitToMenu}
              onExit={() => navigate({ to: "/games" })}
            />
          </>
        )}
      </div>
    </main>
  );
}

export default CheckersGame;
