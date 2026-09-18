# Keep the island camera distance fixed

## Problem

The camera distance on Nimiq Island changes after opening and closing a scenic view. The zoom value itself is already fixed at 0.85, so the drift comes from how the island picture is sized, not from the zoom setting.

The island drawing area measures itself using its on-screen measured size. That measurement is affected by the page-fit scaling of the game stage, which changes when the browser toolbar appears or disappears (exactly what happens when a scenic view opens full screen and then closes). The drawing buffer ends up a different size than before while the picture is stretched to fill the same box, so everything looks nearer or farther than before.

## Fix

In `src/components/VillageCanvas.tsx`:

- Measure the canvas with its layout size (`clientWidth` / `clientHeight`) instead of `getBoundingClientRect()`, so the stage's fit-to-screen scaling no longer distorts the buffer size.
- Watch the canvas with a `ResizeObserver` (in addition to the window resize listener) and re-measure whenever the box actually changes, so the buffer and the visible box always match.
- Skip the resize when the measured size is 0 (can happen while a scenic view is on screen), keeping the last valid size instead of collapsing the buffer.

No change to `CAMERA_ZOOM` (stays 0.85), no change to visuals, layout, panel, or scenic views.

## Verification

- Typecheck passes.
- Load the island, open a scenic view, return, and confirm the player and buildings are drawn at the same size as before opening it.
