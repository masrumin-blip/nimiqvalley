# Arena Chat: profanity and spam protection

## What will change
- Apply moderation to both **Global Chat** and **Direct Messages** on the server, so it cannot be bypassed from the browser.
- Reject messages containing common Indonesian or English profanity, including simple disguises using capitalization, repeated characters, spaces, or punctuation.
- Use progressive penalties for profanity:
  1. First violation: reject the message and show a warning.
  2. Second violation within 24 hours: reject it and mute sending for 5 minutes.
  3. Third and later violations within 24 hours: reject it and mute sending for 1 hour.
- Add strict spam protection: at most **3 messages per 10 seconds** across Global and DM combined, and reject repeated identical or near-identical messages. A spam violation triggers a 5-minute sending cooldown.
- Show a clear English error below the message box explaining whether the message was blocked, how many warnings remain, or how long the mute lasts.
- Keep rejected messages out of chat history and private conversations.

## Technical details
- Add shared normalization and profanity detection for case, separators, repeated letters, and common character substitutions without accidentally matching profanity inside ordinary words.
- Add a private moderation-state table keyed by wallet for violation count, time window, and mute expiry. Grant access only to the service role, enable row-level security, and expose no public read policy.
- Enforce checks immediately before each Global or DM insert. Use persisted timestamps rather than in-memory limits so protection works across server instances and refreshes.
- Derive spam activity from recent Global and DM rows, then record progressive moderation state atomically enough to prevent rapid parallel submissions from bypassing the limit.
- Preserve the current Arena layout and message composer; only existing error feedback changes.

## Verification
- Check clean Global and DM messages still send normally.
- Check Indonesian/English profanity and obfuscated variants are rejected at each penalty stage.
- Check the fourth rapid message, duplicate-message spam, active mutes, and expiry behavior.
- Confirm no rejected text appears in either conversation history and existing chat/profile/friend behavior remains unchanged.
