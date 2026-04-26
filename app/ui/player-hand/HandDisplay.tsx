import type { ReactNode } from "react";
import type { Card } from "core/card/card.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { cn } from "~/shadcn/lib/utils";
import { useNewCardIds } from "./useNewCardIds";
import { PlayerHandResponsiveCard } from "./PlayerHandResponsiveCard";
import {
  getStackedHandOverlapClass,
  STACKED_HAND_AUTO_HOVER_LIFT,
  STACKED_HAND_FIXED_HOVER_LIFT,
  STACKED_HAND_FIXED_OVERLAP,
  type CardSize,
} from "./player-hand.layout";

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
        overlapClass={STACKED_HAND_FIXED_OVERLAP[fixedSize]}
        hoverLiftClass={STACKED_HAND_FIXED_HOVER_LIFT[fixedSize]}
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
  const overlapClass = getStackedHandOverlapClass(cards.length);

  return (
    <div className="@container" style={{ containerType: "inline-size" }}>
      <HandRow
        cards={cards}
        selectedIds={selectedIds}
        newCardIds={newCardIds}
        overlap={overlap}
        overlapClass={overlapClass}
        hoverLiftClass={STACKED_HAND_AUTO_HOVER_LIFT}
        className={className}
        renderCard={(card, isSelected) => (
          <PlayerHandResponsiveCard
            card={card}
            selected={isSelected}
            onClick={onCardClick ? () => onCardClick(card.id) : undefined}
          />
        )}
      />
    </div>
  );
}
