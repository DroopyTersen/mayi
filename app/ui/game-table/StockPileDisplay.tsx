import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { CARD_DIMENSIONS, type CardSize } from "~/ui/playing-card/playing-card.constants";
import { cn } from "~/shadcn/lib/utils";

interface StockPileDisplayProps {
  isClickable?: boolean;
  onClick?: () => void;
  size?: CardSize;
  className?: string;
}

/**
 * Stock pile display showing a facedown card
 */
export function StockPileDisplay({
  isClickable = false,
  onClick,
  size = "md",
  className,
}: StockPileDisplayProps) {
  // We need a dummy card for faceDown rendering
  const dummyCard = { id: "stock", rank: "A" as const, suit: "spades" as const };
  const { width, height } = CARD_DIMENSIONS[size];

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className="text-xs text-muted-foreground font-medium">Draw</span>
      <div
        className="relative"
        style={{ width: width + 4, height: height + 4 }}
      >
        {/* Stack effect - cards behind (using blue to match facedown card) */}
        <div
          className="absolute bg-blue-800 rounded-lg border border-blue-900 pointer-events-none"
          style={{ width, height, top: 0, left: 0 }}
        />
        <div
          className="absolute bg-blue-700 rounded-lg border border-blue-800 pointer-events-none"
          style={{ width, height, top: 2, left: 2 }}
        />
        {/* Top facedown card - handles all click interaction */}
        <div className="absolute" style={{ top: 4, left: 4 }}>
          <PlayingCard
            card={dummyCard}
            size={size}
            faceDown
            onClick={isClickable ? onClick : undefined}
            className={cn(
              isClickable && "ring-2 ring-primary ring-offset-2 hover:ring-offset-4"
            )}
          />
        </div>
      </div>
    </div>
  );
}
