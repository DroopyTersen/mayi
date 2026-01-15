import type { Meld } from "core/meld/meld.types";
import { MeldDisplay } from "./MeldDisplay";
import { cn } from "~/shadcn/lib/utils";

interface PlayerMeldsDisplayProps {
  playerName: string;
  playerAvatarId?: string;
  melds: Meld[];
  /** Whether it's currently this player's turn (for highlighting) */
  isActiveTurn?: boolean;
  /** Whether this is the viewing player's meld section (for "(you)" label) */
  isViewingPlayer?: boolean;
  className?: string;
}

export function PlayerMeldsDisplay({
  playerName,
  playerAvatarId,
  melds,
  isActiveTurn = false,
  isViewingPlayer = false,
  className,
}: PlayerMeldsDisplayProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-3",
        isActiveTurn && isViewingPlayer
          ? "border-[3px] border-blue-400 bg-blue-50"
          : isActiveTurn
            ? "border-[3px] border-orange-400 bg-orange-50"
            : "border border-border sm:border-transparent",
        className
      )}
    >
      {/* Desktop/Tablet: Avatar + name on left, melds on right */}
      <div className="hidden sm:flex gap-4">
        <div className="flex flex-col items-center shrink-0 w-20">
          <PlayerAvatar
            name={playerName}
            avatarId={playerAvatarId}
            size="lg"
            showSpinner={isActiveTurn && !isViewingPlayer}
          />
          <span
            className={cn(
              "text-sm font-semibold mt-1 text-center",
              isActiveTurn && "text-primary"
            )}
          >
            {playerName}
          </span>
          {isViewingPlayer && (
            <span className="text-xs text-muted-foreground">(you)</span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex items-center">
          {melds.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 italic">
              {playerName} hasn't laid down yet
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {melds.map((meld) => (
                <MeldDisplay key={meld.id} meld={meld} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Avatar in header */}
      <div className="sm:hidden">
        <h3
          className={cn(
            "flex items-center gap-2 text-sm font-semibold mb-2",
            isActiveTurn && "text-primary"
          )}
        >
          <PlayerAvatar
            name={playerName}
            avatarId={playerAvatarId}
            size="sm"
            showSpinner={isActiveTurn && !isViewingPlayer}
          />
          {playerName}
          {isViewingPlayer && (
            <span className="text-xs font-normal text-muted-foreground">
              (you)
            </span>
          )}
        </h3>
        {melds.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">
            {playerName} hasn't laid down yet
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {melds.map((meld) => (
              <MeldDisplay key={meld.id} meld={meld} size="sm" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerAvatar({
  name,
  avatarId,
  size = "sm",
  showSpinner = false,
}: {
  name: string;
  avatarId?: string;
  size?: "sm" | "lg";
  showSpinner?: boolean;
}) {
  const sizeClasses = size === "lg" ? "w-16 h-16" : "w-6 h-6";
  const spinnerSize = size === "lg" ? "w-[72px] h-[72px]" : "w-8 h-8";
  const textSize = size === "lg" ? "text-xl" : "text-xs";

  const avatarContent = avatarId ? (
    <img
      src={`/avatars/${avatarId}.svg`}
      alt={name}
      className={cn(sizeClasses, "rounded-full shrink-0")}
    />
  ) : (
    <div
      className={cn(
        sizeClasses,
        "rounded-full bg-muted flex items-center justify-center shrink-0"
      )}
    >
      <span className={cn(textSize, "font-medium text-muted-foreground")}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );

  if (!showSpinner) {
    return avatarContent;
  }

  return (
    <div className={cn("relative flex items-center justify-center", spinnerSize)}>
      {/* Spinning ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full animate-spin",
          "border-4 border-orange-200 border-t-orange-400"
        )}
        style={{ animationDuration: "1.7s" }}
      />
      {/* Avatar centered inside */}
      {avatarContent}
    </div>
  );
}
