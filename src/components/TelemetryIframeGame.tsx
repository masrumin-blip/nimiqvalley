import { useEffect, useRef } from "react";
import { GameFrame } from "@/components/GameFrame";
import { startGameRun, submitTelemetryRun } from "@/lib/game-runs.functions";
import type { TelemetrySlug } from "@/lib/telemetry-rules";
import { currentLeagueId } from "@/lib/verification-info";

/**
 * Hosts a self-contained HTML game in an iframe and bridges its
 * `nimiq-start` / `nimiq-run` messages to the verified telemetry score path.
 */
export function TelemetryIframeGame({ slug, name, src }: { slug: TelemetrySlug; name: string; src: string }) {
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
        coins?: number;
      };
      if (data?.slug !== slug) return;
      if (data.type === "nimiq-start") {
        sessionRef.current = null;
        void startGameRun({ data: { slug, leagueId: currentLeagueId() } })
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
            slug,
            sessionId,
            score: Math.max(0, Math.floor(data.score)),
            durationSec: Math.max(0, Number(data.durationSec) || 0),
            wave: Math.max(0, Math.floor(Number(data.wave) || 0)),
            kills: data.kills ?? {},
            coins: Math.max(0, Math.floor(Number(data.coins) || 0)),
          },
        }).catch(() => {});
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [slug]);

  return (
    <GameFrame slug={slug} name={name}>
      <iframe src={src} title={name} className="absolute inset-0 h-full w-full border-0" allow="fullscreen" />
    </GameFrame>
  );
}
