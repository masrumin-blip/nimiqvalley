import { createFileRoute } from "@tanstack/react-router";
import ShipPage from "@/games/ship/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Spaceship — Neon Arena Shooter";
const description =
  "Survive waves of CPU enemies in a neon arena with twin-stick controls, right in your browser.";

export const Route = createFileRoute("/games/ship")({
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
    <GameFrame slug="ship" name="Nimiq Spaceship">
      <ShipPage />
    </GameFrame>
  ),
});
