interface InactivityHintVisibilityInput {
  isEnabled: boolean;
  message: string | null;
  lastActivityAtMs: number;
  nowMs: number;
  delayMs: number;
}

export function shouldShowInactivityHint({
  isEnabled,
  message,
  lastActivityAtMs,
  nowMs,
  delayMs,
}: InactivityHintVisibilityInput): boolean {
  if (!isEnabled || !message) {
    return false;
  }

  return nowMs - lastActivityAtMs >= delayMs;
}
