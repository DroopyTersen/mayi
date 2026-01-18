import type { Meld } from "core/meld/meld.types";
import type { MayINotificationState } from "~/routes/game.$roomId";
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
  /** May I notification for this player (when they called May I) */
  mayINotification?: MayINotificationState | null;
  className?: string;
}

export function PlayerMeldsDisplay({
  playerName,
  playerAvatarId,
  melds,
  isActiveTurn = false,
  isViewingPlayer = false,
  mayINotification,
  className,
}: PlayerMeldsDisplayProps) {
  // Compute status message: May I notification takes priority over "hasn't laid down yet"
  const statusMessage = mayINotification
    ? getMayIStatusMessage(mayINotification)
    : null;
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
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          {/* May I notification (highest priority) */}
          {statusMessage && (
            <MayIStatusBadge
              message={statusMessage.text}
              variant={statusMessage.variant}
              size="md"
            />
          )}
          {/* Melds or "hasn't laid down" status */}
          {melds.length === 0 ? (
            !statusMessage && (
              <p className="text-sm text-muted-foreground/60 italic">
                {playerName} hasn't laid down yet
              </p>
            )
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
        {/* May I notification (highest priority) */}
        {statusMessage && (
          <MayIStatusBadge
            message={statusMessage.text}
            variant={statusMessage.variant}
            size="sm"
          />
        )}
        {/* Melds or "hasn't laid down" status */}
        {melds.length === 0 ? (
          !statusMessage && (
            <p className="text-xs text-muted-foreground/60 italic">
              {playerName} hasn't laid down yet
            </p>
          )
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

/**
 * Helper to compute the status message text and variant from notification state
 */
function getMayIStatusMessage(notification: MayINotificationState): {
  text: string;
  variant: "pending" | "allowed" | "blocked";
} {
  if (notification.outcome === "allowed") {
    return {
      text: `${notification.callerName}'s May I was allowed`,
      variant: "allowed",
    };
  } else if (notification.outcome === "blocked") {
    return {
      text: `${notification.callerName}'s May I was blocked`,
      variant: "blocked",
    };
  } else {
    return {
      text: `${notification.callerName} has May I'd for ${notification.cardText}`,
      variant: "pending",
    };
  }
}

/**
 * Badge component for displaying May I status notifications
 */
function MayIStatusBadge({
  message,
  variant,
  size = "md",
}: {
  message: string;
  variant: "pending" | "allowed" | "blocked";
  size?: "sm" | "md";
}) {
  const variantClasses = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    allowed: "bg-green-100 text-green-800 border-green-300",
    blocked: "bg-red-100 text-red-800 border-red-300",
  };

  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full border animate-pulse",
        variantClasses[variant],
        sizeClasses
      )}
      style={{ animationDuration: "2s" }}
    >
      {message}
    </span>
  );
}
