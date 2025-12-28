import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";
import type { Card } from "../card/card.types";

// Helper to create a card
function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

// Helper to create a basic turn input
function createTurnInput() {
  return {
    playerId: "player-1",
    hand: [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")],
    stock: [card("K", "spades"), card("Q", "hearts")],
    discard: [card("5", "clubs")],
    roundNumber: 1 as const,
    isDown: false,
    table: [],
  };
}

describe("TurnMachine - drawn state", () => {
  describe("state structure", () => {
    it("after drawing, enters 'drawn' state (not directly to awaitingDiscard)", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();

      expect(actor.getSnapshot().value).toBe("awaitingDraw");

      actor.send({ type: "DRAW_FROM_STOCK" });

      // Should now be in 'drawn' state, not 'awaitingDiscard'
      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("hasDrawn is true", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();

      expect(actor.getSnapshot().context.hasDrawn).toBe(false);

      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hasDrawn).toBe(true);
    });

    it("player can choose to lay down or proceed to discard", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("drawn");

      // Check that both LAY_DOWN and SKIP_LAY_DOWN events are possible
      // We verify by checking the state allows these transitions
      expect(snapshot.can({ type: "SKIP_LAY_DOWN" })).toBe(true);
      // LAY_DOWN would require valid melds, so we just check the state structure
    });
  });

  describe("proceeding without laying down", () => {
    it("SKIP_LAY_DOWN transitions to 'awaitingDiscard'", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("drawn");

      actor.send({ type: "SKIP_LAY_DOWN" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("player remains not down (isDown: false)", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });

      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("hand unchanged (still has drawn card)", () => {
      const input = createTurnInput();
      const initialHandSize = input.hand.length;
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handAfterDraw = actor.getSnapshot().context.hand;
      expect(handAfterDraw.length).toBe(initialHandSize + 1);

      actor.send({ type: "SKIP_LAY_DOWN" });

      // Hand should still have the drawn card
      expect(actor.getSnapshot().context.hand.length).toBe(initialHandSize + 1);
      expect(actor.getSnapshot().context.hand).toEqual(handAfterDraw);
    });

    it("can proceed even if player could lay down (optional action)", () => {
      // Player has cards for a valid contract but chooses not to lay down
      const input = {
        ...createTurnInput(),
        hand: [
          // Two valid sets for round 1
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("K", "clubs"), card("K", "diamonds"), card("K", "hearts"),
          card("5", "spades"), // Extra card
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player can skip laying down even though they could
      actor.send({ type: "SKIP_LAY_DOWN" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });
  });
});

describe("TurnMachine - LAY_DOWN command", () => {
  describe("preconditions", () => {
    it.todo("rejects if player has not drawn yet (state is awaitingDraw)", () => {});
    it.todo("rejects if player is already down this round (isDown: true)", () => {});
    it.todo("rejects if melds do not match contract", () => {});
    it.todo("rejects if any meld is invalid", () => {});
    it.todo("state unchanged on any rejection", () => {});
  });

  describe("successful lay down - Round 1 (2 sets)", () => {
    it.todo("accepts valid 2 sets", () => {});
    it.todo("example: (9C 9D 9H) and (KC KD KS)", () => {});
    it.todo("removes meld cards from player's hand", () => {});
    it.todo("adds melds to table", () => {});
    it.todo("sets isDown to true", () => {});
    it.todo("sets laidDownThisTurn to true", () => {});
    it.todo("transitions to awaitingDiscard (auto-transition)", () => {});
  });

  describe("successful lay down - Round 2 (1 set + 1 run)", () => {
    it.todo("accepts valid 1 set and 1 run", () => {});
    it.todo("example: (9C 9D 9H) and (5S 6S 7S 8S)", () => {});
    it.todo("both melds added to table", () => {});
    it.todo("player marked as down", () => {});
  });

  describe("successful lay down - Round 3 (2 runs)", () => {
    it.todo("accepts valid 2 runs", () => {});
    it.todo("example: (3D 4D 5D 6D) and (JH QH KH AH)", () => {});
    it.todo("minimum 8 cards used", () => {});
  });

  describe("successful lay down - Round 4 (3 sets)", () => {
    it.todo("accepts valid 3 sets", () => {});
    it.todo("example: (3C 3D 3H) and (7S 7D 7C) and (QH QS QD)", () => {});
    it.todo("minimum 9 cards used", () => {});
  });

  describe("successful lay down - Round 5 (2 sets + 1 run)", () => {
    it.todo("accepts valid 2 sets and 1 run", () => {});
    it.todo("minimum 10 cards used", () => {});
  });

  describe("successful lay down - Round 6 (1 set + 2 runs)", () => {
    it.todo("accepts valid 1 set and 2 runs", () => {});
    it.todo("minimum 11 cards used", () => {});
  });

  describe("melds with wilds", () => {
    it.todo("accepts set with valid wild ratio: (9C 9D Joker)", () => {});
    it.todo("accepts set with equal wilds/naturals: (9C 9D 2H Joker) - 2 natural, 2 wild", () => {});
    it.todo("accepts run with wild filling gap: (5S 6S Joker 8S)", () => {});
    it.todo("accepts run with wild at end: (5S 6S 7S 2C)", () => {});
    it.todo("rejects set with too many wilds: (9C Joker Joker)", () => {});
    it.todo("rejects run with too many wilds: (5S Joker Joker 2C) - 1 natural, 3 wild", () => {});
    it.todo("each meld validated independently for wild ratio", () => {});
  });

  describe("larger than minimum melds", () => {
    it.todo("accepts 4-card set: (9C 9D 9H 9S)", () => {});
    it.todo("accepts 5-card set: (9C 9D 9H 9S 9C) - duplicate from multi-deck", () => {});
    it.todo("accepts 5-card run: (5S 6S 7S 8S 9S)", () => {});
    it.todo("accepts 6+ card run: (5S 6S 7S 8S 9S 10S)", () => {});
    it.todo("larger melds still count as 1 set or 1 run toward contract", () => {});
  });

  describe("card removal from hand", () => {
    it.todo("only cards in melds are removed from hand", () => {});
    it.todo("remaining cards stay in hand", () => {});
    it.todo("hand size = previous size - cards laid down", () => {});
    it.todo("example: 12 cards - 6 laid down = 6 remaining", () => {});
    it.todo("correct cards removed (verified by cardId)", () => {});
  });

  describe("meld ownership", () => {
    it.todo("each meld has ownerId set to current player", () => {});
    it.todo("melds appear on table with correct owner", () => {});
    it.todo("multiple players' melds can coexist on table", () => {});
  });
});

describe("TurnMachine - invalid LAY_DOWN scenarios", () => {
  describe("wrong number of melds", () => {
    it.todo("round 1: rejects 1 set (need 2)", () => {});
    it.todo("round 1: rejects 3 sets (too many)", () => {});
    it.todo("round 2: rejects 2 sets + 0 runs (wrong combination)", () => {});
    it.todo("round 2: rejects 0 sets + 2 runs (wrong combination)", () => {});
    it.todo("provides clear error message about contract requirement", () => {});
  });

  describe("invalid individual melds", () => {
    it.todo("rejects if first meld is invalid, even if second is valid", () => {});
    it.todo("rejects if second meld is invalid, even if first is valid", () => {});
    it.todo("rejects set with different ranks: (9C 10D JH)", () => {});
    it.todo("rejects run with gap: (5S 6S 8S 9S)", () => {});
    it.todo("rejects run with mixed suits: (5S 6H 7S 8S)", () => {});
    it.todo("rejects run with only 3 cards: (5S 6S 7S)", () => {});
    it.todo("rejects set with only 2 cards: (9C 9D)", () => {});
    it.todo("provides specific error about which meld is invalid", () => {});
  });

  describe("card not in hand", () => {
    it.todo("rejects if any cardId in melds is not in player's hand", () => {});
    it.todo("rejects if cardId belongs to another player", () => {});
    it.todo("rejects if cardId is on the table already", () => {});
    it.todo("rejects if cardId does not exist", () => {});
  });

  describe("duplicate card usage", () => {
    it.todo("rejects if same cardId appears in two melds", () => {});
    it.todo("rejects overlapping cardIds (bug/cheat attempt)", () => {});
  });

  describe("already down", () => {
    it.todo("rejects LAY_DOWN if player already laid down this round", () => {});
    it.todo("isDown: true prevents any further lay down attempts", () => {});
    it.todo("error message: already laid down this round", () => {});
  });
});

describe("TurnMachine - post lay down behavior", () => {
  describe("auto-transition to awaitingDiscard", () => {
    it.todo("after successful LAY_DOWN, state becomes awaitingDiscard", () => {});
    it.todo("laidDownThisTurn flag causes this auto-transition", () => {});
    it.todo("player cannot stay in 'drawn' state after laying down", () => {});
  });

  describe("turn end after laying down", () => {
    it.todo("if hand.length > 0: must discard one card to end turn", () => {});
    it.todo("if hand.length === 0: goes out immediately (no discard)", () => {});
  });

  describe("cannot lay off on same turn", () => {
    it.todo("LAY_OFF command rejected when laidDownThisTurn is true", () => {});
    it.todo("error: cannot lay off on same turn as laying down", () => {});
    it.todo("must wait until next turn to lay off", () => {});
  });

  describe("cannot lay down again", () => {
    it.todo("second LAY_DOWN command rejected", () => {});
    it.todo("isDown already true", () => {});
  });
});

describe("TurnMachine - turn completion after lay down", () => {
  describe("discard after laying down", () => {
    it.todo("from awaitingDiscard, DISCARD command works normally", () => {});
    it.todo("card removed from hand, added to discard pile", () => {});
    it.todo("transitions to turnComplete", () => {});
    it.todo("output includes updated hand, table, discard", () => {});
  });

  describe("turn output reflects lay down", () => {
    it.todo("output.isDown is true", () => {});
    it.todo("output.table includes new melds", () => {});
    it.todo("output.hand is reduced by meld cards + discard", () => {});
  });
});
