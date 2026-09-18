# Fix Nimiq Pay sign-in ("The wallet signature is invalid")

## What is happening

Sign-in inside Nimiq Pay now reaches the wallet, the user approves the signature,
and the app still rejects it. The failure is in the app's own signature check,
not in the wallet.

The login check currently compares the signature against three plain-text forms
of the login message. Nimiq wallets do not sign the plain text: they sign a
hashed, prefixed form of it. Because that form is not among the three the app
tries, every approved signature is judged invalid.

## The fix

1. Accept every signing form a Nimiq wallet can produce for the same login
   message, including the hashed prefixed form used by Nimiq Pay and the Nimiq
   browser wallet, instead of only the three plain-text forms.
2. Keep every security guarantee already in place: the key must belong to the
   address, the challenge must be unused and unexpired, and the challenge is
   consumed once used.
3. Add a short-lived server-side note of which form matched (no addresses, no
   signatures) so we can confirm the real device path once, then rely on it.
4. Show a clearer message if a signature is genuinely rejected, separating
   "wrong wallet" from "signature check failed".

## Technical notes

- File: `src/lib/auth.functions.ts`, verification block around lines 59-81.
- Candidate payloads to verify against, in order:
  - `sha256("\u0016Nimiq Signed Message:\n" + len + message)` (Keyguard / Hub form)
  - `sha256("\u0016Nimiq Signed Message:\n" + message)`
  - `sha256(message)`
  - the three existing raw-byte forms (kept as fallback)
- Hashing via Web Crypto `crypto.subtle.digest("SHA-256", ...)`, which is
  available in the Worker runtime; `PublicKey.verify` takes the 32-byte digest.
- `@nimiq/core/web` stays the verification library; no schema or migration
  change is needed.
- Verify with `bunx tsgo --noEmit`, a production build, and a final real-device
  test in Nimiq Pay after publishing (only a real device can exercise the Pay
  signing path).
