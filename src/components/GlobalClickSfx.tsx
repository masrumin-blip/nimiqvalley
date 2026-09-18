import { useEffect } from "react";
import { playSfx, primeSfx } from "@/lib/sfx";

const CLICKABLE =
  'button, [role="button"], a[href], summary, input[type="button"], input[type="submit"], input[type="reset"], [role="tab"], [role="menuitem"], [role="option"], [data-sfx-click]';

/**
 * Plays a short click blip for every button/link press anywhere in the UI.
 * Opt out on an element (or any ancestor) with data-no-sfx.
 */
export function GlobalClickSfx() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const hit = target.closest(CLICKABLE);
      if (!hit) return;
      if (hit.closest("[data-no-sfx]")) return;
      if (hit.getAttribute("aria-disabled") === "true") return;
      if ((hit as HTMLButtonElement).disabled) return;
      primeSfx();
      playSfx("click");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.repeat) return;
      const active = document.activeElement;
      if (!active || typeof active.closest !== "function") return;
      const hit = active.closest(CLICKABLE);
      if (!hit || hit.closest("[data-no-sfx]")) return;
      playSfx("click");
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}

export default GlobalClickSfx;
