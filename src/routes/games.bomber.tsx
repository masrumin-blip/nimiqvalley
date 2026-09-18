import { createFileRoute } from "@tanstack/react-router";
import BomberPage from "@/games/bomber/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Bomber — Arcade Bomb Arena";
const description =
  "Plant bombs, break blocks, and defeat enemies in the retro Nimiq Bomber arena.";

export const Route = createFileRoute("/games/bomber")({
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
    <GameFrame slug="bomber" name="Nimiq Bomber">
      <BomberPage />
    </GameFrame>
  ),
});
