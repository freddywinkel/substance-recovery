/**
 * Haptic feedback utility for mobile PWA.
 * Respects prefers-reduced-motion. Only vibrates on supported devices.
 */
function shouldVibrate(): boolean {
  if (typeof navigator === "undefined" || !navigator.vibrate) return false;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  return true;
}

export function hapticLight() {
  if (!shouldVibrate()) return;
  navigator.vibrate(8);
}

export function hapticSuccess() {
  if (!shouldVibrate()) return;
  navigator.vibrate([8, 40, 8]);
}
