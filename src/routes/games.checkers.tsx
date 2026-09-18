import { createFileRoute } from "@tanstack/react-router";
import CheckersPage from "@/games/checkers/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Checkers — International 10×10 Draughts";
const description =
  "Play international 10×10 draughts against the CPU with neon hexagonal pieces and three difficulty levels.";

export const Route = createFileRoute("/games/checkers")({
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
    <GameFrame slug="checkers" name="Nimiq Checkers">
      <CheckersPage />
    </GameFrame>
  ),
});
