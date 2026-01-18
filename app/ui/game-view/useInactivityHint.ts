import { useCallback, useEffect, useState } from "react";
import { shouldShowInactivityHint } from "./inactivity-hint.logic";

interface UseInactivityHintOptions {
  isEnabled: boolean;
  message: string | null;
  activityKey: number;
  delayMs?: number;
}

interface UseInactivityHintResult {
  isVisible: boolean;
  message: string | null;
  dismiss: () => void;
}

export function useInactivityHint({
  isEnabled,
  message,
  activityKey,
  delayMs = 30000,
}: UseInactivityHintOptions): UseInactivityHintResult {
  const [lastActivityAtMs, setLastActivityAtMs] = useState(() => Date.now());
  const [isVisible, setIsVisible] = useState(false);

  const dismiss = useCallback(() => {
    setLastActivityAtMs(Date.now());
    setIsVisible(false);
  }, []);

  useEffect(() => {
    setLastActivityAtMs(Date.now());
    setIsVisible(false);
  }, [activityKey]);

  useEffect(() => {
    if (isEnabled) {
      setLastActivityAtMs(Date.now());
      setIsVisible(false);
    }
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled || !message) {
      setIsVisible(false);
      return;
    }

    const nowMs = Date.now();
    if (
      shouldShowInactivityHint({
        isEnabled,
        message,
        lastActivityAtMs,
        nowMs,
        delayMs,
      })
    ) {
      setIsVisible(true);
      return;
    }

    const remainingMs = Math.max(delayMs - (nowMs - lastActivityAtMs), 0);
    const timeoutId = setTimeout(() => {
      setIsVisible(true);
    }, remainingMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [delayMs, isEnabled, lastActivityAtMs, message]);

  return {
    isVisible,
    message: isVisible ? message : null,
    dismiss,
  };
}
