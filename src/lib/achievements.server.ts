import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LEADERBOARD_GAMES } from "./leaderboard";
import type { AchievementBadge, AchievementSummary } from "./achievements";

export async function getAchievements(wallet: string): Promise<AchievementSummary> {
  const { data: scoreRows, error: scoreError } = await supabaseAdmin
    .from("scores")
    .select("game_slug, value")
    .eq("wallet", wallet);
  if (scoreError) throw new Error("Could not load achievements");

  const validScores = (scoreRows ?? []).filter((row) =>
    LEADERBOARD_GAMES.some((game) => game.slug === row.game_slug),
  );

  const [ranked, mpWins, soccerWins] = await Promise.all([
    Promise.all(
      validScores.map(async (row) => {
        const game = LEADERBOARD_GAMES.find((item) => item.slug === row.game_slug);
        if (!game) return null;
        const comparison = game.order === "asc" ? "lt" : "gt";
        const query = supabaseAdmin
          .from("scores")
          .select("id", { count: "exact", head: true })
          .eq("game_slug", row.game_slug);
        const { count } = await query[comparison]("value", row.value);
        return { game, rank: (count ?? 0) + 1 };
      }),
    ),
    supabaseAdmin
      .from("mp_rooms")
      .select("id", { count: "exact", head: true })
      .eq("status", "finished")
      .eq("winner_wallet", wallet),
    supabaseAdmin
      .from("soccer_matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "finished")
      .eq("winner_wallet", wallet),
  ]);

  const badges: AchievementBadge[] = [];
  for (const result of ranked) {
    if (!result || result.rank > 10) continue;
    const rank = result.rank;
    badges.push({
      id: `rank-${result.game.slug}`,
      kind: "rank",
      title: rank === 1 ? "Valley Champion" : rank <= 3 ? "Podium Player" : "Top Contender",
      detail: `#${rank} ${result.game.name}`,
      tier: rank === 1 ? "gold" : rank <= 3 ? "silver" : "bronze",
    });
  }

  const onlineWins = (mpWins.count ?? 0) + (soccerWins.count ?? 0);
  const winMilestones = [
    { value: 1, title: "First Victory", tier: "bronze" as const },
    { value: 10, title: "Battle Tested", tier: "silver" as const },
    { value: 25, title: "Arena Veteran", tier: "gold" as const },
    { value: 50, title: "Valley Legend", tier: "emerald" as const },
  ];
  for (const milestone of winMilestones) {
    if (onlineWins >= milestone.value) badges.push({
      id: `wins-${milestone.value}`,
      kind: "wins",
      title: milestone.title,
      detail: `${milestone.value} online ${milestone.value === 1 ? "win" : "wins"}`,
      tier: milestone.tier,
    });
  }

  const gamesPlayed = validScores.length;
  const gameMilestones = [
    { value: 1, title: "First Steps", tier: "bronze" as const },
    { value: 5, title: "Game Explorer", tier: "silver" as const },
    { value: LEADERBOARD_GAMES.length, title: "Valley Master", tier: "emerald" as const },
  ];
  for (const milestone of gameMilestones) {
    if (gamesPlayed >= milestone.value) badges.push({
      id: `games-${milestone.value}`,
      kind: "games",
      title: milestone.title,
      detail: `${milestone.value} ${milestone.value === 1 ? "game" : "games"} played`,
      tier: milestone.tier,
    });
  }

  return { badges, onlineWins, gamesPlayed, totalGames: LEADERBOARD_GAMES.length };
}