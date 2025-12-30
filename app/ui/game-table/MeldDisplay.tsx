import type { Meld } from "core/meld/meld.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { cn } from "~/shadcn/lib/utils";

interface MeldDisplayProps {
  meld: Meld;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

// Tighter overlap than hand display
const OVERLAP = {
  sm: "-ml-4",
  md: "-ml-5",
} as const;

export function MeldDisplay({
  meld,
  label,
  size = "sm",
  className,
}: MeldDisplayProps) {
  const displayLabel = label ?? (meld.type === "set" ? "Set" : "Run");

  return (
    <div className={cn("inline-block", className)}>
      {/* Label */}
      <div className="text-xs text-muted-foreground mb-1 font-medium">
        {displayLabel}
      </div>

      {/* Cards */}
      <div className="flex items-end">
        {meld.cards.map((card, index) => (
          <div
            key={card.id}
            className={cn(index > 0 && OVERLAP[size])}
            style={{ zIndex: index }}
          >
            <PlayingCard card={card} size={size} />
          </div>
        ))}
      </div>
    </div>
  );
}
