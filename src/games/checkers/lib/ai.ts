import {
  applyMove,
  boardKey,
  colOf,
  countPieces,
  legalMoves,
  other,
  rowOf,
  type Board,
  type Move,
  type Player,
} from "./engine";

export type Difficulty = "easy" | "medium" | "hard";

const DEPTH: Record<Difficulty, number> = { easy: 1, medium: 3, hard: 5 };

function evaluate(board: Board, player: Player): number {
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    const piece = board[i];
    if (!piece) continue;
    const row = rowOf(i);
    const col = colOf(i);
    let value = piece.king ? 300 : 100;
    if (!piece.king) {
      const advance = piece.player === "y" ? 9 - row : row;
      value += advance * 5;
    }
    value += (4.5 - Math.abs(4.5 - col)) * 2;
    score += piece.player === player ? value : -value;
  }

  const mine = countPieces(board, player);
  const theirs = countPieces(board, other(player));
  if (mine.total + theirs.total <= 8 && mine.total !== theirs.total) {
    const stronger = mine.total > theirs.total;
    let distance = 0;
    for (let i = 0; i < board.length; i++) {
      if (board[i]?.player !== player) continue;
      let nearest = 20;
      for (let j = 0; j < board.length; j++) {
        if (board[j]?.player !== other(player)) continue;
        nearest = Math.min(
          nearest,
          Math.max(Math.abs(rowOf(i) - rowOf(j)), Math.abs(colOf(i) - colOf(j))),
        );
      }
      distance += nearest;
    }
    score += (stronger ? -1 : 1) * distance * 3;
  }
  return score;
}

function search(
  board: Board,
  turn: Player,
  me: Player,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const moves = legalMoves(board, turn);
  if (moves.length === 0) return turn === me ? -100000 - depth : 100000 + depth;
  if (depth === 0) return evaluate(board, me);

  const ordered = [...moves].sort((a, b) => b.captures.length - a.captures.length);
  if (turn === me) {
    let best = -Infinity;
    for (const move of ordered) {
      best = Math.max(best, search(applyMove(board, move), other(turn), me, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of ordered) {
    best = Math.min(best, search(applyMove(board, move), other(turn), me, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(
  board: Board,
  player: Player,
  difficulty: Difficulty,
  repetitions?: Map<string, number>,
): Move | null {
  const moves = legalMoves(board, player);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0] ?? null;

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)] ?? null;
  }

  let best = moves[0] ?? null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyMove(board, move);
    const repeatCount = repetitions?.get(boardKey(next, other(player))) ?? 0;
    const score = search(
      next,
      other(player),
      player,
      DEPTH[difficulty] - 1,
      -Infinity,
      Infinity,
    ) - repeatCount * 45 + (difficulty === "medium" ? Math.random() * 8 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}