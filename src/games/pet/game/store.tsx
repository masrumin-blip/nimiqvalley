import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { COSMETIC_MAP, FOOD_MAP } from "./items";
import { setMuted, sfx } from "./audio";
import type { GameState, Mood } from "./types";

const KEY = "pou-clone-save-v1";

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export const initialState: GameState = {
  name: "Nimiq Pet",
  hunger: 70,
  hygiene: 80,
  energy: 75,
  fun: 65,
  coins: 40,
  dirt: 20,
  sleeping: false,
  hat: null,
  glasses: null,
  owned: [],
  pantry: { apple: 2, bread: 1 },
  highScore: 0,
  muted: false,
  lastSeen: Date.now(),
};

/** Decay per minute of real time. */
const DECAY = { hunger: 3.2, hygiene: 2.2, energy: 2.6, fun: 3.6 };

function applyElapsed(state: GameState, ms: number): GameState {
  const mins = ms / 60000;
  if (mins <= 0) return state;
  if (state.sleeping) {
    return {
      ...state,
      energy: clamp(state.energy + mins * 14),
      hunger: clamp(state.hunger - mins * DECAY.hunger * 0.5),
      fun: clamp(state.fun - mins * DECAY.fun * 0.4),
      hygiene: clamp(state.hygiene - mins * DECAY.hygiene * 0.4),
    };
  }
  return {
    ...state,
    hunger: clamp(state.hunger - mins * DECAY.hunger),
    hygiene: clamp(state.hygiene - mins * DECAY.hygiene),
    energy: clamp(state.energy - mins * DECAY.energy),
    fun: clamp(state.fun - mins * DECAY.fun),
    dirt: clamp(state.dirt + mins * 2),
  };
}

function load(): GameState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw) as Partial<GameState> & { color?: string };
    const parsed = {
      ...initialState,
      ...saved,
      name: !saved.name || saved.name === "Blobby" ? initialState.name : saved.name,
      owned: (saved.owned ?? initialState.owned).filter((id) => !id.startsWith("color-")),
    };
    return applyElapsed(parsed, Date.now() - (parsed.lastSeen ?? Date.now()));
  } catch {
    return initialState;
  }
}

export interface GameApi {
  state: GameState;
  ready: boolean;
  mood: Mood;
  patch: (p: Partial<GameState>) => void;
  bump: (p: Partial<Record<"hunger" | "hygiene" | "energy" | "fun", number>>) => void;
  addCoins: (n: number) => void;
  buy: (id: string) => boolean;
  eat: (foodId: string) => boolean;
  scrub: (amount: number) => void;
  rinse: () => void;
  toggleSleep: () => void;
  equip: (id: string) => void;
  toggleMute: () => void;
  reset: () => void;
  flash: (text: string) => void;
  flashText: string | null;
}

