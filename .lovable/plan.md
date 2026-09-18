# Fix: buying match keys gets stuck on "Waiting for the payment…"

## What happens now

Buying keys runs three steps in one go, with no time limit and no status text:

1. The wallet is asked to send the NIM payment.
2. The app sends the wallet's reply to the server to turn it into a payment ID.
3. The server checks the payment on the Nimiq network and adds the keys.

Step 2 uses the same Nimiq crypto engine that already failed to start on the
server during login (it was replaced with a pure-JavaScript version there, but
this purchase path still uses the old one). When that engine does not start,
the request never comes back, so the shop spins forever with no error.

Step 3 is also too strict for a fresh payment: it demands the transaction to be
already confirmed in a block, which is never true one second after paying.

## The fix

1. Drop the broken crypto step from the purchase flow. After the wallet
   approves, the app tells the server "this wallet just paid X NIM for Y keys",
   and the server looks the payment up directly on the Nimiq network by reading
   recent transactions of the player's address.
2. The server accepts the newest transaction from the player's wallet to the
   NimiqValley address with at least the expected amount, sent in the last 15
   minutes and not already used. Its network hash is stored, so one payment can
   never be redeemed twice.
3. The server retries the lookup for up to about 40 seconds while the payment
   confirms, instead of failing instantly on a pending transaction.
4. Every step gets a time limit and clear on-screen status: "Approve the payment
   in your wallet", then "Confirming payment…", then success or a real error
   message. Nothing can spin forever.

The same fix covers the AI chat packs and room credits, which use the identical
purchase flow.

## Technical notes

- `src/lib/wallet.ts`: `payNim` stops calling `transactionHash()`; it returns the
  raw wallet response and wraps the wallet call in a 3-minute timeout.
- `src/lib/tx.functions.ts` is removed from the purchase path (no `@nimiq/core/web`
  WASM on the worker).
- `src/lib/credits.server.ts`: replace `lookupTx(hash)` with
  `findRecentPayment(wallet, expectedNim)` against `https://rpc.nimiqwatch.com`
  (`getTransactionsByAddress`), filtering on recipient `PAY_TO_ADDRESS`, value
  >= expected, timestamp within 15 minutes, and `tx_hash` not present in
  `nim_payments`; poll up to ~40s (2s interval) before giving up.
- `src/lib/credits.functions.ts` / `redeemPayment` input: `txHash` becomes
  optional; add the pack fields already present. Dedupe still keyed on the
  hash returned by the network lookup.
- `src/hooks/useCredits.tsx`: expose a `phase` ("approving" | "confirming") so
  the dialogs can show accurate status.
- `src/components/KeyShopDialog.tsx` (and the chat credits UI): status text per
  phase, visible error, and the dialog stays closable while pending.
