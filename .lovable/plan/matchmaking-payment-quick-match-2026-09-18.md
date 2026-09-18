# Matchmaking Payment (Quick Match)

Concept matchmaking (shared queue per game, skill window widening every 10s, 60s cap) stays as already built. This plan only adds how paying for it works.

## Recommended model: Match Ticket

One ticket = one quick match, for both players.

- Ticket packs (cheaper in bulk), bought with NIM like chat packs:
  - 25 NIM = 1 ticket
  - 250 NIM = 10 tickets
- Daily reward bisa digunakan untuk room atau matchmaking ubah aturan dibawah mengikuti alur ini

## Payment rules

- Ticket is charged **when the match actually starts** (two players paired), never when entering the queue.
- Cancel the search, no opponent within 60s, or opponent never shows: nothing is charged.
- Disconnect or leave mid-match = loss, opponent gets the payout.
- Draw or match voided by a server error: both tickets returned.
- Payout is credited as **NIM balance in the app** (withdrawable later), not an on-chain transfer per match — keeps it instant and fee-free.
- Room creation stays 25 NIM, joining a room stays free, so friend matches never cost the invited player.

## What the player sees

- Quick match panel gets two buttons: `Casual — free` and `Ranked — 1 ticket`.
- Ticket count shown next to the button, with a Buy tickets dialog (same style as chat packs).
- Result popup shows the payout line: `+16 NIM` or `-10 NIM`.
- A small Wallet panel in the main menu: NIM balance, tickets, and a Withdraw button.

## Technical notes

- New table `mp_tickets` ledger (wallet, delta, reason, room_id, created_at) plus `ticket_credits` and `nim_balance` columns added to `wallet_credits`.
- `mp_queue` gains a `mode` column (`casual` | `ranked`); pairing only matches same mode.
- Charging happens inside the existing pairing step in `src/lib/mp/cloud.server.ts` (where the oldest entry creates the room), inside one transaction: debit both, write ledger rows, record `stake` on the room.
- Payout happens in `finishRoom`: credit the winner, write ledger rows, mark the room settled (idempotent via a `settled_at` flag so retries can't double-pay).
- Ticket purchase reuses the existing NIM payment flow (`redeemPayment`, tx-hash uniqueness check).
- Withdrawal is a separate later step; balance accrues until then.