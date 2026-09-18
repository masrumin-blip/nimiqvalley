# Replace Nimiq Village with Nimiq Island

The uploaded island build replaces the current village page at `/village`. It keeps the same wallet-driven idea (your NIM shapes your villager, your USDT shapes your house) but adds a much bigger island map, villagers who walk around, farm animals, buildings, and six rest spots that open full-screen animated scenery.

## What changes for players

- The village map grows from 1800x1400 to 2600x1950, with pixel-art buildings, objects, animals and named villagers.
- Six rest spots (ocean, hill, aurora, sunrise lake, sunset lake, rain forest). Walking onto one shows a "rest here" prompt; opening it plays a full-screen animated scene with a back button.
- Page title and description become the island ones.
- Everything stays in English, and the page keeps the Game Hub back button and the app's login gate exactly as they are now.

## What gets replaced

- `src/components/VillageCanvas.tsx` — new island renderer (821 lines).
- `src/lib/village.ts` — new world data: buildings, animals, villagers, rest spots, colliders.
- `src/lib/tiers.ts` — updated tier data used by the new renderer.
- `src/components/GameStage.tsx`, `src/components/Joystick.tsx` — minor updated versions.
- `src/routes/village.tsx` — rebuilt from the uploaded page, but keeping the existing route path `/village`, the Game Hub link, and the current head metadata style (island copy).

## What gets added

- `src/components/SceneryView.tsx` — full-screen scenery overlay.
- `src/sceneries/*.html` — the six animated scenes (loaded as raw text into a sandboxed frame).
- Seven sprite sheets (player, villagers, animals, buildings A/B, objects, house tiers). These are ~9 MB total, so they go to Lovable's asset CDN as pointer files instead of into the repository, and the renderer imports the pointers' URLs.

## What is not touched

- Games, Arena Chat, AI Chat, leaderboard, credits/match keys, login flow, main menu — unchanged.
- No database changes.
- The uploaded project's own root route, router, styles, config and duplicated shadcn UI components are ignored; the app keeps its own.

## Technical notes

- Sprite sheets are uploaded with `lovable-assets create` from the upload mount; `VillageCanvas` imports `@/assets/<name>.png.asset.json` and uses `.url` for each `Image.src`. No binaries land in `src/assets`.
- Scenery HTML is imported with Vite `?raw` and rendered through `<iframe srcDoc sandbox="allow-scripts">`, with a reduced-motion style injected.
- Route file stays `src/routes/village.tsx` (`createFileRoute("/village")`), so the hub link and preloading keep working; the uploaded file's `/` route is not copied.
- `wallet.ts` and `nimiq.functions.ts` in the app already cover what the page needs; the uploaded copies are only used if a function is missing.
- Verification: `bunx tsgo --noEmit`, then load `/village` headless to confirm the canvas renders, a rest spot opens its scene, and the console is clean.
