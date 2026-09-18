import { createFileRoute } from "@tanstack/react-router";
import CarromPage from "@/games/carrom/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Carronimiq — Five-Level Neon Carrom";
const description =
  "Pull and release the striker on a neon carrom board. Five levels with precise browser controls.";

export const Route = createFileRoute("/games/carrom")({
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
    <GameFrame slug="carrom" name="Carronimiq">
      <CarromPage />
    </GameFrame>
  ),
});
