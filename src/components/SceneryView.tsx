import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RestSpot, SceneryId } from "@/lib/village";
import oceanHtml from "@/sceneries/lautan-luas.html?raw";
import hillHtml from "@/sceneries/cakrawala-bukit.html?raw";
import auroraHtml from "@/sceneries/aurora.html?raw";
import sunriseHtml from "@/sceneries/danau-sunrise.html?raw";
import sunsetHtml from "@/sceneries/danau-sunset.html?raw";
import rainHtml from "@/sceneries/hutan-hujan.html?raw";

const SCENES: Record<SceneryId, string> = {
  ocean: oceanHtml,
  hill: hillHtml,
  aurora: auroraHtml,
  sunrise: sunriseHtml,
  sunset: sunsetHtml,
  rain: rainHtml,
};

const REDUCED_MOTION_STYLE = `<style>@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important}}</style>`;

interface Props {
  spot: RestSpot;
  onClose: () => void;
}

export default function SceneryView({ spot, onClose }: Props) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <section className="absolute inset-0 z-50 overflow-hidden bg-background" aria-label={`${spot.name} scenery`}>
      <iframe
        title={spot.name}
        srcDoc={SCENES[spot.id].replace("</head>", `${REDUCED_MOTION_STYLE}</head>`)}
        className="absolute inset-0 h-full w-full border-0"
        sandbox="allow-scripts"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
        <Button
          type="button"
          onClick={onClose}
          size="icon"
          variant="secondary"
          className="pointer-events-auto h-11 w-11 rounded-full shadow-lg"
          aria-label="Return to the island"
          title="Return to the island"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div className="rounded-md bg-card/80 px-3 py-2 text-right shadow-lg backdrop-blur">
          <p className="text-xs font-medium uppercase text-muted-foreground">Scenery</p>
          <h2 className="text-sm font-semibold text-card-foreground">{spot.name}</h2>
        </div>
      </div>
    </section>
  );
}