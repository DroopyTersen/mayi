import { useCallback, useState, useEffect } from "react";
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
  onAllow: () => void;
  onMayIInstead: () => void;
  onOpenChange?: (open: boolean) => void;
}

const AUTO_ALLOW_SECONDS = 15;

export function MayIPromptDialog({
  open,
  callerName,
  card,
  canMayIInstead,
  onAllow,
  onMayIInstead,
  onOpenChange,
}: MayIPromptDialogProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(AUTO_ALLOW_SECONDS);

  // Reset timer when dialog opens
  useEffect(() => {
    if (open) {
      setSecondsRemaining(AUTO_ALLOW_SECONDS);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Auto-allow when timer runs out
          onAllow();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, onAllow]);

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
          timeoutSeconds={secondsRemaining}
          onAllow={handleAllow}
          onMayIInstead={handleMayIInstead}
        />
      </DialogContent>
    </Dialog>
  );
}
