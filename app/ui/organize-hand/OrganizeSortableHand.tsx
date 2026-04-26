import {
  DragDropProvider,
  type DragEndEvent,
} from "@dnd-kit/react";
import type { KeyboardEvent } from "react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import type { Card } from "core/card/card.types";
import { cn } from "~/shadcn/lib/utils";
import { PlayerHandResponsiveCard } from "~/ui/player-hand/PlayerHandResponsiveCard";
import {
  getStackedHandOverlapClass,
  STACKED_HAND_AUTO_HOVER_LIFT,
} from "~/ui/player-hand/player-hand.layout";
import { ORGANIZE_HAND_DRAG_SENSORS } from "./organize-hand.drag-sensors";
import type { OrganizeDragReorderInput } from "./organize-hand.drag-state";

interface OrganizeSortableHandProps {
  cards: Card[];
  selectedId: string | null;
  onCardClick: (cardId: string) => void;
  onReorder: (input: OrganizeDragReorderInput) => void;
  className?: string;
}

const CARD_TRANSITION = {
  duration: 180,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  idle: true,
};

function getCardLabel(card: Card): string {
  if (card.rank === "Joker") {
    return "Joker";
  }

  return `${card.rank} of ${card.suit ?? "unknown suit"}`;
}

function SortableCard({
  card,
  index,
  overlapClass,
  selected,
  onCardClick,
}: {
  card: Card;
  index: number;
  overlapClass: string;
  selected: boolean;
  onCardClick: (cardId: string) => void;
}) {
  const { ref, isDragging, isDropping, isDragSource, isDropTarget } = useSortable({
    id: card.id,
    index,
    group: "organize-hand",
    transition: CARD_TRANSITION,
    data: { cardId: card.id },
  });
  const label = getCardLabel(card);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onCardClick(card.id);
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`Select ${label} at position ${index + 1} to move with arrow controls`}
      aria-pressed={selected}
      data-testid={`organize-sortable-card-${card.id}`}
      data-card-id={card.id}
      onClick={() => onCardClick(card.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative shrink-0 cursor-grab touch-manipulation select-none rounded-lg outline-none",
        "transition-[transform,opacity,filter] duration-150 ease-out",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        index > 0 && overlapClass,
        STACKED_HAND_AUTO_HOVER_LIFT,
        selected && "-translate-y-1",
        isDragSource && "z-50 scale-[1.04] cursor-grabbing opacity-95 drop-shadow-xl",
        isDragging && !isDragSource && "opacity-35",
        isDropping && "scale-[0.99]",
        isDropTarget && !isDragSource && "translate-y-[-4px]"
      )}
      style={{ zIndex: isDragSource ? 100 : index }}
    >
      <PlayerHandResponsiveCard card={card} selected={selected} />
    </div>
  );
}

export function OrganizeSortableHand({
  cards,
  selectedId,
  onCardClick,
  onReorder,
  className,
}: OrganizeSortableHandProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { source } = event.operation;

    if (!isSortable(source)) {
      return;
    }

    onReorder({
      initialIndex: source.initialIndex,
      targetIndex: source.index,
      canceled: event.canceled,
    });
  };
  const overlapClass = getStackedHandOverlapClass(cards.length);

  return (
    <DragDropProvider
      sensors={ORGANIZE_HAND_DRAG_SENSORS}
      onDragEnd={handleDragEnd}
    >
      <div className="@container" style={{ containerType: "inline-size" }}>
        <div
          data-testid="organize-sortable-hand"
          className={cn("flex w-max items-end justify-start px-1", className)}
        >
          {cards.map((card, index) => (
            <SortableCard
              key={card.id}
              card={card}
              index={index}
              overlapClass={overlapClass}
              selected={selectedId === card.id}
              onCardClick={onCardClick}
            />
          ))}
        </div>
      </div>
    </DragDropProvider>
  );
}
