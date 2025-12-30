import type { Card } from "core/card/card.types";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { cn } from "~/shadcn/lib/utils";

type InteractiveLabel = "pickup" | "may-i";

interface DiscardPileDisplayProps {
  topCard: Card | null;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  /** Shows a targeting overlay with label for touch interaction */
  interactiveLabel?: InteractiveLabel;
  className?: string;
}

const LABEL_TEXT: Record<InteractiveLabel, string> = {
  pickup: "Pickup",
  "may-i": "May I?",
};

export function DiscardPileDisplay({
  topCard,
  onClick,
  size = "md",
  interactiveLabel,
  className,
}: DiscardPileDisplayProps) {
  // Card dimensions for positioning the stack effect
  const dimensions = {
    sm: { width: 48, height: 68 },
    md: { width: 64, height: 90 },
    lg: { width: 80, height: 112 },
  } as const;

  const { width, height } = dimensions[size];

  if (!topCard) {
    return (
      <div
        className={cn(
          "border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center text-muted-foreground text-xs",
          className
        )}
        style={{ width, height }}
      >
        Empty
      </div>
    );
  }

  const isInteractive = Boolean(interactiveLabel && onClick);
  const bracketColor = interactiveLabel === "may-i" ? "#f59e0b" : "#3b82f6"; // amber-500 or blue-500

  // Outer padding for brackets when interactive
  const bracketGap = 6;
  const bracketSize = 16;
  const outerPadding = isInteractive ? bracketGap + bracketSize : 0;

  return (
    <div
      className={cn("relative inline-block", className)}
      style={{ padding: outerPadding }}
    >
      {/* Corner brackets - positioned in the padding area */}
      {isInteractive && interactiveLabel && (
        <>
          {/* Top-left */}
          <svg className="absolute" style={{ top: 0, left: 0, width: bracketSize, height: bracketSize }} viewBox="0 0 16 16" fill="none">
            <path d="M2 14V4C2 2.89543 2.89543 2 4 2H14" stroke={bracketColor} strokeWidth="3" strokeLinecap="round" />
          </svg>
          {/* Top-right */}
          <svg className="absolute" style={{ top: 0, right: 0, width: bracketSize, height: bracketSize }} viewBox="0 0 16 16" fill="none">
            <path d="M14 14V4C14 2.89543 13.1046 2 12 2H2" stroke={bracketColor} strokeWidth="3" strokeLinecap="round" />
          </svg>
          {/* Bottom-left */}
          <svg className="absolute" style={{ bottom: 0, left: 0, width: bracketSize, height: bracketSize }} viewBox="0 0 16 16" fill="none">
            <path d="M2 2V12C2 13.1046 2.89543 14 4 14H14" stroke={bracketColor} strokeWidth="3" strokeLinecap="round" />
          </svg>
          {/* Bottom-right */}
          <svg className="absolute" style={{ bottom: 0, right: 0, width: bracketSize, height: bracketSize }} viewBox="0 0 16 16" fill="none">
            <path d="M14 2V12C14 13.1046 13.1046 14 12 14H2" stroke={bracketColor} strokeWidth="3" strokeLinecap="round" />
          </svg>
        </>
      )}

      <div
        className={cn("relative", isInteractive && "cursor-pointer")}
        style={{ width: width + 4, height: height + 4 }}
        onClick={isInteractive ? onClick : undefined}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onKeyDown={
          isInteractive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
      >
        {/* Stack effect - back cards */}
        <div
          className="absolute bg-slate-300 rounded-lg border border-slate-400"
          style={{
            width,
            height,
            top: 0,
            left: 0,
          }}
        />
        <div
          className="absolute bg-slate-200 rounded-lg border border-slate-300"
          style={{
            width,
            height,
            top: 2,
            left: 2,
          }}
        />

        {/* Top card */}
        <div className="absolute" style={{ top: 4, left: 4 }}>
          <PlayingCard card={topCard} size={size} />
        </div>

        {/* Interactive overlay and label */}
        {isInteractive && interactiveLabel && (
          <div
            className="absolute flex items-center justify-center"
            style={{ top: 4, left: 4, width, height }}
          >
            {/* Semi-transparent overlay */}
            <div
              className={cn(
                "absolute inset-0 rounded-lg",
                interactiveLabel === "may-i" ? "bg-amber-500/20" : "bg-blue-500/20"
              )}
            />

            {/* Label button on top */}
            <span
              className={cn(
                "relative z-10 px-2 py-0.5 text-xs font-bold rounded shadow-sm",
                interactiveLabel === "may-i"
                  ? "bg-amber-500 text-white"
                  : "bg-blue-500 text-white"
              )}
            >
              {LABEL_TEXT[interactiveLabel]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
