import { memo } from "react";
import type { Card } from "core/card/card.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";

interface PlayerHandResponsiveCardProps {
  card: Card;
  selected: boolean;
  onClick?: () => void;
}

function PlayerHandResponsiveCardComponent({
  card,
  selected,
  onClick,
}: PlayerHandResponsiveCardProps) {
  return (
    <>
      <div className="@[400px]:hidden block">
        <PlayingCard card={card} size="sm" selected={selected} onClick={onClick} />
      </div>
      <div className="hidden @[400px]:block @[550px]:hidden">
        <PlayingCard card={card} size="md" selected={selected} onClick={onClick} />
      </div>
      <div className="hidden @[550px]:block">
        <PlayingCard card={card} size="lg" selected={selected} onClick={onClick} />
      </div>
    </>
  );
}

function arePlayerHandResponsiveCardPropsEqual(
  previous: PlayerHandResponsiveCardProps,
  next: PlayerHandResponsiveCardProps
) {
  return (
    previous.card.id === next.card.id &&
    previous.card.rank === next.card.rank &&
    previous.card.suit === next.card.suit &&
    previous.selected === next.selected &&
    previous.onClick === next.onClick
  );
}

export const PlayerHandResponsiveCard = memo(
  PlayerHandResponsiveCardComponent,
  arePlayerHandResponsiveCardPropsEqual
);