const Ctx = createContext<GameApi | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const stateRef = useRef<GameState>(initialState);
  const [ready, setReady] = useState(false);
  const [flashText, setFlashText] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loaded = load();
    stateRef.current = loaded;
    setState(loaded);
    setMuted(loaded.muted);
    setReady(true);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Real-time decay tick.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      setState((s) => applyElapsed(s, 4000));
    }, 4000);
    return () => clearInterval(id);
  }, [ready]);

  // Persist.
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...state, lastSeen: Date.now() }));
    } catch {
      /* storage unavailable */
    }
  }, [state, ready]);

  const flash = useCallback((text: string) => {
    setFlashText(text);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashText(null), 1500);
  }, []);

  const patch = useCallback((p: Partial<GameState>) => setState((s) => ({ ...s, ...p })), []);

  const bump = useCallback<GameApi["bump"]>((p) => {
    setState((s) => ({
      ...s,
      hunger: clamp(s.hunger + (p.hunger ?? 0)),
      hygiene: clamp(s.hygiene + (p.hygiene ?? 0)),
      energy: clamp(s.energy + (p.energy ?? 0)),
      fun: clamp(s.fun + (p.fun ?? 0)),
    }));
  }, []);

  const addCoins = useCallback((n: number) => setState((s) => ({ ...s, coins: Math.max(0, s.coins + n) })), []);

  const buy = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const food = FOOD_MAP[id];
      const cosmetic = COSMETIC_MAP[id];
      const price = food?.price ?? cosmetic?.price;
      if (price === undefined || current.coins < price) return false;
      if (cosmetic && current.owned.includes(id)) return false;
      if (!food && !cosmetic) return false;

      let next: GameState;
      if (food) {
        next = {
          ...current,
          coins: current.coins - price,
          pantry: { ...current.pantry, [id]: (current.pantry[id] ?? 0) + 1 },
        };
      } else if (cosmetic) {
        next = {
          ...current,
          coins: current.coins - price,
          owned: [...current.owned, id],
          [cosmetic.kind]: cosmetic.value,
        };
      } else {
        return false;
      }

      stateRef.current = next;
      setState(next);
      return true;
    },
    [],
  );

  const eat = useCallback(
    (foodId: string) => {
      const food = FOOD_MAP[foodId];
      if (!food) return false;
      let ok = false;
      setState((s) => {
        if ((s.pantry[foodId] ?? 0) <= 0 || s.sleeping) return s;
        ok = true;
        return {
          ...s,
          pantry: { ...s.pantry, [foodId]: (s.pantry[foodId] ?? 1) - 1 },
          hunger: clamp(s.hunger + food.hunger),
          fun: clamp(s.fun + (food.fun ?? 0)),
          energy: clamp(s.energy + (food.energy ?? 0)),
          dirt: clamp(s.dirt + 4),
        };
      });
      return ok;
    },
    [],
  );

  const scrub = useCallback((amount: number) => {
    setState((s) => ({ ...s, dirt: clamp(s.dirt - amount) }));
  }, []);

  const rinse = useCallback(() => {
    setState((s) => ({ ...s, dirt: 0, hygiene: 100, fun: clamp(s.fun + 4) }));
  }, []);

  const toggleSleep = useCallback(() => {
    setState((s) => ({ ...s, sleeping: !s.sleeping }));
  }, []);

  const equip = useCallback((id: string) => {
    setState((s) => {
      const item = COSMETIC_MAP[id];
      if (!item || !s.owned.includes(id)) return s;
      if (item.kind === "hat") return { ...s, hat: s.hat === item.value ? null : item.value };
      return { ...s, glasses: s.glasses === item.value ? null : item.value };
    });
  }, []);

  const toggleMute = useCallback(() => {
    setState((s) => {
      setMuted(!s.muted);
      return { ...s, muted: !s.muted };
    });
  }, []);

  const reset = useCallback(() => {
    setState({ ...initialState, lastSeen: Date.now() });
    sfx.pop();
  }, []);

  // Hygiene follows dirt.
  useEffect(() => {
    setState((s) => {
      const target = clamp(100 - s.dirt);
      return Math.abs(target - s.hygiene) < 0.5 ? s : { ...s, hygiene: target };
    });
  }, [state.dirt]);

  const mood: Mood = useMemo(() => {
    if (state.sleeping) return "sleeping";
    if (state.hunger < 25) return "hungry";
    if (state.hygiene < 25) return "dirty";
    if (state.energy < 20) return "sleepy";
    const avg = (state.hunger + state.hygiene + state.energy + state.fun) / 4;
    if (avg > 72) return "happy";
    if (avg > 42) return "neutral";
    return "sad";
  }, [state]);

  const value = useMemo<GameApi>(
    () => ({
      state,
      ready,
      mood,
      patch,
      bump,
      addCoins,
      buy,
      eat,
      scrub,
      rinse,
      toggleSleep,
      equip,
      toggleMute,
      reset,
      flash,
      flashText,
    }),
    [state, ready, mood, patch, bump, addCoins, buy, eat, scrub, rinse, toggleSleep, equip, toggleMute, reset, flash, flashText],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useGame must be used inside <GameProvider>");
  return api;
}
