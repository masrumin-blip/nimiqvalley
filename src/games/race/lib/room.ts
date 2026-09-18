const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeRoomCode(): string {
  let out = "";
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return out;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export function roomCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URL(window.location.href).searchParams.get("room");
  return code ? normalizeRoomCode(code) : null;
}

export function setRoomInUrl(code: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  window.history.replaceState(null, "", url);
}
