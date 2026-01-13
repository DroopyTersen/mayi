import type { Card } from "core/card/card.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { CARD_DIMENSIONS, type CardSize } from "~/ui/playing-card/playing-card.constants";
import { cn } from "~/shadcn/lib/utils";

type InteractiveLabel = "pickup" | "may-i";

interface DiscardPileDisplayProps {
  topCard: Card | null;
  onClick?: () => void;
  isClickable?: boolean;
  size?: CardSize;
  /** Shows a targeting overlay with label for touch interaction */
  interactiveLabel?: InteractiveLabel;
  className?: string;
}

const LABEL_TEXT: Record<InteractiveLabel, string> = {
  pickup: "Pickup",
  "may-i": "May I?",
};

export function DiscardPileDisplay({
  topCard,
  onClick,
  isClickable = false,
  size = "md",
  interactiveLabel,
  className,
}: DiscardPileDisplayProps) {
  const { width, height } = CARD_DIMENSIONS[size];
  const hasInteractiveLabel = Boolean(interactiveLabel && onClick);
  const showClickableRing = isClickable && onClick && !hasInteractiveLabel;
  // Show disabled state when there's no way to interact with the pile
  const isDisabled = !onClick;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className="text-xs text-muted-foreground font-medium">Discard</span>

      {!topCard ? (
        <div
          className="border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center text-muted-foreground text-xs"
          style={{ width: width + 4, height: height + 4 }}
        >
          Empty
        </div>
      ) : (
        <div
          className="relative"
          style={{
            width: width + 4,
            height: height + 4,
            filter: isDisabled ? "saturate(0.3)" : undefined,
            cursor: isDisabled ? "not-allowed" : undefined,
          }}
        >
          {/* Stack effect - back cards */}
          <div
            className="absolute bg-slate-300 rounded-lg border border-slate-400 pointer-events-none"
            style={{ width, height, top: 0, left: 0 }}
          />
          <div
            className="absolute bg-slate-200 rounded-lg border border-slate-300 pointer-events-none"
            style={{ width, height, top: 2, left: 2 }}
          />

          {/* Top card - handles all click interaction */}
          <div className="absolute" style={{ top: 4, left: 4 }}>
            <PlayingCard
              card={topCard}
              size={size}
              onClick={onClick}
              className={cn(
                showClickableRing && "ring-2 ring-primary ring-offset-2 hover:ring-offset-4"
              )}
            />
          </div>

          {/* Interactive ring indicator (for pickup/may-i) */}
          {hasInteractiveLabel && interactiveLabel && (
            <div
              className="absolute pointer-events-none"
              style={{ top: 4, left: 4, width, height }}
            >
              {/* Colored ring around card */}
              <div
                className={cn(
                  "absolute inset-0 rounded-lg ring-2",
                  interactiveLabel === "may-i" ? "ring-amber-500" : "ring-blue-500"
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Interactive label below the card (not covering it) */}
      {hasInteractiveLabel && interactiveLabel && (
        <span
          className={cn(
            "px-2 py-0.5 text-xs font-bold rounded shadow-sm",
            interactiveLabel === "may-i"
              ? "bg-amber-500 text-white"
              : "bg-blue-500 text-white"
          )}
        >
          {LABEL_TEXT[interactiveLabel]}
        </span>
      )}
    </div>
  );
}
