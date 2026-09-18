import { createFileRoute } from "@tanstack/react-router";
import { MininjaGame } from "@/games/mininja/components/MininjaGame";
import { GameFrame } from "@/components/GameFrame";

const title = "Nimiq Mininja — Cyberpunk Endless Runner";
const description = "Jump, slash, and survive as long as possible in this neon cyberpunk endless runner.";

export const Route = createFileRoute("/games/mininja")({
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
    <GameFrame slug="mininja" name="Nimiq Mininja">
      <MininjaGame />
    </GameFrame>
  ),
});
