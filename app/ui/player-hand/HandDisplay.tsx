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

// Looser overlap for mobile (when using auto size) - show more of each card
const OVERLAP_MOBILE = {
  sm: "-ml-5", // 20px overlap → 28px visible per card (was -ml-8 = 16px visible)
  md: "-ml-7",
  lg: "-ml-9",
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
  // Container breakpoints:
  // - < 400px: small cards with tight overlap
  // - 400-700px: medium cards
  // - > 700px: large cards
  return (
    <div
      className={cn("@container", className)}
      style={{ containerType: "inline-size" }}
    >
      <div className="flex items-end">
        {cards.map((card, index) => {
          const isSelected = selectedIds.has(card.id);
          return (
            <div
              key={card.id}
              className={cn(
                "transition-transform",
                // Proportional hover lift based on container size
                "hover:-translate-y-1.5 @[400px]:hover:-translate-y-2 @[700px]:hover:-translate-y-3",
                // Selected cards stay slightly lifted
                isSelected && "-translate-y-1",
                // Mobile-friendly overlap at smallest size, standard as we get bigger
                index > 0 && [
                  OVERLAP_MOBILE.sm, // default: mobile-friendly small overlap (shows more card)
                  "@[400px]:ml-0 @[400px]:-ml-8", // medium: reset then apply -ml-8
                  "@[700px]:ml-0 @[700px]:-ml-10", // large: reset then apply -ml-10
                ]
              )}
              style={{ zIndex: index }}
            >
              {/* Render all three sizes, show based on container width */}
              <div className="@[700px]:hidden @[400px]:hidden block">
                <PlayingCard
                  card={card}
                  size="sm"
                  selected={isSelected}
                  onClick={onCardClick ? () => onCardClick(card.id) : undefined}
                />
              </div>
              <div className="@[700px]:hidden hidden @[400px]:block">
                <PlayingCard
                  card={card}
                  size="md"
                  selected={isSelected}
                  onClick={onCardClick ? () => onCardClick(card.id) : undefined}
                />
              </div>
              <div className="hidden @[700px]:block">
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
