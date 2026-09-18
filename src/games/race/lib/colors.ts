export type CarColor = {
  id: string;
  name: string;
  body: string;
  accent: string;
};

export const CAR_COLORS: CarColor[] = [
  { id: "merah", name: "Racing Red", body: "#ef3f33", accent: "#ffd166" },
  { id: "biru", name: "Ocean Blue", body: "#2b8ce6", accent: "#eaf6ff" },
  { id: "kuning", name: "Lightning Yellow", body: "#f7c331", accent: "#2b2b33" },
  { id: "hijau", name: "Apex Green", body: "#3fb96b", accent: "#f2fff6" },
  { id: "ungu", name: "Night Purple", body: "#8a5ce0", accent: "#ffe3a3" },
  { id: "oranye", name: "Velocity Orange", body: "#f97a1f", accent: "#2b2b33" },
  { id: "pink", name: "Neon Pink", body: "#f576b5", accent: "#fff0f6" },
  { id: "putih", name: "Arctic White", body: "#f2f3f5", accent: "#e0453c" },
];

export function colorById(id: string): CarColor {
  return CAR_COLORS.find((c) => c.id === id) ?? CAR_COLORS[0]!;
}
