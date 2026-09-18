export type Player = "y" | "b";
export type Piece = { player: Player; king: boolean };
export type Cell = Piece | null;
export type Board = Cell[];

export type Move = {
  from: number;
  to: number;
  captures: number[];
  crowned: boolean;
};

export type DrawState = {
  kingOnlyPlies: number;
  reducedPlies: number;
  reducedLimit: number | null;
};

export const BOARD_SIZE = 10;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const KING_ONLY_PLY_LIMIT = 50;

export const idx = (row: number, col: number) => row * BOARD_SIZE + col;
export const rowOf = (i: number) => Math.floor(i / BOARD_SIZE);
export const colOf = (i: number) => i % BOARD_SIZE;
export const isDark = (row: number, col: number) => (row + col) % 2 === 0;

const ALL_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

const inBounds = (row: number, col: number) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
const promotionRow = (player: Player) => (player === "y" ? 0 : BOARD_SIZE - 1);

export function createBoard(): Board {
  const board: Board = Array(CELL_COUNT).fill(null);
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!isDark(row, col)) continue;
      if (row < 4) board[idx(row, col)] = { player: "b", king: false };
      else if (row > 5) board[idx(row, col)] = { player: "y", king: false };
    }
  }
  return board;
}

function captureSequences(board: Board, from: number): Move[] {
  const original = board[from];
  if (!original) return [];
  const results: Move[] = [];

  const walk = (position: number, captured: number[], currentBoard: Board) => {
    let extended = false;

    for (const [dr, dc] of ALL_DIRS) {
      if (!original.king) {
        const middleRow = rowOf(position) + dr;
        const middleCol = colOf(position) + dc;
        const landingRow = middleRow + dr;
        const landingCol = middleCol + dc;
        if (!inBounds(landingRow, landingCol)) continue;
        const middle = idx(middleRow, middleCol);
        const landing = idx(landingRow, landingCol);
        const target = currentBoard[middle];
        if (!target || target.player === original.player || captured.includes(middle)) continue;
        if (currentBoard[landing]) continue;

        const next = currentBoard.slice();
        next[position] = null;
        next[landing] = original;
        extended = true;
        walk(landing, [...captured, middle], next);
        continue;
      }

      let scanRow = rowOf(position) + dr;
      let scanCol = colOf(position) + dc;
      let jumped: number | null = null;
      while (inBounds(scanRow, scanCol)) {
        const square = idx(scanRow, scanCol);
        const occupant = currentBoard[square];
        if (!jumped) {
          if (!occupant) {
            scanRow += dr;
            scanCol += dc;
            continue;
          }
          if (occupant.player === original.player || captured.includes(square)) break;
          jumped = square;
          scanRow += dr;
          scanCol += dc;
          continue;
        }
        if (occupant) break;

        const next = currentBoard.slice();
        next[position] = null;
        next[square] = original;
        extended = true;
        walk(square, [...captured, jumped], next);
        scanRow += dr;
        scanCol += dc;
      }
    }

    if (!extended && captured.length > 0) {
      results.push({
        from,
        to: position,
        captures: captured,
        crowned: !original.king && rowOf(position) === promotionRow(original.player),
      });
    }
  };

  walk(from, [], board);
  return results;
}

export function legalMoves(board: Board, player: Player): Move[] {
  const captures: Move[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (board[i]?.player === player) captures.push(...captureSequences(board, i));
  }
  if (captures.length > 0) {
    const maximum = Math.max(...captures.map((move) => move.captures.length));
    return captures.filter((move) => move.captures.length === maximum);
  }

  const quiet: Move[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const piece = board[i];
    if (!piece || piece.player !== player) continue;
    const directions = piece.king
      ? ALL_DIRS
      : piece.player === "y"
        ? ALL_DIRS.slice(0, 2)
        : ALL_DIRS.slice(2);
    for (const [dr, dc] of directions) {
      let row = rowOf(i) + dr;
      let col = colOf(i) + dc;
      while (inBounds(row, col)) {
        const to = idx(row, col);
        if (board[to]) break;
        quiet.push({
          from: i,
          to,
          captures: [],
          crowned: !piece.king && row === promotionRow(piece.player),
        });
        if (!piece.king) break;
        row += dr;
        col += dc;
      }
    }
  }
  return quiet;
}

