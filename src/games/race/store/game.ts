import { create } from "zustand";

export type Phase = "menu" | "race" | "result";
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
  laps: number;
  colorId: string;
  name: string;
  difficulty: Difficulty;
  results: RaceResult[];
  setName: (name: string) => void;
  setDifficulty: (d: Difficulty) => void;
  setColor: (id: string) => void;
  setLaps: (laps: number) => void;
  startSingle: () => void;
  addResult: (r: RaceResult) => void;
  finishRace: () => void;
  backToMenu: () => void;
}

export const useGame = create<GameState>((set) => ({
  phase: "menu",
  laps: 3,
  colorId: "merah",
  name: "Racer",
  difficulty: "normal",
  results: [],
  setName: (name) => set({ name: name.slice(0, 14) }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setColor: (colorId) => set({ colorId }),
  setLaps: (laps) => set({ laps }),
  startSingle: () => set({ phase: "race", results: [] }),
  addResult: (r) =>
    set((s) =>
      s.results.some((x) => x.id === r.id)
        ? s
        : { results: [...s.results, r].sort(sortResults) },
    ),
  finishRace: () => set({ phase: "result" }),
  backToMenu: () => set({ phase: "menu", results: [] }),
}));

function sortResults(a: RaceResult, b: RaceResult) {
  if (a.time === null && b.time === null) return 0;
  if (a.time === null) return 1;
  if (b.time === null) return -1;
  return a.time - b.time;
}
