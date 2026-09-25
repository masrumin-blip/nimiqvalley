import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { GameFrame } from "@/components/GameFrame";
import { startGameRun, submitTelemetryRun } from "@/lib/game-runs.functions";
import { currentLeagueId } from "@/lib/verification-info";

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
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        slug?: string;
        score?: number;
        durationSec?: number;
        wave?: number;
        kills?: Record<string, number>;
        maxCombo?: number;
      };
      if (data?.slug !== "shooter") return;
      if (data.type === "nimiq-start") {
        sessionRef.current = null;
        void startGameRun({ data: { slug: "shooter", leagueId: currentLeagueId() } })
          .then((r) => {
            sessionRef.current = r.sessionId;
          })
          .catch(() => {});
      } else if (data.type === "nimiq-run" && typeof data.score === "number") {
        const sessionId = sessionRef.current;
        sessionRef.current = null;
        if (!sessionId) return;
        void submitTelemetryRun({
          data: {
            slug: "shooter",
            sessionId,
            score: data.score,
            durationSec: Number(data.durationSec) || 0,
            wave: Math.floor(Number(data.wave) || 0),
            kills: data.kills ?? {},
            maxCombo: Math.floor(Number(data.maxCombo) || 0),
          },
        }).catch(() => {});
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
        className="h-full w-full border-0"
      />
    </GameFrame>
  );
}
