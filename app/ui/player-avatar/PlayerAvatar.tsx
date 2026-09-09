import { cn } from "~/shadcn/lib/utils";
import { preload } from "react-dom";
import type { AvatarReaction } from "./avatar-reaction";
import { AVATAR_ANIMATIONS } from "./avatar-animation.data";
import "./player-avatar.css";

interface PlayerAvatarProps {
  name: string;
  avatarId?: string;
  size?: "sm" | "lg" | "preview";
  isActiveTurn?: boolean;
  reaction?: AvatarReaction | null;
  showSpinner?: boolean;
}

export function PlayerAvatar({
  name, avatarId, size = "sm", isActiveTurn = false, reaction, showSpinner = false,
}: PlayerAvatarProps) {
  const sizeClass = { sm: "w-6 h-6", lg: "w-16 h-16", preview: "w-32 h-32" }[size];
  const animations = AVATAR_ANIMATIONS.get(avatarId ?? "") ?? [];
  const motion = reaction?.kind ?? (isActiveTurn ? "turn" : "idle");
  const clip = reaction?.kind ?? "turn";
  const hasSprite = animations.includes(clip);
  for (const sequence of animations) {
    preload(`/avatars/animated/${avatarId}-${sequence}.webp`, { as: "image" });
  }
  const content = hasSprite ? (
    <span
      role="img"
      aria-label={name}
      data-avatar-motion={motion}
      data-avatar-id={avatarId}
      className={cn("player-avatar relative inline-block rounded-full shrink-0 overflow-hidden", sizeClass)}
    >
      <img src={`/avatars/${avatarId}.svg`} alt="" className="player-avatar-original w-full h-full" />
      <span
        key={reaction?.id ?? motion}
        aria-hidden="true"
        className="player-avatar-sprite absolute inset-0"
        style={{ backgroundImage: `url(/avatars/animated/${avatarId}-${clip}.webp)` }}
      />
    </span>
  ) : avatarId ? (
    <img src={`/avatars/${avatarId}.svg`} alt={name} className={cn(sizeClass, "rounded-full shrink-0")} />
  ) : (
    <span role="img" aria-label={name} className={cn(sizeClass, "rounded-full bg-muted flex items-center justify-center shrink-0")}>
      <span className={cn(size === "sm" ? "text-xs" : "text-xl", "font-medium text-muted-foreground")}>
        {name.charAt(0).toUpperCase()}
      </span>
    </span>
  );

  if (!showSpinner) return content;
  return (
    <span className={cn("relative flex items-center justify-center shrink-0", size === "lg" ? "w-[72px] h-[72px]" : "w-8 h-8")}>
      <span className="absolute inset-0 rounded-full animate-spin motion-reduce:animate-none border-4 border-orange-200 border-t-orange-400" style={{ animationDuration: "1.7s" }} />
      {content}
    </span>
  );
}
