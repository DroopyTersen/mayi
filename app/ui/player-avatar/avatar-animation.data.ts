import type { AvatarReaction } from "./avatar-reaction";

type AvatarAnimation = "turn" | AvatarReaction["kind"];

/** Add a sequence after its sprite sheet is ready in public/avatars/animated. */
export const AVATAR_ANIMATIONS = new Map<string, readonly AvatarAnimation[]>([
  ["andrew", ["turn", "lay-down", "lay-off"]],
  ["jane", ["turn", "lay-down", "lay-off"]],
]);
