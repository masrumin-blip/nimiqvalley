import { HexPiece, NEON_COLORS, type NeonColor } from "./Piece";
import {
  colOf,
  isDark,
  rowOf,
  type Board as BoardModel,
  type Move,
} from "@/games/checkers/lib/engine";
import type { CSSProperties } from "react";

type MoveStyle = CSSProperties & {
  "--move-x": number;
  "--move-y": number;
};

export function Board({
  board,
  playerColor,
  cpuColor,
  selected,
  targets,
  movable,
  lastMove,
  onSquare,
}: {
  board: BoardModel;
  playerColor: NeonColor;
  cpuColor: NeonColor;
  selected: number | null;
  targets: Move[];
  movable: Set<number>;
  lastMove: Move | null;
  onSquare: (index: number) => void;
}) {
  const targetSet = new Set(targets.map((m) => m.to));
  const playerTone = NEON_COLORS[playerColor].stroke;
  const cpuTone = NEON_COLORS[cpuColor].stroke;

  return (
    <div className="grid grid-cols-10 overflow-hidden rounded-xl border-2 border-board-line shadow-[0_0_40px_rgba(0,0,0,0.6)]">
      {board.map((cell, i) => {
        const row = rowOf(i);
        const col = colOf(i);
        const dark = isDark(row, col);
        const isTarget = targetSet.has(i);
        const isSelected = selected === i;
        const canPick = movable.has(i);
        const touched = lastMove && (lastMove.from === i || lastMove.to === i);
        const isArrival = lastMove?.to === i;
        const moveStyle: MoveStyle | undefined = isArrival
          ? {
              "--move-x": colOf(lastMove.from) - col,
              "--move-y": rowOf(lastMove.from) - row,
            }
          : undefined;

        return (
          <button
            key={i}
            type="button"
            onClick={() => onSquare(i)}
            disabled={!dark}
            aria-label={`Square ${String.fromCharCode(97 + col)}${10 - row}`}
            className={[
              "group relative flex aspect-square items-center justify-center outline-none",
              dark ? "bg-board-dark" : "bg-board-light",
              isSelected ? "ring-2 ring-inset" : "",
              touched && !isSelected ? "ring-1 ring-inset" : "",
            ].join(" ")}
            style={{
              boxShadow: isSelected
                ? `inset 0 0 0 2px ${playerTone}`
                : touched
                  ? `inset 0 0 0 1px ${cpuTone}`
                  : undefined,
            }}
          >
            {isTarget && (
              <span
                className="absolute h-1/3 w-1/3 rounded-full opacity-75"
                style={{ backgroundColor: playerTone, boxShadow: `0 0 16px ${playerTone}` }}
              />
            )}
            {cell && (
              <span
                key={isArrival ? `${lastMove.from}-${lastMove.to}` : `piece-${i}`}
                className={[
                  "absolute inset-0 flex items-center justify-center",
                  isArrival ? "animate-piece-move z-10" : "",
                ].join(" ")}
                style={moveStyle}
              >
                <HexPiece
                  piece={cell}
                  color={cell.player === "y" ? playerColor : cpuColor}
                  selected={isSelected}
                  interactive={canPick}
                />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
