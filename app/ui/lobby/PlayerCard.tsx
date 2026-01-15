import { cn } from "~/shadcn/lib/utils";
import { Bot } from "lucide-react";

interface PlayerCardProps {
  name: string;
  avatarId?: string;
  isCurrentPlayer?: boolean;
  isAI?: boolean;
  isConnected?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function PlayerCard({
  name,
  avatarId,
  isCurrentPlayer = false,
  isAI = false,
  isConnected = true,
  onClick,
  children,
}: PlayerCardProps) {
  const isClickable = !!onClick;

  const content = (
    <>
      <PlayerAvatar
        name={name}
        avatarId={avatarId}
        isAI={isAI}
        isConnected={isConnected}
      />
      <span className="font-medium text-sm text-center truncate w-full">
        {name}
      </span>
      {isCurrentPlayer && (
        <span className="text-xs text-muted-foreground">(you)</span>
      )}
      {children}
    </>
  );

  const baseClasses = cn(
    "relative flex flex-col items-center p-2 rounded-xl border-2 transition-all min-w-[100px]",
    isCurrentPlayer
      ? "border-primary bg-accent/30 shadow-sm"
      : "border-border bg-card"
  );

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClasses,
          "hover:border-primary hover:bg-accent/50 hover:shadow-md cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

interface PlayerAvatarProps {
  name: string;
  avatarId?: string;
  isAI?: boolean;
  isConnected?: boolean;
}

function PlayerAvatar({
  name,
  avatarId,
  isAI = false,
  isConnected = true,
}: PlayerAvatarProps) {
  return (
    <div className="relative w-full aspect-square flex items-center justify-center">
      {avatarId ? (
        <img
          src={`/avatars/${avatarId}.svg`}
          alt={name}
          className="w-16 h-16 rounded-full object-contain"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <svg
            className="w-8 h-8 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          </svg>
        </div>
      )}
      <StatusIndicator isAI={isAI} isConnected={isConnected} />
    </div>
  );
}

interface StatusIndicatorProps {
  isAI: boolean;
  isConnected: boolean;
}

function StatusIndicator({ isAI, isConnected }: StatusIndicatorProps) {
  if (isAI) {
    return (
      <span className="absolute bottom-0 right-1/2 translate-x-[24px] w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center border-2 border-background">
        <Bot className="w-3 h-3 text-white" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "absolute bottom-0 right-1/2 translate-x-[24px] w-4 h-4 rounded-full border-2 border-background",
        isConnected ? "bg-green-500" : "bg-gray-400"
      )}
    />
  );
}
