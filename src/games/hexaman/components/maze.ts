// Connected honeycomb network: 19 columns x 21 rows.
// # hive cell, . data mote, * pulse core, - empty floor, = virus gate, H Hexaman spawn
export const MAZE_RAW = [
  "###################",
  "#*..#......##....*#",
  "#.#...##.......#..#",
  "#...#....###.#....#",
  "##..##.#.....##.#.#",
  "#......#..#.......#",
  "#.###....##..###..#",
  "#....##..-..#.....#",
  "##.#..##=##...#.###",
  "....#..#---#.......",
  "###...##.##..#..###",
  "#..#......#.....#.#",
  "#....###....##....#",
  "#.##....#......##.#",
  "#...#.#...###.....#",
  "#.#....#..H..#.#..#",
  "#...##....#....#..#",
  "##......##..#....##",
  "#..#.#.....##.#...#",
  "#*....##.......#.*#",
  "###################",
];

export const COLS = MAZE_RAW[0]?.length ?? 0;
export const ROWS = MAZE_RAW.length;

export const TUNNEL_ROW = 9;

export type Cell = "#" | "." | "*" | "-" | "=";

export function buildGrid(): Cell[][] {
  return MAZE_RAW.map((row) =>
    row.split("").map((ch) => (ch === "H" ? "-" : (ch as Cell))),
  );
}

export const PLAYER_SPAWN = { c: 9, r: 15 };
export const HOUSE_CELLS = [
  { c: 8, r: 9 },
  { c: 9, r: 9 },
  { c: 10, r: 9 },
  { c: 9, r: 9 },
];
export const HOUSE_EXIT = { c: 9, r: 7 };