export function applyMove(board: Board, move: Move): Board {
  const next = board.slice();
  const piece = next[move.from];
  if (!piece) return next;
  next[move.from] = null;
  for (const captured of move.captures) next[captured] = null;
  next[move.to] = { player: piece.player, king: piece.king || move.crowned };
  return next;
}

export const other = (player: Player): Player => (player === "y" ? "b" : "y");

export function countPieces(board: Board, player: Player) {
  let men = 0;
  let kings = 0;
  for (const cell of board) {
    if (cell?.player !== player) continue;
    if (cell.king) kings++;
    else men++;
  }
  return { men, kings, total: men + kings };
}

export function boardKey(board: Board, turn: Player): string {
  let key = turn;
  for (const cell of board) {
    key += !cell ? "." : cell.player === "y" ? (cell.king ? "Y" : "y") : cell.king ? "B" : "b";
  }
  return key;
}

function loneKingOnLongDiagonal(board: Board): boolean {
  for (const player of ["y", "b"] as const) {
    const pieces = board
      .map((piece, square) => ({ piece, square }))
      .filter(({ piece }) => piece?.player === player);
    if (pieces.length === 1 && pieces[0]?.piece?.king) {
      const square = pieces[0].square;
      if (rowOf(square) === colOf(square)) return true;
    }
  }
  return false;
}

/** FMJD reduced-material limits, expressed in plies. */
export function reducedDrawLimit(board: Board): number | null {
  const yellow = countPieces(board, "y");
  const blue = countPieces(board, "b");
  const sides = [yellow, blue];
  const total = yellow.total + blue.total;

  if (total === 2 && yellow.kings === 1 && blue.kings === 1) return 10;
  if (total === 3) {
    const loneKing = sides.some((side) => side.total === 1 && side.kings === 1);
    const stronger = sides.find((side) => side.total === 2);
    if (loneKing && stronger && stronger.kings >= 1) return 10;
  }
  if (total === 4) {
    const loneKing = sides.some((side) => side.total === 1 && side.kings === 1);
    const stronger = sides.find((side) => side.total === 3);
    if (loneKing && stronger && stronger.kings >= 1) {
      return loneKingOnLongDiagonal(board) ? 10 : 32;
    }
  }
  return null;
}

export const initialDrawState = (): DrawState => ({
  kingOnlyPlies: 0,
  reducedPlies: 0,
  reducedLimit: null,
});

export function advanceDrawState(
  before: Board,
  move: Move,
  after: Board,
  previous: DrawState,
): DrawState {
  const movedPiece = before[move.from];
  const kingOnlyPlies = movedPiece?.king && move.captures.length === 0
    ? previous.kingOnlyPlies + 1
    : 0;
  const reducedLimit = reducedDrawLimit(after);
  const reducedPlies = reducedLimit === null
    ? 0
    : previous.reducedLimit === reducedLimit
      ? previous.reducedPlies + 1
      : 1;
  return { kingOnlyPlies, reducedPlies, reducedLimit };
}

export type Outcome = "playing" | "y" | "b" | "draw";

export function getOutcome(
  board: Board,
  turn: Player,
  drawState: DrawState,
  repetitions?: Map<string, number>,
): Outcome {
  if (legalMoves(board, turn).length === 0) return other(turn);
  if ((repetitions?.get(boardKey(board, turn)) ?? 0) >= 3) return "draw";
  if (drawState.kingOnlyPlies >= KING_ONLY_PLY_LIMIT) return "draw";
  if (
    drawState.reducedLimit !== null &&
    drawState.reducedPlies >= drawState.reducedLimit
  ) return "draw";
  return "playing";
}

export function drawCountdown(drawState: DrawState): number | null {
  const remaining: number[] = [];
  if (drawState.kingOnlyPlies > 0) {
    remaining.push(KING_ONLY_PLY_LIMIT - drawState.kingOnlyPlies);
  }
  if (drawState.reducedLimit !== null) {
    remaining.push(drawState.reducedLimit - drawState.reducedPlies);
  }
  if (remaining.length === 0) return null;
  const moves = Math.max(0, Math.ceil(Math.min(...remaining) / 2));
  return moves <= 10 ? moves : null;
}