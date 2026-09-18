/**
 * Some in-app browsers (Nimiq Pay's WebView) drop the session cookie, so the
 * signed-in wallet is also tracked with a token kept in localStorage and sent
 * as a header on every server function call.
 */
const STORAGE_KEY = "nimiqvalley.player-token";

export const PLAYER_TOKEN_HEADER = "x-player-token";

export function readPlayerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writePlayerToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
