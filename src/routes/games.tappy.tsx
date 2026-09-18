import { createFileRoute } from "@tanstack/react-router";
import { TappyGame } from "@/games/tappy/components/tappy-game";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Tappy — Neon Coin Flight Game";
const description =
  "Fly through neon obstacles, collect hexagonal coins, and climb the global Nimiq Tappy leaderboard.";

export const Route = createFileRoute("/games/tappy")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <GameFrame slug="tappy" name="Nimiq Tappy">
      <TappyGame />
    </GameFrame>
  ),
});
