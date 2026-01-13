/**
 * Tests for useStagedLayOffs hook behavior.
 *
 * Note: These are behavioral tests that test the hook's logic without rendering.
 * We test the pure functions and state transitions that the hook encapsulates.
 */

import { describe, it, expect } from "bun:test";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import {
  createInitialState,
  stageCard,
  unstageCard,
  getStagedForMeld,
  type StagedLayOffsState,
} from "./useStagedLayOffs";

// Helper to create a card
function card(rank: Card["rank"], suit: Card["suit"], id?: string): Card {
  return { id: id ?? `${rank}-${suit}`, rank, suit };
}

// Helper to create a run meld
function runMeld(id: string, ownerId: string, cards: Card[]): Meld {
  return { id, type: "run", cards, ownerId };
}

// Helper to create a set meld
function setMeld(id: string, ownerId: string, cards: Card[]): Meld {
  return { id, type: "set", cards, ownerId };
}

describe("createInitialState", () => {
  it("should create empty state", () => {
    const state = createInitialState();
    expect(state.stagedLayOffs).toEqual([]);
  });
});

describe("stageCard", () => {
  describe("natural cards on runs", () => {
    it("should auto-determine position for first card (can only fit one end)", () => {
      // 6 can only fit at start of [7,8,9] run
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const melds = [meld];
      const hand = [card("6", "hearts", "card-6")];
      const state = createInitialState();

      const result = stageCard(state, "card-6", "m1", melds, hand);

      expect(result.staged).not.toBeNull();
      expect(result.staged?.position).toBe("start");
      expect(result.needsPositionPrompt).toBe(false);
    });

    it("should auto-determine position for second card using effective meld", () => {
      // This is THE bug fix test case
      // Run: [7,8,9,10]
      // First card: 6 staged at start -> effective: [6,7,8,9,10]
      // Second card: 5 should fit at start of effective meld
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
        card("10", "hearts"),
      ]);
      const melds = [meld];
      const sixOfHearts = card("6", "hearts", "card-6");
      const fiveOfHearts = card("5", "hearts", "card-5");
      const hand = [sixOfHearts, fiveOfHearts];

      // First, stage the 6
      let state = createInitialState();
      const result1 = stageCard(state, "card-6", "m1", melds, hand);
      expect(result1.staged?.position).toBe("start");

      // Apply the first staging
      state = {
        stagedLayOffs: [...state.stagedLayOffs, result1.staged!],
      };

      // Now stage the 5 - it should use the effective meld [6,7,8,9,10]
      const result2 = stageCard(state, "card-5", "m1", melds, hand);

      expect(result2.staged).not.toBeNull();
      expect(result2.staged?.position).toBe("start");
      expect(result2.needsPositionPrompt).toBe(false);
    });

    it("should auto-determine position for cards at end", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const melds = [meld];
      const hand = [card("10", "hearts", "card-10")];
      const state = createInitialState();

      const result = stageCard(state, "card-10", "m1", melds, hand);

      expect(result.staged?.position).toBe("end");
    });

    it("should stage multiple cards at end in sequence", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const melds = [meld];
      const tenOfHearts = card("10", "hearts", "card-10");
      const jackOfHearts = card("J", "hearts", "card-J");
      const hand = [tenOfHearts, jackOfHearts];

      // Stage the 10
      let state = createInitialState();
      const result1 = stageCard(state, "card-10", "m1", melds, hand);
      expect(result1.staged?.position).toBe("end");

      // Apply and stage the J
      state = { stagedLayOffs: [...state.stagedLayOffs, result1.staged!] };
      const result2 = stageCard(state, "card-J", "m1", melds, hand);

      expect(result2.staged?.position).toBe("end");
    });
  });

  describe("wild cards on runs", () => {
    it("should prompt for position when wild can fit both ends", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const melds = [meld];
      const wild = card("2", "spades", "wild-1");
      const hand = [wild];
      const state = createInitialState();

      const result = stageCard(state, "wild-1", "m1", melds, hand);

      expect(result.needsPositionPrompt).toBe(true);
      expect(result.staged).toBeNull();
    });

    it("should auto-determine wild position when only one end valid", () => {
      // Run ending at Ace - wild can only fit at start
      const meld = runMeld("m1", "p1", [
        card("Q", "hearts"),
        card("K", "hearts"),
        card("A", "hearts"),
      ]);
      const melds = [meld];
      const wild = card("2", "spades", "wild-1");
      const hand = [wild];
      const state = createInitialState();

      const result = stageCard(state, "wild-1", "m1", melds, hand);

      expect(result.needsPositionPrompt).toBe(false);
      expect(result.staged?.position).toBe("start");
    });

    it("should check wild against effective meld for position prompt", () => {
      // Run: [7,8,9,10]
      // Stage 6 at start -> effective: [6,7,8,9,10]
      // Wild: check against [6,7,8,9,10] - low is 6 (>3), high is 10 (<14)
      // Wild should still need prompt
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
        card("10", "hearts"),
      ]);
      const melds = [meld];
      const sixOfHearts = card("6", "hearts", "card-6");
      const wild = card("2", "spades", "wild-1");
      const hand = [sixOfHearts, wild];

      let state = createInitialState();
      const result1 = stageCard(state, "card-6", "m1", melds, hand);
      state = { stagedLayOffs: [result1.staged!] };

      const result2 = stageCard(state, "wild-1", "m1", melds, hand);

      // Effective meld is [6,7,8,9,10], wild can fit at both ends (5 or J position)
      expect(result2.needsPositionPrompt).toBe(true);
    });

    it("should auto-determine wild when effective meld constrains to one end", () => {
      // Run: [4,5,6,7]
      // Stage 3 at start -> effective: [3,4,5,6,7]
      // Wild: check against [3,4,5,6,7] - low is 3 (not >3), high is 7 (<14)
      // Wild can only fit at end
      const meld = runMeld("m1", "p1", [
        card("4", "hearts"),
        card("5", "hearts"),
        card("6", "hearts"),
        card("7", "hearts"),
      ]);
      const melds = [meld];
      const threeOfHearts = card("3", "hearts", "card-3");
      const wild = card("2", "spades", "wild-1");
      const hand = [threeOfHearts, wild];

      let state = createInitialState();
      const result1 = stageCard(state, "card-3", "m1", melds, hand);
      state = { stagedLayOffs: [result1.staged!] };

      const result2 = stageCard(state, "wild-1", "m1", melds, hand);

      // Effective meld is [3,4,5,6,7], wild can only fit at end (8 position)
      expect(result2.needsPositionPrompt).toBe(false);
      expect(result2.staged?.position).toBe("end");
    });
  });

  describe("cards on sets", () => {
    it("should stage card to set without position", () => {
      const meld = setMeld("m1", "p1", [
        card("7", "hearts"),
        card("7", "diamonds"),
        card("7", "clubs"),
      ]);
      const melds = [meld];
      const hand = [card("7", "spades", "card-7")];
      const state = createInitialState();

      const result = stageCard(state, "card-7", "m1", melds, hand);

      expect(result.staged).not.toBeNull();
      expect(result.staged?.position).toBeUndefined();
      expect(result.needsPositionPrompt).toBe(false);
    });
  });

  describe("error cases", () => {
    it("should return null staged when card not found in hand", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const melds = [meld];
      const hand: Card[] = [];
      const state = createInitialState();

      const result = stageCard(state, "missing-card", "m1", melds, hand);

      expect(result.staged).toBeNull();
      expect(result.needsPositionPrompt).toBe(false);
    });

    it("should return null staged when meld not found", () => {
      const hand = [card("6", "hearts", "card-6")];
      const melds: Meld[] = [];
      const state = createInitialState();

      const result = stageCard(state, "card-6", "missing-meld", melds, hand);

      expect(result.staged).toBeNull();
    });
  });
});

