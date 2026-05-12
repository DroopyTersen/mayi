import { describe, expect, it } from "bun:test";
import type { ActivityLogEntry, MayIResolvedMessage } from "~/party/protocol.types";
import {
  createMayINotification,
  formatActivityLogEntries,
  resolveMayINotification,
} from "./game-room-session.logic";

describe("game room session view state", () => {
  it("creates a pending May I notification with formatted card text", () => {
    const notification = createMayINotification({
      type: "MAY_I_NOTIFICATION",
      callerId: "player-1",
      callerName: "Andrew",
      card: { id: "queen-spades", rank: "Q", suit: "spades" },
    });

    expect(notification).toEqual({
      callerId: "player-1",
      callerName: "Andrew",
      cardText: "Q♠",
      expiresAt: null,
    });
  });

  it("marks a resolved May I notification as allowed and expiring", () => {
    const previous = {
      callerId: "player-1",
      callerName: "Andrew",
      cardText: "Q♠",
      expiresAt: null,
    };
    const message: MayIResolvedMessage = {
      type: "MAY_I_RESOLVED",
      winnerId: "player-1",
      outcome: "resolved",
    };

    expect(resolveMayINotification(previous, message, 1000)).toEqual({
      ...previous,
      outcome: "allowed",
      expiresAt: 6000,
    });
  });

  it("marks a non-resolved May I notification as blocked", () => {
    const previous = {
      callerId: "player-1",
      callerName: "Andrew",
      cardText: "Q♠",
      expiresAt: null,
    };
    const message: MayIResolvedMessage = {
      type: "MAY_I_RESOLVED",
      winnerId: "player-2",
      outcome: "blocked",
    };

    expect(resolveMayINotification(previous, message, 1000)?.outcome).toBe(
      "blocked"
    );
  });

  it("ignores resolution when no notification is visible", () => {
    const message: MayIResolvedMessage = {
      type: "MAY_I_RESOLVED",
      winnerId: null,
      outcome: "resolved",
    };

    expect(resolveMayINotification(null, message, 1000)).toBeNull();
  });

  it("formats activity entries for GameView", () => {
    const entries: ActivityLogEntry[] = [
      {
        id: "entry-1",
        timestamp: "2026-05-12T00:00:00.000Z",
        roundNumber: 1,
        turnNumber: 2,
        playerId: "player-1",
        playerName: "Andrew",
        action: "discarded",
        details: "Q♠",
      },
      {
        id: "entry-2",
        timestamp: "2026-05-12T00:00:01.000Z",
        roundNumber: 1,
        turnNumber: 3,
        playerId: "player-2",
        playerName: "Mom",
        action: "drew from the draw pile",
      },
    ];

    expect(formatActivityLogEntries(entries)).toEqual([
      { id: "entry-1", message: "Andrew: discarded Q♠" },
      { id: "entry-2", message: "Mom: drew from the draw pile" },
    ]);
  });
});
