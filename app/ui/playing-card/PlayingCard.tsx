import type { Card } from "core/card/card.types";
import { cn } from "~/shadcn/lib/utils";

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SIZE_CLASSES = {
  sm: "w-12 h-[68px] text-xs",
  md: "w-16 h-[90px] text-sm",
  lg: "w-24 h-[134px] text-lg",
} as const;

const JOKER_ICON_SIZE = {
  sm: 24,
  md: 32,
  lg: 56,
} as const;

// Simplified jester icon - cleaner at small sizes
function JokerIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      {/* Jester hat - three points with bells */}
      <path
        d="M16 6 L10 4 L8 10 L4 6 L6 14 L16 12 L26 14 L28 6 L24 10 L22 4 L16 6Z"
        fill="currentColor"
      />
      {/* Hat bells */}
      <circle cx="4" cy="6" r="2" fill="currentColor" />
      <circle cx="16" cy="4" r="2" fill="currentColor" />
      <circle cx="28" cy="6" r="2" fill="currentColor" />
      {/* Face */}
      <circle cx="16" cy="20" r="8" fill="currentColor" />
      {/* Eyes */}
      <circle cx="13" cy="18" r="1.5" fill="white" />
      <circle cx="19" cy="18" r="1.5" fill="white" />
      {/* Smile */}
      <path
        d="M12 22 Q16 26 20 22"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface PlayingCardProps {
  card: Card;
  size?: keyof typeof SIZE_CLASSES;
  selected?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PlayingCard({
  card,
  size = "md",
  selected = false,
  faceDown = false,
  onClick,
  className,
}: PlayingCardProps) {
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const isJoker = card.rank === "Joker";
  const isWild = isJoker || card.rank === "2";

  const suitSymbol = card.suit ? SUIT_SYMBOLS[card.suit] : "";
  const displayRank = card.rank;

  // Corner content for non-joker cards
  const CornerContent = () => (
    <div className="flex flex-col items-center leading-none">
      <span className="font-bold">{displayRank}</span>
      <span className="-mt-0.5">{suitSymbol}</span>
    </div>
  );

  // Face-down card rendering
  if (faceDown) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "relative rounded-lg border-2 shadow-sm overflow-hidden",
          "transition-all duration-150",
          SIZE_CLASSES[size],
          "bg-blue-700 border-blue-800",
          selected && "ring-2 ring-primary ring-offset-2",
          onClick && "cursor-pointer hover:bg-blue-600 hover:shadow-md",
          !onClick && "cursor-default",
          className
        )}
      >
        {/* Diagonal stripe pattern for card back */}
        <div className="absolute inset-1 rounded border border-blue-500/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.1)_4px,rgba(255,255,255,0.1)_8px)]" />
        <div className="absolute inset-2 rounded border border-blue-400/30" />
        {/* Center diamond emblem */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 bg-blue-500/40 rotate-45 rounded-sm border border-blue-400/50" />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative rounded-lg border-2 bg-white shadow-sm",
        "transition-all duration-150",
        SIZE_CLASSES[size],
        // Color based on suit
        isRed ? "text-red-600" : "text-gray-900",
        // Joker is purple/multicolor
        isJoker && "text-purple-600",
        // Border styling
        selected
          ? "border-primary ring-2 ring-primary ring-offset-1"
          : "border-gray-300",
        // Wild card indicator - more visible amber background
        isWild && !selected && "bg-amber-100 border-amber-300",
        // Interactive states
        onClick && "cursor-pointer hover:border-gray-400 hover:shadow-md",
        !onClick && "cursor-default",
        className
      )}
    >
      {isJoker ? (
        // Joker layout - vertical text + centered icon
        <>
          {/* Vertical JOKER text on left */}
          <div className="absolute left-1 top-1 bottom-1 flex flex-col justify-center">
            {"JOKER".split("").map((letter, i) => (
              <span
                key={i}
                className="text-[8px] font-bold leading-[1.1] text-purple-600"
              >
                {letter}
              </span>
            ))}
          </div>
          {/* Centered icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <JokerIcon size={JOKER_ICON_SIZE[size]} className="text-purple-600" />
          </div>
        </>
      ) : (
        <>
          {/* Top-left corner */}
          <div className="absolute top-1 left-1">
            <CornerContent />
          </div>
          {/* Bottom-right corner (rotated 180°) */}
          <div className="absolute bottom-1 right-1 rotate-180">
            <CornerContent />
          </div>
          {/* Center pip for large cards */}
          {size === "lg" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl opacity-80">{suitSymbol}</span>
            </div>
          )}
        </>
      )}
    </button>
  );
}
