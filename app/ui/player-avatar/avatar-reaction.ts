import type { ActivityEntry } from "~/ui/game-view/game-view.types";

export const AVATAR_REACTION_DURATION_MS = 2000;

export interface AvatarReaction {
  id: string;
  playerId: string;
  kind: "lay-down" | "lay-off";
}

/** Find a reaction after the last observed event, using IDs instead of display text. */
export function getNewAvatarReaction(
  entries: readonly ActivityEntry[],
  previousEntryId: string | undefined,
): AvatarReaction | null {
  const previousIndex = entries.findIndex((entry) => entry.id === previousEntryId);
  if (previousEntryId !== undefined && previousIndex < 0) return null;

  for (let index = entries.length - 1; index > previousIndex; index--) {
    const entry = entries[index];
    if (!entry?.playerId) continue;
    if (entry.action === "laid down contract") {
      return { id: entry.id, playerId: entry.playerId, kind: "lay-down" };
    }
    if (entry.action === "laid off" || entry.action === "laid off at start") {
      return { id: entry.id, playerId: entry.playerId, kind: "lay-off" };
    }
  }
  return null;
}
