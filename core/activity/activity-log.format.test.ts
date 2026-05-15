import { describe, expect, it } from "bun:test";
import {
  createActivityLogEntry,
  formatActivityEntry,
  formatRecentActivity,
  getRecentActivityEntries,
} from "./activity-log.format";
import type { RoundNumber } from "../engine/engine.types";

function entry(action: string, details?: string) {
  return createActivityLogEntry({
    context: {
      roundNumber: 1 as RoundNumber,
      turnNumber: 2,
      players: [
        { id: "player-0", name: "Alice" },
        { id: "player-1", name: "Bob" },
      ],
    },
    playerId: "player-1",
    action,
    details,
    timestamp: "2026-05-14T00:00:00.000Z",
  });
}

describe("activity log formatting", () => {
  it("creates shared activity entries from game context", () => {
    expect(
      createActivityLogEntry({
        context: {
          roundNumber: 3 as RoundNumber,
          turnNumber: 8,
          players: [{ id: "player-1", name: "Bob" }],
        },
        id: "log-42",
        playerId: "player-1",
        action: "discarded",
        details: "Q♠",
        timestamp: "2026-05-14T00:00:00.000Z",
      })
    ).toEqual({
      id: "log-42",
      timestamp: "2026-05-14T00:00:00.000Z",
      roundNumber: 3,
      turnNumber: 8,
      playerId: "player-1",
      playerName: "Bob",
      action: "discarded",
      details: "Q♠",
    });
  });

  it("formats draw and discard actions", () => {
    expect(formatActivityEntry(entry("drew from stock"))).toBe(
      "Bob: drew from stock"
    );
    expect(formatActivityEntry(entry("drew from the draw pile"))).toBe(
      "Bob: drew from the draw pile"
    );
    expect(formatActivityEntry(entry("drew from discard", "7♥"))).toBe(
      "Bob: took 7♥ from discard"
    );
    expect(formatActivityEntry(entry("took from discard", "7♥"))).toBe(
      "Bob: took 7♥ from discard"
    );
    expect(formatActivityEntry(entry("discarded", "K♣"))).toBe(
      "Bob: discarded K♣"
    );
  });

  it("formats meld and joker actions", () => {
    expect(formatActivityEntry(entry("laid down contract"))).toBe(
      "Bob: laid down contract"
    );
    expect(formatActivityEntry(entry("laid down", "Set: 3♠ 3♥ 3♦"))).toBe(
      "Bob: laid down Set: 3♠ 3♥ 3♦"
    );
    expect(formatActivityEntry(entry("laid off", "2♦ to meld 2"))).toBe(
      "Bob: laid off 2♦ to meld 2"
    );
    expect(formatActivityEntry(entry("laid off at start", "2♦"))).toBe(
      "Bob: laid off at start 2♦"
    );
    expect(formatActivityEntry(entry("swapped Joker", "8♣ into Alice's set"))).toBe(
      "Bob: swapped 8♣ into Alice's set"
    );
  });

  it("formats May-I and go-out actions", () => {
    expect(formatActivityEntry(entry("called May I", "Q♠"))).toBe(
      "Bob: called May I on Q♠"
    );
    expect(formatActivityEntry(entry("allowed May I"))).toBe(
      "Bob: allowed May I"
    );
    expect(formatActivityEntry(entry("claimed May I", "Q♠"))).toBe(
      "Bob: claimed May I on Q♠"
    );
    expect(formatActivityEntry(entry("won May I", "Q♠ + penalty card"))).toBe(
      "Bob: won May I (Q♠ + penalty card)"
    );
    expect(formatActivityEntry(entry("took the May I card", "Q♠"))).toBe(
      "Bob: took the May I card Q♠"
    );
    expect(formatActivityEntry(entry("went out"))).toBe("Bob: went out!");
    expect(formatActivityEntry(entry("went out!"))).toBe("Bob: went out!");
  });

  it("uses a configurable human label", () => {
    const humanEntry = createActivityLogEntry({
      context: {
        roundNumber: 1 as RoundNumber,
        turnNumber: 1,
        players: [{ id: "player-0", name: "Alice" }],
      },
      playerId: "player-0",
      action: "discarded",
      details: "Q♠",
      timestamp: "2026-05-14T00:00:00.000Z",
    });

    expect(formatActivityEntry(humanEntry)).toBe("You: discarded Q♠");
    expect(formatActivityEntry(humanEntry, { humanPlayerId: null })).toBe(
      "Alice: discarded Q♠"
    );
  });

  it("filters noisy entries before taking recent activity", () => {
    const entries = [
      entry("drew from stock"),
      entry("skipped laying down"),
      entry("passed on May I"),
      createActivityLogEntry({
        context: {
          roundNumber: 1 as RoundNumber,
          turnNumber: 3,
          players: [],
        },
        playerId: "system",
        action: "started round",
        timestamp: "2026-05-14T00:00:00.000Z",
      }),
      entry("discarded", "Q♠"),
    ];

    expect(getRecentActivityEntries(entries, 3)).toHaveLength(2);
    expect(formatRecentActivity(entries, 3)).toEqual([
      "Bob: drew from stock",
      "Bob: discarded Q♠",
    ]);
  });
});
