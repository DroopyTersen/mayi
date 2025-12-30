import { describe, it, expect } from "bun:test";
import {
  formatActivityEntry,
  formatRecentActivity,
  getRecentEntries,
} from "./cli.activity";
import type { ActionLogEntry } from "./cli.types";

function makeEntry(
  playerId: string,
  playerName: string,
  action: string,
  details?: string
): ActionLogEntry {
  return {
    timestamp: "2025-01-01T12:00:00.000Z",
    turnNumber: 1,
    roundNumber: 1,
    playerId,
    playerName,
    action,
    details,
  };
}

describe("formatActivityEntry", () => {
  it("formats draw from stock", () => {
    const entry = makeEntry("player-1", "Alice", "drew from stock", "10♦");
    expect(formatActivityEntry(entry)).toBe("Alice: drew from stock");
  });

  it("formats draw from discard with card", () => {
    const entry = makeEntry("player-1", "Alice", "drew from discard", "7♥");
    expect(formatActivityEntry(entry)).toBe("Alice: took 7♥ from discard");
  });

  it("formats discard with card", () => {
    const entry = makeEntry("player-1", "Alice", "discarded", "K♣");
    expect(formatActivityEntry(entry)).toBe("Alice: discarded K♣");
  });

  it("formats laid down contract without details", () => {
    const entry = makeEntry("player-1", "Alice", "laid down contract", "set: 3♠ 3♥ 3♦");
    expect(formatActivityEntry(entry)).toBe("Alice: laid down contract");
  });

  it("formats laid off with details", () => {
    const entry = makeEntry("player-1", "Alice", "laid off", "2♦ to meld 2");
    expect(formatActivityEntry(entry)).toBe("Alice: laid off 2♦ to meld 2");
  });

  it("formats called May I", () => {
    const entry = makeEntry("player-1", "Alice", "called May I", "7♥");
    expect(formatActivityEntry(entry)).toBe("Alice: called May I on 7♥");
  });

  it("formats won May I with penalty hidden", () => {
    // Penalty card should be hidden from other players - only the discard is public
    const entry = makeEntry("player-1", "Alice", "won May I", "7♥ + penalty card");
    expect(formatActivityEntry(entry)).toBe("Alice: won May I (7♥ + penalty card)");
  });

  it("formats swapped Joker", () => {
    const entry = makeEntry("player-1", "Alice", "swapped Joker", "8♣ for Joker from meld 2");
    expect(formatActivityEntry(entry)).toBe("Alice: swapped 8♣ for Joker from meld 2");
  });

  it("formats went out", () => {
    const entry = makeEntry("player-1", "Alice", "went out!", "");
    expect(formatActivityEntry(entry)).toBe("Alice: went out!");
  });

  it("shows 'You' for human player (player-0)", () => {
    const entry = makeEntry("player-0", "You", "drew from stock", "10♦");
    expect(formatActivityEntry(entry)).toBe("You: drew from stock");
  });

  it("returns null for system messages", () => {
    const entry = makeEntry("system", "System", "started round", "Round 1");
    expect(formatActivityEntry(entry)).toBeNull();
  });

  it("returns null for skipped laying down", () => {
    const entry = makeEntry("player-1", "Alice", "skipped laying down");
    expect(formatActivityEntry(entry)).toBeNull();
  });

  it("returns null for passed on May I", () => {
    const entry = makeEntry("player-1", "Alice", "passed on May I", "7♥");
    expect(formatActivityEntry(entry)).toBeNull();
  });
});

describe("getRecentEntries", () => {
  it("returns empty array for empty log", () => {
    expect(getRecentEntries([], 6)).toEqual([]);
  });

  it("returns all entries if fewer than count", () => {
    const entries = [
      makeEntry("player-1", "Alice", "drew from stock", "10♦"),
      makeEntry("player-1", "Alice", "discarded", "K♣"),
    ];
    expect(getRecentEntries(entries, 6)).toHaveLength(2);
  });

  it("returns last N entries", () => {
    const entries = [
      makeEntry("player-1", "Alice", "drew from stock", "1♦"),
      makeEntry("player-1", "Alice", "discarded", "2♦"),
      makeEntry("player-2", "Bob", "drew from stock", "3♦"),
      makeEntry("player-2", "Bob", "discarded", "4♦"),
      makeEntry("player-1", "Alice", "drew from stock", "5♦"),
      makeEntry("player-1", "Alice", "discarded", "6♦"),
    ];
    const recent = getRecentEntries(entries, 3);
    expect(recent).toHaveLength(3);
    expect(recent[0]!.details).toBe("4♦");
    expect(recent[2]!.details).toBe("6♦");
  });

  it("filters out system messages before taking last N", () => {
    const entries = [
      makeEntry("player-1", "Alice", "drew from stock", "1♦"),
      makeEntry("system", "System", "May I window closed", "no claims"),
      makeEntry("player-1", "Alice", "discarded", "2♦"),
    ];
    const recent = getRecentEntries(entries, 6);
    expect(recent).toHaveLength(2);
    expect(recent.every((e) => e.playerId !== "system")).toBe(true);
  });

  it("filters out skipped/passed actions before taking last N", () => {
    const entries = [
      makeEntry("player-1", "Alice", "drew from stock", "1♦"),
      makeEntry("player-1", "Alice", "skipped laying down"),
      makeEntry("player-2", "Bob", "passed on May I", "1♦"),
      makeEntry("player-1", "Alice", "discarded", "2♦"),
    ];
    const recent = getRecentEntries(entries, 6);
    expect(recent).toHaveLength(2);
  });
});

describe("formatRecentActivity", () => {
  it("returns empty array for empty log", () => {
    expect(formatRecentActivity([], 6)).toEqual([]);
  });

  it("formats and returns recent entries", () => {
    const entries = [
      makeEntry("player-1", "Alice", "drew from stock", "10♦"),
      makeEntry("player-1", "Alice", "discarded", "K♣"),
      makeEntry("player-2", "Bob", "drew from stock", "7♥"),
      makeEntry("player-2", "Bob", "discarded", "Q♠"),
    ];
    const lines = formatRecentActivity(entries, 6);
    expect(lines).toEqual([
      "Alice: drew from stock",
      "Alice: discarded K♣",
      "Bob: drew from stock",
      "Bob: discarded Q♠",
    ]);
  });

  it("respects count limit", () => {
    const entries = [
      makeEntry("player-1", "Alice", "drew from stock", "1♦"),
      makeEntry("player-1", "Alice", "discarded", "2♦"),
      makeEntry("player-2", "Bob", "drew from stock", "3♦"),
      makeEntry("player-2", "Bob", "discarded", "4♦"),
      makeEntry("player-1", "Alice", "drew from stock", "5♦"),
      makeEntry("player-1", "Alice", "discarded", "6♦"),
    ];
    const lines = formatRecentActivity(entries, 3);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("4♦");
  });

  it("filters before formatting", () => {
    const entries = [
      makeEntry("player-1", "Alice", "drew from stock", "10♦"),
      makeEntry("system", "System", "May I window closed", "no claims"),
      makeEntry("player-1", "Alice", "skipped laying down"),
      makeEntry("player-1", "Alice", "discarded", "K♣"),
    ];
    const lines = formatRecentActivity(entries, 6);
    expect(lines).toEqual([
      "Alice: drew from stock",
      "Alice: discarded K♣",
    ]);
  });
});
