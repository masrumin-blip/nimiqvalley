import { createFileRoute } from "@tanstack/react-router";
import SoccerPage from "@/games/soccer/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Soccer — Neon Table Soccer vs CPU";
const description =
  "Pull, aim, and release. Face the CPU in neon hexagonal duels with three difficulty levels and a quick tutorial.";

export const Route = createFileRoute("/games/soccer")({
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
    <GameFrame slug="soccer" name="Nimiq Soccer">
      <SoccerPage />
    </GameFrame>
  ),
});
