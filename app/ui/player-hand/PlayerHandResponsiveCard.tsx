import type { Card } from "core/card/card.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";

interface PlayerHandResponsiveCardProps {
  card: Card;
  selected: boolean;
  onClick?: () => void;
}

export function PlayerHandResponsiveCard({
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
