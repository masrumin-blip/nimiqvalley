import { createFileRoute } from "@tanstack/react-router";
import PetPage from "@/games/pet/Page";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Pet — Care, Bathe & Play";
const description =
  "Care for your Nimiq Pet: feed, bathe, rest, play arcade games for coins, and dress your yellow jelly friend.";

export const Route = createFileRoute("/games/pet")({
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
    <GameFrame slug="pet" name="Nimiq Pet">
      <PetPage />
    </GameFrame>
  ),
});
