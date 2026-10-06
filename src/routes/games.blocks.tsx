import { createFileRoute } from "@tanstack/react-router";
import { TelemetryIframeGame } from "@/components/TelemetryIframeGame";

const title = "Nimiq Blocks Drop — Hex Block Puzzle";
const description =
  "Stack neon hexagon blocks, clear lines, and climb levels in a one-screen falling-blocks arena.";

export const Route = createFileRoute("/games/blocks")({
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
  component: () => <TelemetryIframeGame slug="blocks" name="Nimiq Blocks Drop" src="/games/blocks/index.html" />,
});
