import type { AvatarReaction } from "./avatar-reaction";

type AvatarAnimation = "turn" | AvatarReaction["kind"];

export function getAvatarTurnDurationMs(avatarId?: string): number {
  return avatarId === "jane" || avatarId === "hannah" ? 2000 : 4000;
}

/** Add a sequence after its sprite sheet is ready in public/avatars/animated. */
export const AVATAR_ANIMATIONS = new Map<string, readonly AvatarAnimation[]>([
  ["andrew", ["turn", "lay-down", "lay-off"]],
  ["jane", ["turn", "lay-down", "lay-off"]],
  ["curt", ["turn", "lay-down", "lay-off"]],
  ["kate", ["turn", "lay-down", "lay-off"]],
  ["natalie", ["turn", "lay-down", "lay-off"]],
  ["carter", ["turn", "lay-down", "lay-off"]],
  ["hannah", ["turn", "lay-down", "lay-off"]],
  ["maggie-theo", ["turn", "lay-down", "lay-off"]],
]);
