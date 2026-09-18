import { create } from "zustand";

export type Phase = "menu" | "lobby" | "race" | "result";
export type Mode = "single" | "online";
export type Difficulty = "santai" | "normal" | "pro";

export const PLAYER_SPEED_SCALE: Record<Difficulty, number> = {
  santai: 1.1,
  normal: 1.06,
  pro: 1,
};

export const BOT_SKILLS: Record<Difficulty, [number, number, number]> = {
  santai: [1.034, 1.034, 1.034],
  normal: [1.368, 1.368, 1.368],
  pro: [1.4, 1.4, 1.4],
};

export type RaceResult = {
  id: string;
  name: string;
  color: string;
  time: number | null;
  isYou: boolean;
};

interface GameState {
  phase: Phase;
  mode: Mode;
  laps: number;
  colorId: string;
  name: string;
  difficulty: Difficulty;
  roomCode: string | null;
  results: RaceResult[];
  setName: (name: string) => void;
  setDifficulty: (d: Difficulty) => void;
  setColor: (id: string) => void;
  setLaps: (laps: number) => void;
  setRoom: (code: string | null) => void;
  openLobby: (code: string) => void;
  startSingle: () => void;
  startRace: (laps?: number) => void;
  addResult: (r: RaceResult) => void;
  finishRace: () => void;
  backToMenu: () => void;
  backToLobby: () => void;
}

export const useGame = create<GameState>((set) => ({
  phase: "menu",
  mode: "single",
  laps: 3,
  colorId: "merah",
  name: "Racer",
  difficulty: "normal",
  roomCode: null,
  results: [],
  setName: (name) => set({ name: name.slice(0, 14) }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setColor: (colorId) => set({ colorId }),
  setLaps: (laps) => set({ laps }),
  setRoom: (roomCode) => set({ roomCode }),
  openLobby: (roomCode) =>
    set({ phase: "lobby", mode: "online", roomCode, results: [] }),
  startSingle: () =>
    set({ phase: "race", mode: "single", roomCode: null, results: [] }),
  startRace: (laps) =>
    set((s) => ({
      phase: "race",
      results: [],
      laps: laps ?? s.laps,
    })),
  addResult: (r) =>
    set((s) =>
      s.results.some((x) => x.id === r.id)
        ? s
        : { results: [...s.results, r].sort(sortResults) },
    ),
  finishRace: () => set({ phase: "result" }),
  backToMenu: () =>
    set({ phase: "menu", mode: "single", roomCode: null, results: [] }),
  backToLobby: () => set({ phase: "lobby", results: [] }),
}));

function sortResults(a: RaceResult, b: RaceResult) {
  if (a.time === null && b.time === null) return 0;
  if (a.time === null) return 1;
  if (b.time === null) return -1;
  return a.time - b.time;
}
