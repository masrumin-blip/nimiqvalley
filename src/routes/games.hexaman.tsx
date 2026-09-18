import { createFileRoute } from "@tanstack/react-router";
import HexamanPage from "@/games/hexaman/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq the Hexaman — Endless Neon Arcade";
const description =
  "Chase data pellets, avoid neon viruses, and set a high score in an endless arcade maze.";

export const Route = createFileRoute("/games/hexaman")({
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
    <GameFrame slug="hexaman" name="Nimiq the Hexaman">
      <HexamanPage />
    </GameFrame>
  ),
});
