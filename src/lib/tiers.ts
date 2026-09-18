export type TierId = "poor" | "normal" | "cool" | "sultan";

export interface Tier {
  id: TierId;
  min: number;
  characterName: string;
  houseName: string;
  characterBlurb: string;
  houseBlurb: string;
}

/** Single source of truth for the USD thresholds. */
export const TIERS: Tier[] = [
  {
    id: "poor",
    min: 0,
    characterName: "Humble Villager",
    houseName: "Wooden Hut",
    characterBlurb: "Patched clothes, bare feet, big dreams.",
    houseBlurb: "Straw roof and a crooked door.",
  },
  {
    id: "normal",
    min: 5,
    characterName: "Ordinary Villager",
    houseName: "Simple House",
    characterBlurb: "Neat everyday clothes and sturdy boots.",
    houseBlurb: "Timber walls with clay roof tiles.",
  },
  {
    id: "cool",
    min: 10,
    characterName: "Cool Villager",
    houseName: "Fine House",
    characterBlurb: "Jacket, shades and a faint glow.",
    houseBlurb: "Two floors, a fence and a garden.",
  },
  {
    id: "sultan",
    min: 50,
    characterName: "Sultan",
    houseName: "Golden Palace",
    characterBlurb: "Golden robe, crown and sparkles.",
    houseBlurb: "Marble walls, gold dome, fountain.",
  },
];

export function tierForUsd(usd: number): Tier {
  let match: Tier = TIERS[0]!;
  for (const tier of TIERS) if (usd >= tier.min) match = tier;
  return match;
}

export function tierIndex(id: TierId): number {
  return TIERS.findIndex((t) => t.id === id);
}

export const LUNA_PER_NIM = 100_000;

/** Safety rule: never let the wallet drop below this NIM balance. */
export const MIN_NIM_RESERVE = 1;

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNim(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} NIM`;
}
