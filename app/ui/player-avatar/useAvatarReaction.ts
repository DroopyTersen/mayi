import { useEffect, useRef, useState } from "react";
import type { ActivityEntry } from "~/ui/game-view/game-view.types";
import { AVATAR_REACTION_DURATION_MS, getNewAvatarReaction, type AvatarReaction } from "./avatar-reaction";

export function useAvatarReaction(entries: readonly ActivityEntry[], connected = true) {
  // Seed from history on mount so joining/reloading never replays old moves.
  const previousEntryId = useRef(entries.at(-1)?.id);
  const [reaction, setReaction] = useState<AvatarReaction | null>(null);

  useEffect(() => {
    const next = getNewAvatarReaction(entries, previousEntryId.current);
    previousEntryId.current = entries.at(-1)?.id;
    if (!connected || entries.length === 0) setReaction(null);
    else if (next) setReaction(next);
  }, [entries, connected]);

  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), AVATAR_REACTION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [reaction]);

  return reaction;
}
