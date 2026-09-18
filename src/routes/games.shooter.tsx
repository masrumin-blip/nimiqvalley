import { createFileRoute } from "@tanstack/react-router";
import { GameFrame } from "@/components/GameFrame";

const title = "CosNimiq Shooter — Space Arcade Shooter";
const description =
  "Blast an alien fleet, collect power-ups, and defeat bosses in this classic arcade shooter.";

export const Route = createFileRoute("/games/shooter")({
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
  component: ShooterRoute,
});

function ShooterRoute() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; slug?: string; value?: number };
      if (data?.type === "nimiq-score" && data.slug === "shooter" && typeof data.value === "number") {
        reportScore("shooter", data.value);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <GameFrame slug="shooter" name="CosNimiq Shooter">
      <iframe
        src="/games/shooter/index.html"
        title="CosNimiq Shooter"
        className="h-[calc(100vh-2.75rem)] w-full border-0"
      />
    </GameFrame>
  );
}
