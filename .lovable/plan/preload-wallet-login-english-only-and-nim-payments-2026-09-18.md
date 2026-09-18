# Preload, wallet login, English-only, and NIM payments

## 1. Download everything on open

A boot screen appears when the app opens and downloads every game's code, cover art, and images before the menu shows. A progress bar with a percentage and the current step is visible; if one file fails, loading continues instead of stopping. Once finished, opening any game starts instantly with no loading.

The boot screen only runs once per visit; assets stay cached afterwards.

## 2. Login right at the start, two wallet options

Login is asked immediately after the boot screen, before the main menu. Two ways to sign in:

- **Nimiq Pay** — used automatically when the app runs inside Nimiq Pay (mini app mode).
- **Nimiq browser wallet (Nimiq Hub)** — for anyone opening the app in a normal browser: a popup asks the player to choose an address and sign the login message.

Both paths end the same way: the address becomes the player identity, the signature is checked on the server, and the session is remembered on the device. Display name (max 16 characters) stays as it is today.

## 3. English only

Every visible text in the app becomes English: menus, buttons, dialogs, game overlays, error messages, empty states. The AI characters also always reply in English, instead of matching the visitor's language.

## 4. Paying with NIM

All payments go to `NQ79 MC3X FDQK 6T5S 7T0Q 60TS B1DH BUHV RN2R` through the wallet's own approval dialog. After the transaction is confirmed, credits are added to the player's balance on the server, and each transaction hash can only be used once.

**AI chat**

- 3 free messages per day for everyone (resets daily).
- Packs: 100 NIM = 10 messages, 250 NIM = 30 messages, 500 NIM = 75 messages.
- The chat screen shows the remaining balance and offers the packs when it runs out.

**Multiplayer rooms**

- Creating a room (Soccer, Checkers, Carrom, Hexaman) costs 25 NIM.
- Joining someone else's room stays free, so one payment covers a whole match.

**Daily free claim (main menu)**

- A "Daily Reward" button on the main menuthen.
- The player opens x.com/nimiq and x.com/nimiqvalley (both must be opened),  confirms the claim.
- Reward: 2 free room creations + 3 extra AI messages, once per day per wallet.
- A countdown shows when the next claim unlocks.

## 5. Matchmaking recommendation

Quick match today only pairs whoever is waiting. Suggested improvement, included in this work:

- One shared waiting queue per game instead of per-room searching; the server pairs the two longest-waiting players.
- Skill-aware pairing: match players within a leaderboard-rank window first, widening the window every 10 seconds so nobody waits forever.
- A 60-second wait cap; after that the player is offered a CPU match or to create a room instead.
- The queue costs nothing to join — the 25 NIM applies only to creating a private room — so quick match stays the busiest, fastest path.
- Stale entries are cleared after 90 seconds without a heartbeat, so the queue never shows ghost players.

## Technical notes

- `src/lib/preload.ts` already globs game modules; the boot screen mounts in `AppPreloader` and blocks render until tasks finish, with a `sessionStorage` flag to skip repeats.
- Login adds a Hub path in `src/lib/wallet.ts` (`@nimiq/hub-api`, `signMessage` via popup) alongside the existing mini-app `init()`; `signInWithWallet` verifies both signature shapes with `@nimiq/core` public-key verification before creating the session.
- New tables: `wallet_credits` (wallet, chat_credits, room_credits, free_chats_used_on, updated_at), `nim_payments` (tx_hash unique, wallet, kind, amount, credits, created_at), `daily_claims` (wallet, claim_date unique per wallet), `mp_queue` (game_slug, wallet, rank_hint, joined_at) — all RLS-enabled with explicit GRANTs, writes only through server functions.
- New server functions in `src/lib/credits.functions.ts`: `getCredits`, `redeemPayment` (verifies the tx on the Nimiq network: recipient, amount, and not yet redeemed), `claimDaily`, plus credit checks inside `/api/chat` and `mp.functions.ts` room creation.
- Matchmaking uses `mp_queue` with a `joinQueue` / `pollQueue` / `leaveQueue` trio; pairing runs server-side inside `pollQueue`.
- `src/lib/characters.ts` system prompt switches the language rule to English-only.