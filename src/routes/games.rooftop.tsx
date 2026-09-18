import { createFileRoute } from "@tanstack/react-router";
import { RooftopGame } from "@/games/rooftop/components/game/RooftopGame";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Rooftop — Endless 3D Rooftop Runner";
const description =
  "Run endlessly across 3D city rooftops, leap over gaps, avoid crates, and collect neon hexagonal coins.";

export const Route = createFileRoute("/games/rooftop")({
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
    <GameFrame slug="rooftop" name="Nimiq Rooftop">
      <RooftopGame />
    </GameFrame>
  ),
});
