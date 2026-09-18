# Match keys for online play

Online matchmaking becomes key-gated. A key is spent every time a player enters an online match — quick match, creating a room, or joining one. Keys come from the daily X-visit task (2 per day) or can be bought for 20 NIM each.

## How it works for players

- The main menu daily reward now asks the player to visit both X accounts (x.com/nimiq and x.com/nimiqvalley) and grants **2 match keys** per day, alongside the existing chat messages and room passes.
- Every online panel (Soccer, Checkers, Carrom, Hexaman) shows the key balance at the top: "X keys left".
- Quick match, Create room each require 1 key. join room 0 keys, those buttons are disabled and a "Buy 1 key — 20 NIM" button appears.
- Buying keys uses the same NIM wallet payment flow already used for chat packs and room passes; the payment goes to the existing valley address and each payment can only be used once.
- Creating a room still also costs its 25 NIM room pass, unchanged. Joining by code stays free of NIM but now costs 1 key.
- Accepting a friend challenge also spends 1 key (it is an online entry).
- If a quick-match search is cancelled before an opponent is found, the key is returned.

## Technical notes

**Database (one additive migration)**

- `wallet_credits`: add `match_keys integer not null default 0`.
- `nim_payments.kind` gains a `'key'` value (kind is free-text today, no constraint change needed); add `key_credits integer not null default 0`.

**Server**

- `src/lib/credits.ts`: add `KEY_COST_NIM = 20`, `DAILY_REWARD.keys = 2`, `matchKeys` on `CreditState`.
- `src/lib/credits.server.ts`: read/return `matchKeys`; add `spendKey(wallet)` (throws a clear "You need a match key" error) and `refundKey(wallet)`; extend `grant()` and `redeemPayment()` to handle `kind: 'key'` with expected amount `rooms * 20`; `claimDaily` grants 2 keys.
- `src/lib/mp/cloud.server.ts`: call `spendKey` at the start of `joinQueue`, `createRoom`, `joinByCode`, `respondInvite(accept)`; call `refundKey` in `leaveQueue` when the player leaves without a room.
- `src/lib/soccer/cloud.server.ts`: same guard in `quickMatch`, `createMatch`, `joinRoom`, `respondInvite(accept)`.

**Client**

- `src/hooks/useCredits.ts`: add `buyKeys` mutation (pays `count * KEY_COST_NIM`, `kind: 'key'`).
- `src/games/_shared/online/OnlinePanel.tsx`: show key balance, disable entry actions at 0 keys, show the buy-key button, surface the server's "need a key" error.
- `src/components/DailyRewardDialog.tsx`: mention and display the 2 match keys.

All new UI copy stays in English.