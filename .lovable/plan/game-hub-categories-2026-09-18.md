# Game Hub Categories

## Changes
- Add a category selector directly below the Key Shop, Arena Chat, and Leaderboard row.
- Provide three English category choices: **All Games**, **Multiplayer**, and **Just for Fun**.
- Keep **All Games** selected initially and show the existing complete game list.
- Show only these games under **Multiplayer**:
  - Nimiq Soccer
  - Nimiq Checkers
  - Carronimiq
  - Nimiq the Hexaman
  - Nimiq Bomber
- Show only **Nimiq Pet** under **Just for Fun**.
- Preserve the existing two-column game cards and all current header actions.

## Technical details
- Add category metadata to the central game list so filtering remains explicit and maintainable.
- Keep the selected category as local Game Hub state; no backend or game behavior changes.
- Use the existing visual tokens and controls for a compact segmented category selector.
- Verify each category displays the intended cards on mobile and desktop without changing card order or navigation.
