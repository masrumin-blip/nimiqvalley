import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [playerColor, setPlayerColor] = useState<NeonColor>("yellow");
  const [cpuColor, setCpuColor] = useState<NeonColor>("blue");
  const [board, setBoard] = useState<BoardModel>(() => createBoard());
  const [turn, setTurn] = useState<"y" | "b">("y");
  const [selected, setSelected] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [drawState, setDrawState] = useState<DrawState>(() => initialDrawState());
  const [repetitions, setRepetitions] = useState<Map<string, number>>(
    () => new Map([[boardKey(createBoard(), "y"), 1]]),
  );
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [thinking, setThinking] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outcome: Outcome = useMemo(
    () => getOutcome(board, turn, drawState, repetitions),
    [board, turn, drawState, repetitions],
  );

  const countdown = useMemo(
    () => (outcome === "playing" ? drawCountdown(drawState) : null),
    [drawState, outcome],
  );

  const humanMoves = useMemo(
    () => (turn === "y" && outcome === "playing" ? legalMoves(board, "y") : []),
    [board, turn, outcome],
  );

  const movable = useMemo(() => new Set(humanMoves.map((m) => m.from)), [humanMoves]);
  const targets = useMemo(
    () => (selected === null ? [] : humanMoves.filter((m) => m.from === selected)),
    [humanMoves, selected],
  );

  const play = useCallback((current: BoardModel, move: Move) => {
    const next = applyMove(current, move);
    const nextTurn = current[move.from]?.player === "y" ? "b" : "y";
    if (move.captures.length > 0) playSfx("collision", 0.5);
    else playSfx("move", 0.5);
    if (move.crowned) playSfx("powerup", 0.6);
    setBoard(next);
    setLastMove(move);
    setSelected(null);
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
    setScreen("menu");
  }, []);

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
    if (outcome === "y") playSfx("win");
    else if (outcome === "b") playSfx("gameover");
  }, [outcome]);

  useEffect(() => {
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
  }, [screen, turn, outcome, board, difficulty, play, repetitions]);

  const handleSquare = (index: number) => {
    if (turn !== "y" || outcome !== "playing") return;
    const target = targets.find((m) => m.to === index);
    if (target) {
      play(board, target);
      return;
    }
    if (movable.has(index)) {
      if (index !== selected) playSfx("select", 0.6);
      setSelected(index === selected ? null : index);
    } else setSelected(null);
  };

  const you = countPieces(board, "y");
  const cpu = countPieces(board, "b");
  const youLabel = NEON_COLORS[playerColor].label;
  const cpuLabel = NEON_COLORS[cpuColor].label;
  const youTone = NEON_COLORS[playerColor].stroke;
  const cpuTone = NEON_COLORS[cpuColor].stroke;

  const status =
    outcome === "y"
      ? "You win!"
      : outcome === "b"
        ? "CPU wins."
        : outcome === "draw"
          ? "Draw."
          : turn === "y"
            ? "Your turn"
            : thinking
              ? "CPU is thinking…"
              : "CPU turn";

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
          <>
            <header className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-black text-neon-yellow drop-shadow-[0_0_12px_var(--color-neon-yellow-deep)]">
                  NIMIQ CHECKERS
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  International Draughts · You are {youLabel.toLowerCase()}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={[
                    "text-lg font-bold",
                  ].join(" ")}
                  style={{ color: turn === "y" || outcome === "y" ? youTone : cpuTone }}
                >
                  {status}
                </p>
                <p className="text-xs text-muted-foreground">
                  You {you.total} ({you.kings} kings) · CPU {cpu.total} ({cpu.kings} kings)
                </p>
                {countdown !== null && (
                  <p className="text-xs font-semibold text-neon-yellow/80">
                    Draw in {countdown} moves without progress
                  </p>
                )}
              </div>
            </header>

            <Controls difficulty={difficulty} onRestart={restart} onExit={requestExit} />

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

            <div className="mx-auto w-[664px]">
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
          </>
        )}
      </div>
    </main>
  );
}

export default CheckersGame;
