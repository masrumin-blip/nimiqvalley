import { createFileRoute } from "@tanstack/react-router";
import { TelemetryIframeGame } from "@/components/TelemetryIframeGame";

const title = "Nimiq Plane — Missile Escape";
const description =
  "Fly through a sunset sky, dodge homing missiles, make them collide, and grab glowing hex coins.";

export const Route = createFileRoute("/games/plane")({
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
  component: () => <TelemetryIframeGame slug="plane" name="Nimiq Plane" src="/games/plane/index.html" />,
});
