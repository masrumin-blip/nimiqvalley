export type StatKey = "hunger" | "hygiene" | "energy" | "fun";

export type Mood = "happy" | "neutral" | "sad" | "hungry" | "dirty" | "sleepy" | "sleeping" | "eating" | "love";

export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  hunger: number;
  fun?: number;
  energy?: number;
}

export interface CosmeticItem {
  id: string;
  name: string;
  price: number;
  kind: "hat" | "glasses";
  value: string;
  emoji?: string;
}

export interface GameState {
  name: string;
  hunger: number;
  hygiene: number;
  energy: number;
  fun: number;
  coins: number;
  dirt: number;
  sleeping: boolean;
  hat: string | null;
  glasses: string | null;
  owned: string[];
  pantry: Record<string, number>;
  highScore: number;
  muted: boolean;
  lastSeen: number;
}
