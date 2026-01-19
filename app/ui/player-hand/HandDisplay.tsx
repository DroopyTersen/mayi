import type { Card } from "core/card/card.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { cn } from "~/shadcn/lib/utils";

type CardSize = "sm" | "md" | "lg";

interface HandDisplayProps {
  cards: Card[];
  selectedIds?: Set<string>;
  onCardClick?: (cardId: string) => void;
  /** Card size - "auto" uses container queries to pick size based on available width */
  size?: CardSize | "auto";
  className?: string;
}

// Overlap amounts for each size (negative margin)
const OVERLAP = {
  sm: "-ml-6",
  md: "-ml-8",
  lg: "-ml-10",
} as const;

// Hand size tiers based on card count
type HandSizeTier = "normal" | "large" | "huge";

export function getHandSizeTier(cardCount: number): HandSizeTier {
  if (cardCount > 20) return "huge";
  if (cardCount > 14) return "large";
  return "normal";
}

// Overlap classes per tier, using container queries
// Each tier has progressively tighter overlap at larger container sizes
// to fit more cards without overflow
//
// Overlap Matrix:
// | Container Width | Normal (1-14) | Large (15-20) | Huge (21+) |
// |-----------------|---------------|---------------|------------|
// | < 400px (sm)    | -ml-5 (20px)  | -ml-6 (24px)  | -ml-7 (28px) |
// | 400-550px (md)  | -ml-8 (32px)  | -ml-8 (32px)  | -ml-10 (40px) |
// | >= 550px (lg)   | -ml-10 (40px) | -ml-14 (56px) | -ml-[72px] |
const OVERLAP_TIERS = {
  normal: "-ml-5 @[400px]:ml-0 @[400px]:-ml-8 @[550px]:ml-0 @[550px]:-ml-10",
  large: "-ml-6 @[400px]:ml-0 @[400px]:-ml-8 @[550px]:ml-0 @[550px]:-ml-14",
  huge: "-ml-7 @[400px]:ml-0 @[400px]:-ml-10 @[550px]:ml-0 @[550px]:-ml-[72px]",
} as const;

// Hover lift amounts proportional to card size
const HOVER_LIFT = {
  sm: "hover:-translate-y-1.5",
  md: "hover:-translate-y-2",
  lg: "hover:-translate-y-3",
} as const;

export function HandDisplay({
  cards,
  selectedIds = new Set(),
  onCardClick,
  size = "auto",
  className,
}: HandDisplayProps) {
  const supportsContainerQueries =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("container-type: inline-size");

  if (cards.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-muted-foreground text-sm italic py-4",
          className
        )}
      >
        <svg
          className="w-5 h-5 opacity-50"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {/* Empty hand icon - stylized cards */}
          <rect
            x="4"
            y="4"
            width="12"
            height="16"
            rx="1"
            strokeDasharray="3 2"
          />
          <rect
            x="8"
            y="4"
            width="12"
            height="16"
            rx="1"
            strokeDasharray="3 2"
          />
        </svg>
        <span>No cards in hand</span>
      </div>
    );
  }

  // Fixed size mode - use explicit size with standard overlap
  if (size !== "auto") {
    return (
      <div className={cn("flex items-end", className)}>
        {cards.map((card, index) => {
          const isSelected = selectedIds.has(card.id);
          return (
            <div
              key={card.id}
              className={cn(
                index > 0 && OVERLAP[size],
                "transition-transform",
                HOVER_LIFT[size],
                // Selected cards stay slightly lifted
                isSelected && "-translate-y-1"
              )}
              style={{ zIndex: index }}
            >
              <PlayingCard
                card={card}
                size={size}
                selected={isSelected}
                onClick={onCardClick ? () => onCardClick(card.id) : undefined}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Auto size mode - uses container queries
  // Container breakpoints (adjusted for better desktop experience):
  // - < 400px: small cards with tight overlap
  // - 400-550px: medium cards
  // - > 550px: large cards (lowered from 700px for bigger cards on desktop)
  //
  // Hand size tiers adjust overlap based on card count:
  // - normal (1-14): standard overlap
  // - large (15-20): tighter overlap at large container size
  // - huge (21+): maximum overlap at all sizes
  const handTier = getHandSizeTier(cards.length);
  const overlapClass = OVERLAP_TIERS[handTier];

  if (!supportsContainerQueries) {
    const fallbackSize: CardSize = cards.length > 14 ? "sm" : "md";
    return (
      <div className={cn("flex items-end", className)}>
        {cards.map((card, index) => {
          const isSelected = selectedIds.has(card.id);
          return (
            <div
              key={card.id}
              className={cn(
                index > 0 && OVERLAP[fallbackSize],
                "transition-transform",
                HOVER_LIFT[fallbackSize],
                isSelected && "-translate-y-1"
              )}
              style={{ zIndex: index }}
            >
              <PlayingCard
                card={card}
                size={fallbackSize}
                selected={isSelected}
                onClick={onCardClick ? () => onCardClick(card.id) : undefined}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn("@container")}
      style={{ containerType: "inline-size" }}
    >
      <div className={cn("flex items-end", className)}>
        {cards.map((card, index) => {
          const isSelected = selectedIds.has(card.id);
          return (
            <div
              key={card.id}
              className={cn(
                "transition-transform",
                // Proportional hover lift based on container size
                "hover:-translate-y-1.5 @[400px]:hover:-translate-y-2 @[550px]:hover:-translate-y-3",
                // Selected cards stay slightly lifted
                isSelected && "-translate-y-1",
                // Tier-based overlap that adjusts for both container size and card count
                index > 0 && overlapClass
              )}
              style={{ zIndex: index }}
            >
              {/* Render all three sizes, show based on container width */}
              <div className="@[550px]:hidden @[400px]:hidden block">
                <PlayingCard
                  card={card}
                  size="sm"
                  selected={isSelected}
                  onClick={onCardClick ? () => onCardClick(card.id) : undefined}
                />
              </div>
              <div className="@[550px]:hidden hidden @[400px]:block">
                <PlayingCard
                  card={card}
                  size="md"
                  selected={isSelected}
                  onClick={onCardClick ? () => onCardClick(card.id) : undefined}
                />
              </div>
              <div className="hidden @[550px]:block">
                <PlayingCard
                  card={card}
                  size="lg"
                  selected={isSelected}
                  onClick={onCardClick ? () => onCardClick(card.id) : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
