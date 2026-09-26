# Leagues — Retro Arcade Arena Look (visual only)

Only the look changes. Features, data, payments and rules stay exactly the same.

## Pages
1. **League list (/leagues)** — "Tournament Hall"
   - Big arcade title with a glowing trophy and a subtitle styled like a "credits" line.
   - A "Create league" button that looks like a real arcade button and presses down when tapped.
   - League cards that look like arcade cabinets: a colored bar on the left for the status (Live pulses, Upcoming, Waiting for prize pool, Ended dimmed), the prize pool shown as a large number, and small chips for the game, prize split and host.
   - A dashed "Insert coin" panel when there are no leagues yet, and shimmering placeholder cards while loading.

2. **Create league (/leagues/new)** — "Setup Console"
   - The 4 steps become numbered panels (01–04) with pixel-style headers.
   - The selected game card gets a glowing border and a check mark.
   - The prize split and currency choices become pill switches that are easy to tap on phones.
   - The submit button uses the same press-down arcade style.

3. **League detail (/leagues/$id)** — "Scoreboard"
   - A hero panel with the status, a large prize pool and the schedule.
   - The ranking looks like an arcade high-score table: gold, silver and bronze rows for the top 3, a monospace score column, and your own row highlighted.
   - Existing buttons (fund, play, claim) keep their actions and only get restyled.

## Technical details
- Only className/JSX layout edits in `leagues.index.tsx`, `leagues.new.tsx`, `leagues.$id.tsx`.
- A few reusable utilities (`arcade-btn`, `arcade-panel`, glow) are added in `src/styles.css` using the existing color tokens. No hardcoded colors.
- No changes to server functions, queries, state, handlers or the database.
- Check on a phone-sized screen with Playwright once it's built.
