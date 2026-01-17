import { useCallback, useState, useEffect, useRef } from "react";
import type { Card } from "core/card/card.types";
import { MayIRequestView } from "./MayIRequestView";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "~/shadcn/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface MayIPromptDialogProps {
  open: boolean;
  callerName: string;
  card: Card;
  canMayIInstead: boolean;
  /** Whether the prompted player is the current turn player (affects button text) */
  isCurrentPlayer?: boolean;
  onAllow: () => void;
  onMayIInstead: () => void;
  onOpenChange?: (open: boolean) => void;
}

/** Auto-allow timeout in seconds (per house rules: 60 seconds) */
export const AUTO_ALLOW_SECONDS = 60;

export function MayIPromptDialog({
  open,
  callerName,
  card,
  canMayIInstead,
  isCurrentPlayer,
  onAllow,
  onMayIInstead,
  onOpenChange,
}: MayIPromptDialogProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(AUTO_ALLOW_SECONDS);

  // Store callback in ref to prevent effect dependency issues
  const onAllowRef = useRef(onAllow);
  useEffect(() => {
    onAllowRef.current = onAllow;
  }, [onAllow]);

  // Store start time in ref for deterministic countdown calculation
  const startTimeRef = useRef<number | null>(null);

  // Countdown timer using start-time tracking for stability
  // This prevents timer restarts when parent re-renders with new callback refs
  useEffect(() => {
    if (!open) {
      startTimeRef.current = null;
      setSecondsRemaining(AUTO_ALLOW_SECONDS);
      return;
    }

    // Capture start time once when dialog opens
    startTimeRef.current = Date.now();
    setSecondsRemaining(AUTO_ALLOW_SECONDS);

    const interval = setInterval(() => {
      if (!startTimeRef.current) return;

      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = AUTO_ALLOW_SECONDS - elapsed;

      if (remaining <= 0) {
        onAllowRef.current();
        clearInterval(interval);
        setSecondsRemaining(0);
      } else {
        setSecondsRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [open]); // Only depends on `open`, not on callback

  const handleAllow = useCallback(() => {
    onAllow();
  }, [onAllow]);

  const handleMayIInstead = useCallback(() => {
    onMayIInstead();
  }, [onMayIInstead]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 bg-transparent border-none shadow-none">
        <VisuallyHidden>
          <DialogTitle>May I Request</DialogTitle>
          <DialogDescription>
            {callerName} wants to pick up the discard
          </DialogDescription>
        </VisuallyHidden>
        <MayIRequestView
          requesterName={callerName}
          discardCard={card}
          canMayIInstead={canMayIInstead}
          isCurrentPlayer={isCurrentPlayer}
          timeoutSeconds={secondsRemaining}
          onAllow={handleAllow}
          onMayIInstead={handleMayIInstead}
        />
      </DialogContent>
    </Dialog>
  );
}
