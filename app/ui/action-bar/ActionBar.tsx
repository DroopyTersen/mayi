import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

type GamePhase = "draw" | "action" | "waiting";

interface ActionBarProps {
  phase: GamePhase;
  isYourTurn: boolean;
  isDown: boolean;
  hasDrawn: boolean;
  canMayI: boolean;
  onAction: (action: string) => void;
  className?: string;
}

export function ActionBar({
  phase,
  isYourTurn,
  isDown,
  hasDrawn,
  canMayI,
  onAction,
  className,
}: ActionBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 p-3 bg-muted/50 border-t",
        className
      )}
    >
      {/* Draw Phase */}
      {phase === "draw" && isYourTurn && !hasDrawn && (
        <>
          <Button onClick={() => onAction("drawStock")} variant="default">
            Draw Stock
          </Button>
          <Button onClick={() => onAction("pickUpDiscard")} variant="outline">
            Pick Up Discard
          </Button>
        </>
      )}

      {/* Action Phase - Not Down */}
      {phase === "action" && isYourTurn && hasDrawn && !isDown && (
        <>
          <Button onClick={() => onAction("layDown")} variant="default">
            Lay Down
          </Button>
          <Button onClick={() => onAction("discard")} variant="outline">
            Discard
          </Button>
        </>
      )}

      {/* Action Phase - Is Down */}
      {phase === "action" && isYourTurn && hasDrawn && isDown && (
        <>
          <Button onClick={() => onAction("layOff")} variant="default">
            Lay Off
          </Button>
          <Button onClick={() => onAction("swapJoker")} variant="outline">
            Swap Joker
          </Button>
          <Button onClick={() => onAction("discard")} variant="outline">
            Discard
          </Button>
        </>
      )}

      {/* Waiting Phase - May I option */}
      {phase === "waiting" && !isYourTurn && canMayI && (
        <Button onClick={() => onAction("mayI")} variant="secondary">
          May I?
        </Button>
      )}

      {/* Waiting message */}
      {phase === "waiting" && !isYourTurn && !canMayI && (
        <span className="text-sm text-muted-foreground">
          Waiting for other players...
        </span>
      )}

      {/* Organize always available during your turn */}
      {isYourTurn && (
        <Button
          onClick={() => onAction("organize")}
          variant="ghost"
          size="sm"
          className="ml-2"
        >
          Organize
        </Button>
      )}
    </div>
  );
}
