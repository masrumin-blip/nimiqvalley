# Nimiq Bomber — Online Multiplayer

Bomber's current "Multiplayer 2P/3P/4P" is same-device only: everyone shares one keyboard. It was never wired to the online room system used by Checkers, Carrom, Hexaman and Soccer, which is why there is no online option in its menu.

This plan adds real online play to Bomber using the exact same room system as the other games.

## What the player gets

- A new **Online Battle** section in the Bomber start screen, matching the other games:
  - Quick match (uses 1 match key)
  - Create room with a 5-character code (uses 1 match key)
  - Join by code (free)
  - Challenge a friend
- 2 to 4 real players on one shared map, each on their own phone.
- Bombs, blasts, power-ups and deaths are shared live between players.
- No collision between players (they can pass through each other), same rule as the other online games.
- Last bomber standing wins; the match ends with the stats popup (kills, blocks destroyed, power-ups, survival time) and the win is recorded.
- The existing solo modes (Vs Virus, Vs 3 CPU) and local 2-4P stay exactly as they are.

## Ground rules

- Online requires login, like every other online mode.
- Cost is the same as other games: 1 match key for quick match or for creating a room; joining a code is free; a cancelled search refunds the key.
- Round has a hard time limit (3 minutes). If more than one player is alive when time runs out, the player with the most kills wins; a tie ends as a draw.
- If a player leaves or disconnects, they are marked out and the match continues.

## Technical outline

- Reuse `src/lib/mp` rooms and `src/games/_shared/online/useOnlineRoom.ts` with `withTicks: true` (same path Hexaman uses); add `"bomber"` to the `GameSlug` union and to the server-side allowed-slug list in `src/lib/mp/cloud.server.ts`.
- Deterministic map: the engine currently builds soft blocks and power-ups with `Math.random()`. Add a seeded RNG to `src/games/bomber/components/engine.ts` and pass the seed through room `settings`, so every client generates an identical grid. CPU bombers are disabled in online mode.
- Position sync: each client pushes its own bomber position/direction/alive state on the existing tick channel (~260ms) and interpolates remote bombers between ticks so movement looks smooth.
- Event sync: bomb drops, remote detonations, power-up pickups and deaths go through the move channel as small payloads (`{kind: "bomb", x, y, power}` etc.) so blasts resolve the same way on every device; each client simulates only its own bomber's input, remote bombers follow their ticks.
- End of match: when one bomber remains (or the timer expires) the host calls `finishRoom` + `saveStats`, and the shared `MatchResultDialog` shows the stats; the win is reported to the leaderboard under a `bomber` slug.
- Start screen: add the shared `OnlinePanel` to `BomberGame.tsx` under the existing multiplayer section, wired to `useOnlineRoom`.
- Typecheck with `bunx tsgo --noEmit` when done.

## Note

Real-time action over the current polling channel will have a short delay (roughly a quarter second) on remote players' movement. Bombs and blasts stay consistent because they are event-based, but remote bombers will look slightly behind. If that feels too laggy in play, the next step would be switching the tick channel to a live realtime socket instead of polling.
