import { createFileRoute } from "@tanstack/react-router";
import NeonJump from "@/games/jump/game/NeonJump";
import { GameFrame } from "@/components/GameFrame";

const title = "Jump for Nimiq — Cyber Arcade Platformer";
const description =
  "Climb a neon city, avoid lasers and mines, and master power-ups in this vertical arcade platformer.";

export const Route = createFileRoute("/games/jump")({
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
    <GameFrame slug="jump" name="Jump for Nimiq">
      <NeonJump />
    </GameFrame>
  ),
});
