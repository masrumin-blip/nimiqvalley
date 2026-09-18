export type AchievementKind = "rank" | "wins" | "games";

export interface AchievementBadge {
  id: string;
  kind: AchievementKind;
  title: string;
  detail: string;
  tier: "gold" | "silver" | "bronze" | "emerald";
}

export interface AchievementSummary {
  badges: AchievementBadge[];
  onlineWins: number;
  gamesPlayed: number;
  totalGames: number;
}