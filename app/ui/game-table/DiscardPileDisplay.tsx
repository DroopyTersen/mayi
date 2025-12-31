import type { Card } from "core/card/card.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { cn } from "~/shadcn/lib/utils";

type InteractiveLabel = "pickup" | "may-i";

interface DiscardPileDisplayProps {
  topCard: Card | null;
  onClick?: () => void;
  isClickable?: boolean;
  size?: "sm" | "md" | "lg";
  /** Shows a targeting overlay with label for touch interaction */
  interactiveLabel?: InteractiveLabel;
  className?: string;
}

const LABEL_TEXT: Record<InteractiveLabel, string> = {
  pickup: "Pickup",
  "may-i": "May I?",
};

// Card dimensions for positioning the stack effect (must match PlayingCard sizes)
const DIMENSIONS = {
  sm: { width: 48, height: 68 },
  md: { width: 64, height: 90 },
  lg: { width: 96, height: 134 },
} as const;

export function DiscardPileDisplay({
  topCard,
  onClick,
  isClickable = false,
  size = "md",
  interactiveLabel,
  className,
}: DiscardPileDisplayProps) {
  const { width, height } = DIMENSIONS[size];
  const hasInteractiveLabel = Boolean(interactiveLabel && onClick);
  const showClickableRing = isClickable && onClick && !hasInteractiveLabel;

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
          style={{ width: width + 4, height: height + 4 }}
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

          {/* Interactive overlay and label (for pickup/may-i) */}
          {hasInteractiveLabel && interactiveLabel && (
            <div
              className="absolute flex items-center justify-center pointer-events-none"
              style={{ top: 4, left: 4, width, height }}
            >
              {/* Semi-transparent overlay */}
              <div
                className={cn(
                  "absolute inset-0 rounded-lg",
                  interactiveLabel === "may-i" ? "bg-amber-500/20" : "bg-blue-500/20"
                )}
              />

              {/* Label button on top */}
              <span
                className={cn(
                  "relative z-10 px-2 py-0.5 text-xs font-bold rounded shadow-sm",
                  interactiveLabel === "may-i"
                    ? "bg-amber-500 text-white"
                    : "bg-blue-500 text-white"
                )}
              >
                {LABEL_TEXT[interactiveLabel]}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
