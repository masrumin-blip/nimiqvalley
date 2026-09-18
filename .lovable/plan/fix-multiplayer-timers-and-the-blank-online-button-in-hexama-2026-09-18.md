# Fix multiplayer timers and the blank Online button in Hexaman

Two separate issues, both small and contained.

## 1. Timers differ between players

Today each game counts down using the phone's own clock:

- Soccer and Carrom start the turn countdown the moment the browser notices a new turn, so a player with a slower connection gets a shorter or longer turn.
- Hexaman and Bomber compare the round end time with the device clock, so a phone whose clock is a few seconds off shows a different remaining time.

Fix: the server becomes the single source of time.

- Every room/match fetch also returns the server's current time.
- The client stores the difference between the server time and its own clock and uses a corrected "now" for all countdowns.
- Turn countdowns are computed from the turn start timestamp that the server already stores, not from when the client noticed the turn. Carrom and Soccer switch to this, the same way Checkers already does.
- Round countdown in Hexaman and Bomber uses corrected time against the room end time.

Result: all players see the same number, within a fraction of a second.

## 2. Hexaman "Online" button appears empty

The button on the Ready screen uses the plain outline style, whose text colour disappears against the dark neon backdrop, so the button looks like an empty pill.

Fix: give it the same explicit neon text and border colours used by the Start button so the word "Online" is readable, and keep the touch height at the standard 44px.

## Technical details

- `src/lib/mp/cloud.server.ts` `fetchRoom` and `src/lib/soccer/cloud.server.ts` `fetchMatch`: include `serverNow: new Date().toISOString()` in the response; add to the return types in `src/lib/mp/types.ts` / `src/lib/soccer/types.ts`.
- New tiny helper `src/lib/mp/clock.ts`: `setServerOffset(iso)` / `serverNow()` keeping a module-level offset.
- `useOnlineRoom.ts` and `useOnlineSoccer.ts`: call `setServerOffset(res.serverNow)` on each poll.
- `SoccerGame.tsx` (lines ~208, 244, 347, 358): drop `turnStartRef = Date.now()`; compute `left = TURN_TIMEOUT_MS - (serverNow() - Date.parse(match.turnStartedAt))`.
- `CarromGame.tsx` (~379): replace the fixed `setTimeout(..., TURN_TIMEOUT_MS)` for online turns with the same server-anchored remaining-time calculation.
- `HexamanGame.tsx` (~317) and `BomberGame.tsx` (~299): `timeUp = room.endsAt ? serverNow() > Date.parse(room.endsAt) : false`, and the on-screen round clock uses the same source.
- `HexamanGame.tsx` (~997-1003): replace `variant="outline"` styling with explicit `border-primary/60 text-primary` classes plus `h-11`.
