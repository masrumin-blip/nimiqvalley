/**
 * Shared clock for online games.
 * Every room/match poll reports the server time, so all clients count down
 * from the same reference instead of their own (possibly skewed) device clock.
 */
let offsetMs = 0;

export function setServerOffset(iso: string | null | undefined) {
  if (!iso) return;
  const server = Date.parse(iso);
  if (!Number.isFinite(server)) return;
  offsetMs = server - Date.now();
}

/** Current time in server terms. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}
