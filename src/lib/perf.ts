/** True on touch/phone devices, where we trade visual extras for a smooth frame rate. */
export function isLowPowerDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}