describe("stageCard with explicit position", () => {
  it("should use provided position for wild card", () => {
    const meld = runMeld("m1", "p1", [
      card("7", "hearts"),
      card("8", "hearts"),
      card("9", "hearts"),
    ]);
    const melds = [meld];
    const wild = card("2", "spades", "wild-1");
    const hand = [wild];
    const state = createInitialState();

    const result = stageCard(state, "wild-1", "m1", melds, hand, "start");

    expect(result.staged?.position).toBe("start");
    expect(result.needsPositionPrompt).toBe(false);
  });
});

describe("unstageCard", () => {
  it("should remove a staged card", () => {
    const state: StagedLayOffsState = {
      stagedLayOffs: [
        { cardId: "card-1", meldId: "m1", position: "start" },
        { cardId: "card-2", meldId: "m1", position: "end" },
      ],
    };

    const result = unstageCard(state, "card-1");

    expect(result.stagedLayOffs).toHaveLength(1);
    expect(result.stagedLayOffs[0]?.cardId).toBe("card-2");
  });

  it("should handle removing non-existent card", () => {
    const state: StagedLayOffsState = {
      stagedLayOffs: [{ cardId: "card-1", meldId: "m1", position: "start" }],
    };

    const result = unstageCard(state, "not-staged");

    expect(result.stagedLayOffs).toHaveLength(1);
  });
});

describe("getStagedForMeld", () => {
  it("should return only staged cards for the specified meld", () => {
    const card1 = card("6", "hearts", "card-1");
    const card2 = card("10", "hearts", "card-2");
    const card3 = card("7", "clubs", "card-3");
    const hand = [card1, card2, card3];
    const stagedLayOffs = [
      { cardId: "card-1", meldId: "m1", position: "start" as const },
      { cardId: "card-2", meldId: "m1", position: "end" as const },
      { cardId: "card-3", meldId: "m2", position: "end" as const },
    ];

    const result = getStagedForMeld("m1", stagedLayOffs, hand);

    expect(result).toHaveLength(2);
    expect(result[0]?.card.id).toBe("card-1");
    expect(result[0]?.position).toBe("start");
    expect(result[1]?.card.id).toBe("card-2");
  });

  it("should return empty array for meld with no staged cards", () => {
    const stagedLayOffs = [
      { cardId: "card-1", meldId: "m1", position: "start" as const },
    ];

    const result = getStagedForMeld("m2", stagedLayOffs, []);

    expect(result).toHaveLength(0);
  });

  it("should filter out cards not found in hand", () => {
    const card1 = card("6", "hearts", "card-1");
    const hand = [card1]; // card-2 is not in hand
    const stagedLayOffs = [
      { cardId: "card-1", meldId: "m1", position: "start" as const },
      { cardId: "card-2", meldId: "m1", position: "end" as const },
    ];

    const result = getStagedForMeld("m1", stagedLayOffs, hand);

    expect(result).toHaveLength(1);
    expect(result[0]?.card.id).toBe("card-1");
  });
});
