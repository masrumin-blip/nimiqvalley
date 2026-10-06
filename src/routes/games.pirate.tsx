import { createFileRoute } from "@tanstack/react-router";
import { TelemetryIframeGame } from "@/components/TelemetryIframeGame";

const title = "Nimiq Pirate — High Seas Battle";
const description =
  "Captain the Nimiq ship, sink skull-flag pirates, raid island forts, and upgrade your vessel wave after wave.";

export const Route = createFileRoute("/games/pirate")({
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
  component: () => <TelemetryIframeGame slug="pirate" name="Nimiq Pirate" src="/games/pirate/index.html" />,
});
