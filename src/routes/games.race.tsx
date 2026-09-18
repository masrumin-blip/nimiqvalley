import { createFileRoute } from "@tanstack/react-router";
import GamePage from "@/games/race/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Car Race — 3D Bot Racing";
const description =
  "Race through a low-poly 3D world against competitive bot drivers.";

export const Route = createFileRoute("/games/race")({
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
    <GameFrame slug="race" name="Nimiq Car Race">
      <GamePage />
    </GameFrame>
  ),
});
