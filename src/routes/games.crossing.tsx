import { createFileRoute } from "@tanstack/react-router";
import CrossingPage from "@/games/crossing/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Crossing for Nimiq — Forest Adventure";
const description =
  "Hop through an endless forest, dodge snakes, ride logs across rivers, and collect hexagonal coins.";

export const Route = createFileRoute("/games/crossing")({
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
    <GameFrame slug="crossing" name="Crossing for Nimiq">
      <CrossingPage />
    </GameFrame>
  ),
});
