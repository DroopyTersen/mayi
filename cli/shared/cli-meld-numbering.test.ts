import { describe, it, expect } from "bun:test";
import { getNumberedMelds } from "./cli-meld-numbering";
import type { Player } from "../../core/engine/engine.types";
import type { Meld } from "../../core/meld/meld.types";

describe("getNumberedMelds", () => {
  const mockPlayers: Player[] = [
    { id: "p1", name: "Alice", hand: [], isDown: true, totalScore: 0 },
    { id: "p2", name: "Bob", hand: [], isDown: true, totalScore: 0 },
  ];

  it("returns empty array for empty table", () => {
    const result = getNumberedMelds([], mockPlayers);
    expect(result).toEqual([]);
  });

  it("numbers melds starting from 1", () => {
    const table: Meld[] = [
      { id: "m1", type: "set", cards: [], ownerId: "p1" },
      { id: "m2", type: "run", cards: [], ownerId: "p2" },
      { id: "m3", type: "set", cards: [], ownerId: "p1" },
    ];

    const result = getNumberedMelds(table, mockPlayers);

    expect(result.length).toBe(3);
    expect(result[0]?.meldNumber).toBe(1);
    expect(result[1]?.meldNumber).toBe(2);
    expect(result[2]?.meldNumber).toBe(3);
  });

  it("includes the original meld object", () => {
    const meld: Meld = {
      id: "m1",
      type: "run",
      cards: [
        { id: "c1", rank: "5", suit: "hearts" },
        { id: "c2", rank: "6", suit: "hearts" },
        { id: "c3", rank: "7", suit: "hearts" },
        { id: "c4", rank: "8", suit: "hearts" },
      ],
      ownerId: "p1",
    };
    const table: Meld[] = [meld];

    const result = getNumberedMelds(table, mockPlayers);

    expect(result[0]?.meld).toBe(meld);
  });

  it("resolves owner from players array", () => {
    const table: Meld[] = [
      { id: "m1", type: "set", cards: [], ownerId: "p1" },
      { id: "m2", type: "run", cards: [], ownerId: "p2" },
    ];

    const result = getNumberedMelds(table, mockPlayers);

    expect(result[0]?.owner?.name).toBe("Alice");
    expect(result[1]?.owner?.name).toBe("Bob");
  });

  it("sets owner to null for unknown ownerId", () => {
    const table: Meld[] = [{ id: "m1", type: "set", cards: [], ownerId: "unknown" }];

    const result = getNumberedMelds(table, mockPlayers);

    expect(result[0]?.owner).toBeNull();
  });

  it("preserves table order (engine is source of truth)", () => {
    const table: Meld[] = [
      { id: "m3", type: "set", cards: [], ownerId: "p2" },
      { id: "m1", type: "run", cards: [], ownerId: "p1" },
      { id: "m2", type: "set", cards: [], ownerId: "p1" },
    ];

    const result = getNumberedMelds(table, mockPlayers);

    // Numbers follow table array order, not meld ids
    expect(result[0]?.meld.id).toBe("m3");
    expect(result[0]?.meldNumber).toBe(1);
    expect(result[1]?.meld.id).toBe("m1");
    expect(result[1]?.meldNumber).toBe(2);
    expect(result[2]?.meld.id).toBe("m2");
    expect(result[2]?.meldNumber).toBe(3);
  });
});
