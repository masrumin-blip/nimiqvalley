/**
 * Tiny registry so the in-game frame knows which online room the player sits in.
 * The online hooks publish here; GameFrame and the in-game chat read from it.
 */
export interface ActiveRoomHandle {
  /** Shareable room code, when the room has one. */
  code: string | null;
  /** Leaves the room on the server (fire and forget). */
  leave: () => void | Promise<unknown>;
}

let current: ActiveRoomHandle | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function setActiveRoom(next: ActiveRoomHandle | null) {
  const same =
    (current === null && next === null) ||
    (current !== null && next !== null && current.code === next.code);
  current = next;
  if (!same) emit();
  else current = next;
}

export function getActiveRoom(): ActiveRoomHandle | null {
  return current;
}

export function subscribeActiveRoom(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Leaves the current online room, if any. Safe to call anywhere. */
export async function leaveActiveRoom() {
  const handle = current;
  if (!handle) return;
  current = null;
  emit();
  try {
    await handle.leave();
  } catch {
    /* leaving is best effort */
  }
}
