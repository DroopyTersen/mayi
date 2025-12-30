import type { Card } from "core/card/card.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

interface MayIRequestViewProps {
  requesterName: string;
  discardCard: Card;
  canMayIInstead: boolean;
  timeoutSeconds?: number;
  onAllow: () => void;
  onMayIInstead: () => void;
  className?: string;
}

export function MayIRequestView({
  requesterName,
  discardCard,
  canMayIInstead,
  timeoutSeconds,
  onAllow,
  onMayIInstead,
  className,
}: MayIRequestViewProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 p-6 bg-background rounded-lg border shadow-lg",
        className
      )}
    >
      <div className="text-center">
        <h2 className="text-lg font-semibold">May I?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-medium">{requesterName}</span> wants to pick up
          the discard
        </p>
      </div>

      {/* The card they want */}
      <div className="py-2">
        <PlayingCard card={discardCard} size="lg" />
      </div>

      {/* Timeout indicator */}
      {timeoutSeconds !== undefined && timeoutSeconds > 0 && (
        <p className="text-sm text-muted-foreground">
          Auto-allowing in {timeoutSeconds}s...
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onAllow}>
          Allow
        </Button>
        {canMayIInstead && (
          <Button onClick={onMayIInstead}>May I Instead!</Button>
        )}
      </div>

      {!canMayIInstead && (
        <p className="text-xs text-muted-foreground">
          You've already used your May I this round
        </p>
      )}
    </div>
  );
}
