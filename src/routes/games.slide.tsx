import { createFileRoute } from "@tanstack/react-router";
import SlideGame from "@/games/slide/components/SlideGame";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Slide — Game Snowboard Endless";
const description =
  "A light and stylish endless snowboarding game. Jump, collect coins, and avoid obstacles.";

export const Route = createFileRoute("/games/slide")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <GameFrame slug="slide" name="Nimiq Slide">
      <SlideGame />
    </GameFrame>
  ),
});
