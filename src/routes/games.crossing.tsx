import { createFileRoute } from "@tanstack/react-router";
import CrossingPage from "@/games/crossing/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Crossing for Nimiq — Cross Roads and Rivers";
const description =
  "Hop across endless roads and rivers, dodge cars and trucks, ride logs, and collect hexagonal coins.";

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
