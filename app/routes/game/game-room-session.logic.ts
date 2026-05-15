import { formatCardText } from "core/card/card-text.utils";
import type {
  ActivityLogEntry,
  MayINotificationMessage,
  MayIResolvedMessage,
} from "~/party/protocol.types";
import type { ActivityEntry } from "~/ui/game-view/game-view.types";
import type { MayINotificationState } from "./game-room-session.types";
import { formatActivityEntry } from "core/activity/activity-log.format";

const MAY_I_RESOLUTION_VISIBLE_MS = 5000;

export function createMayINotification(
  message: MayINotificationMessage
): MayINotificationState {
  return {
    callerId: message.callerId,
    callerName: message.callerName,
    cardText: formatCardText(message.card),
    expiresAt: null,
  };
}

export function resolveMayINotification(
  previous: MayINotificationState | null,
  message: MayIResolvedMessage,
  now: number
): MayINotificationState | null {
  if (!previous) {
    return null;
  }

  return {
    ...previous,
    outcome: message.outcome === "resolved" ? "allowed" : "blocked",
    expiresAt: now + MAY_I_RESOLUTION_VISIBLE_MS,
  };
}

export function formatActivityLogEntries(
  entries: ActivityLogEntry[]
): ActivityEntry[] {
  return entries
    .map((entry) => {
      const message = formatActivityEntry(entry, { humanPlayerId: null });
      return message ? { id: entry.id, message } : null;
    })
    .filter((entry): entry is ActivityEntry => entry !== null);
}
