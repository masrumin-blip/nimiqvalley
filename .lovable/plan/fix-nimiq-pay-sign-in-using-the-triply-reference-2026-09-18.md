# Fix Nimiq Pay sign-in using the Triply reference

## What the reference app does

FlowFiApp/Triply signs in through Nimiq Pay with a much simpler flow than ours:

1. Ask the wallet to sign the **plain text** message: `nimiq.sign(message)` — no hashing, no hex, no `isHex` flag.
2. On the server, rebuild exactly one byte form: `"\x16Nimiq Signed Message:\n" + message.length + message`, SHA-256 it, and verify the Ed25519 signature against that digest.
3. Derive the address from the returned public key and compare it with the claimed address.
4. Accept the public key / signature in hex **or base64** (different hosts return different encodings).

## Why our login fails

Our client currently pre-hashes the message and sends it as hex: `nimiq.sign({ message: sha256Hex(message), isHex: true })`. Nimiq Pay still applies its own prefix + hash on top of that hex string, so the server's `pay-hex-v1` check (plain `sha256(message)`) can never match. Every attempt ends in "The wallet signature could not be verified."

## Changes

**src/lib/wallet.ts**
- `signNimiqMessage` sends the plain message string to `nimiq.sign(message)` and returns `{ publicKey, signature }` unchanged.
- Drop the `pay-hex-v1` scheme entirely; both Nimiq Pay and the browser wallet use the same single scheme.
- Keep the existing wallet-error handling (rejected/unsupported responses).

**src/lib/auth.functions.ts**
- Remove the `scheme` field from the input schema; relax the public key / signature validators to accept hex or base64 and decode accordingly.
- Verify with one formula only: SHA-256 of `"\x16Nimiq Signed Message:\n" + <length> + message`, checked with `@nimiq/core/web` (`PublicKey.verify`). Since the login message is ASCII, character length and byte length are identical; keep the byte-length computation.
- Keep address-from-public-key matching, the single-use 5 minute challenge, and anti-replay.
- Keep the login message ASCII-only so the length prefix is unambiguous.

**src/hooks/usePlayer.tsx**
- Adjust the call site for the simplified signature payload (no scheme).

## Verification

- `bunx tsgo --noEmit` and a production build.
- Mobile-viewport Playwright pass on the sign-in screen (no console errors).
- Publish, then you test the real sign-in inside Nimiq Pay.

## Notes

- No database change needed; the `wallet_login_challenges` table stays as is.
- `@nimiq/core/web` remains the import used on the server (the bundler build breaks the Worker build).
