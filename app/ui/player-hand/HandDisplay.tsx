import type { ReactNode } from "react";
import type { Card } from "core/card/card.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { cn } from "~/shadcn/lib/utils";
import { useNewCardIds } from "./useNewCardIds";

type CardSize = "sm" | "md" | "lg";

interface HandDisplayProps {
  cards: Card[];
  selectedIds?: Set<string>;
  onCardClick?: (cardId: string) => void;
  /** Card size - "auto" uses container queries to pick size based on available width */
  size?: CardSize | "auto";
  /** Disable overlap for precise selection surfaces like discard and lay-down dialogs. */
  overlap?: "stacked" | "none";
  className?: string;
}

// Overlap amounts for each fixed size (negative margin)
const OVERLAP: Record<CardSize, string> = {
  sm: "-ml-6",
  md: "-ml-8",
  lg: "-ml-10",
};

// Hover lift amounts proportional to card size
const HOVER_LIFT: Record<CardSize, string> = {
  sm: "hover:-translate-y-1.5",
  md: "hover:-translate-y-2",
  lg: "hover:-translate-y-3",
};

// Hover lift used in auto/container-query mode (scales with container width).
const AUTO_HOVER_LIFT =
  "hover:-translate-y-1.5 @[400px]:hover:-translate-y-2 @[550px]:hover:-translate-y-3";

// Hand size tiers based on card count
type HandSizeTier = "normal" | "large" | "huge";

export function getHandSizeTier(cardCount: number): HandSizeTier {
  if (cardCount > 20) return "huge";
  if (cardCount > 14) return "large";
  return "normal";
}

// Tier-based overlap matrix for auto mode. Tighter overlap as card count and
// container width grow.
//
// | Container Width | Normal (1-14) | Large (15-20) | Huge (21+)    |
// |-----------------|---------------|---------------|---------------|
// | < 400px (sm)    | -ml-5 (20px)  | -ml-6 (24px)  | -ml-7 (28px)  |
// | 400-550px (md)  | -ml-8 (32px)  | -ml-8 (32px)  | -ml-10 (40px) |
// | >= 550px (lg)   | -ml-10 (40px) | -ml-14 (56px) | -ml-[72px]    |
const OVERLAP_TIERS: Record<HandSizeTier, string> = {
  normal: "-ml-5 @[400px]:ml-0 @[400px]:-ml-8 @[550px]:ml-0 @[550px]:-ml-10",
  large: "-ml-6 @[400px]:ml-0 @[400px]:-ml-8 @[550px]:ml-0 @[550px]:-ml-14",
  huge: "-ml-7 @[400px]:ml-0 @[400px]:-ml-10 @[550px]:ml-0 @[550px]:-ml-[72px]",
};

const supportsContainerQueries =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("container-type: inline-size");

interface HandCardWrapperProps {
  index: number;
  hoverLiftClass: string;
  overlapClass: string;
  isFirst: boolean;
  isStacked: boolean;
  isSelected: boolean;
  isNew: boolean;
  children: ReactNode;
}

function HandCardWrapper({
  index,
  hoverLiftClass,
  overlapClass,
  isFirst,
  isStacked,
  isSelected,
  isNew,
  children,
}: HandCardWrapperProps) {
  return (
    <div
      className={cn(
        "transition-transform",
        hoverLiftClass,
        isStacked && !isFirst && overlapClass,
        // Selected cards stay slightly lifted
        isSelected && "-translate-y-1",
        isNew && "card-flash"
      )}
      style={{ zIndex: index }}
    >
      {children}
    </div>
  );
}

function HandRow({
  cards,
  selectedIds,
  newCardIds,
  overlap,
  overlapClass,
  hoverLiftClass,
  className,
  renderCard,
}: {
  cards: Card[];
  selectedIds: Set<string>;
  newCardIds: ReadonlySet<string>;
  overlap: "stacked" | "none";
  overlapClass: string;
  hoverLiftClass: string;
  className?: string;
  renderCard: (card: Card, isSelected: boolean) => ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-end",
        overlap === "none" && "flex-wrap gap-1",
        className
      )}
    >
      {cards.map((card, index) => {
        const isSelected = selectedIds.has(card.id);
        return (
          <HandCardWrapper
            key={card.id}
            index={index}
            hoverLiftClass={hoverLiftClass}
            overlapClass={overlapClass}
            isFirst={index === 0}
            isStacked={overlap === "stacked"}
            isSelected={isSelected}
            isNew={newCardIds.has(card.id)}
          >
            {renderCard(card, isSelected)}
          </HandCardWrapper>
        );
      })}
    </div>
  );
}

function EmptyHand({ className }: { className?: string }) {
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
        <rect x="4" y="4" width="12" height="16" rx="1" strokeDasharray="3 2" />
        <rect x="8" y="4" width="12" height="16" rx="1" strokeDasharray="3 2" />
      </svg>
      <span>No cards in hand</span>
    </div>
  );
}

export function HandDisplay({
  cards,
  selectedIds = new Set(),
  onCardClick,
  size = "auto",
  overlap = "stacked",
  className,
}: HandDisplayProps) {
  const newCardIds = useNewCardIds(cards);

  if (cards.length === 0) {
    return <EmptyHand className={className} />;
  }

  // Resolve to a fixed CardSize when "auto" can't use container queries.
  const fallbackSize: CardSize | undefined =
    size === "auto" && !supportsContainerQueries
      ? cards.length > 14
        ? "sm"
        : "md"
      : undefined;
  const fixedSize: CardSize | undefined =
    size !== "auto" ? size : fallbackSize;

  if (fixedSize) {
    return (
      <HandRow
        cards={cards}
        selectedIds={selectedIds}
        newCardIds={newCardIds}
        overlap={overlap}
        overlapClass={OVERLAP[fixedSize]}
        hoverLiftClass={HOVER_LIFT[fixedSize]}
        className={className}
        renderCard={(card, isSelected) => (
          <PlayingCard
            card={card}
            size={fixedSize}
            selected={isSelected}
            onClick={onCardClick ? () => onCardClick(card.id) : undefined}
          />
        )}
      />
    );
  }

  // Auto + container queries supported - render three sizes, show via @container.
  const overlapClass = OVERLAP_TIERS[getHandSizeTier(cards.length)];

  return (
    <div className="@container" style={{ containerType: "inline-size" }}>
      <HandRow
        cards={cards}
        selectedIds={selectedIds}
        newCardIds={newCardIds}
        overlap={overlap}
        overlapClass={overlapClass}
        hoverLiftClass={AUTO_HOVER_LIFT}
        className={className}
        renderCard={(card, isSelected) => (
          <ResponsivePlayingCard
            card={card}
            isSelected={isSelected}
            onClick={onCardClick ? () => onCardClick(card.id) : undefined}
          />
        )}
      />
    </div>
  );
}

function ResponsivePlayingCard({
  card,
  isSelected,
  onClick,
}: {
  card: Card;
  isSelected: boolean;
  onClick?: () => void;
}) {
  return (
    <>
      <div className="@[400px]:hidden block">
        <PlayingCard card={card} size="sm" selected={isSelected} onClick={onClick} />
      </div>
      <div className="hidden @[400px]:block @[550px]:hidden">
        <PlayingCard card={card} size="md" selected={isSelected} onClick={onClick} />
      </div>
      <div className="hidden @[550px]:block">
        <PlayingCard card={card} size="lg" selected={isSelected} onClick={onClick} />
      </div>
    </>
  );
}
