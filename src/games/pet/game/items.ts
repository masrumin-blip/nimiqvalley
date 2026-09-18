import type { CosmeticItem, FoodItem } from "./types";

export const FOODS: FoodItem[] = [
  { id: "apple", name: "Apple", emoji: "🍎", price: 4, hunger: 12, fun: 2 },
  { id: "bread", name: "Bread", emoji: "🥖", price: 6, hunger: 18 },
  { id: "burger", name: "Burger", emoji: "🍔", price: 14, hunger: 34, fun: 4 },
  { id: "sushi", name: "Sushi", emoji: "🍣", price: 16, hunger: 30, fun: 8 },
  { id: "cake", name: "Cake", emoji: "🍰", price: 18, hunger: 24, fun: 14 },
  { id: "milk", name: "Milk", emoji: "🥛", price: 8, hunger: 12, energy: 8 },
  { id: "coffee", name: "Coffee", emoji: "☕", price: 20, hunger: 4, energy: 30 },
  { id: "potion", name: "Fun Potion", emoji: "🧪", price: 26, hunger: 0, fun: 32 },
];

export const FOOD_MAP = Object.fromEntries(FOODS.map((f) => [f.id, f])) as Record<string, FoodItem>;

export const COSMETICS: CosmeticItem[] = [
  { id: "hat-cap", name: "Cap", price: 35, kind: "hat", value: "cap", emoji: "🧢" },
  { id: "hat-party", name: "Party Hat", price: 45, kind: "hat", value: "party", emoji: "🎉" },
  { id: "hat-crown", name: "Crown", price: 120, kind: "hat", value: "crown", emoji: "👑" },
  { id: "hat-bow", name: "Bow", price: 30, kind: "hat", value: "bow", emoji: "🎀" },

  { id: "glasses-round", name: "Round Specs", price: 40, kind: "glasses", value: "round", emoji: "👓" },
  { id: "glasses-shades", name: "Cool Shades", price: 70, kind: "glasses", value: "shades", emoji: "🕶️" },
  { id: "glasses-star", name: "Star Glasses", price: 100, kind: "glasses", value: "star", emoji: "⭐" },
];

export const COSMETIC_MAP = Object.fromEntries(COSMETICS.map((c) => [c.id, c])) as Record<
  string,
  CosmeticItem
>;
