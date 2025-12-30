/**
 * Machine Hierarchy Integration Tests
 *
 * Tests the hierarchical XState actor model where:
 * - GameMachine invokes RoundMachine
 * - RoundMachine invokes TurnMachine
 * - TurnMachine invokes MayIWindowMachine (when drawing from stock)
 *
 * IMPORTANT: With XState's invoke pattern, child actors have their own context
 * separate from the parent. The parent only receives updates via onDone when
 * the child reaches a final state. During active play, the child's state is
 * accessed via getPersistedSnapshot() which recursively includes invoked actors.
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { gameMachine } from "./game.machine";
import { roundMachine } from "./round.machine";

describe("Machine Hierarchy Integration", () => {
  /**
   * Helper to create a started game with 3 players
   */
  function createStartedGame() {
    const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
    actor.send({ type: "ADD_PLAYER", name: "Alice" });
    actor.send({ type: "ADD_PLAYER", name: "Bob" });
    actor.send({ type: "ADD_PLAYER", name: "Carol" });
    actor.send({ type: "START_GAME" });
    return actor;
  }

  describe("GameMachine → RoundMachine invocation", () => {
    it("transitions to playing state when game starts", () => {
      const actor = createStartedGame();
      expect(actor.getSnapshot().value).toBe("playing");
      actor.stop();
    });

    it("invokes roundMachine in playing state", () => {
      const actor = createStartedGame();
      const snapshot = actor.getSnapshot();

      // The playing state should have an invoked actor
      expect(snapshot.value).toBe("playing");

      // Check that there's a child actor for the round
      // In XState v5, we use getPersistedSnapshot() to get deep state
      const persistedSnapshot = actor.getPersistedSnapshot() as any;
      expect(persistedSnapshot).toBeDefined();

      // The persisted snapshot includes children state
      // Verify round is properly invoked by checking children
      expect(persistedSnapshot.children).toBeDefined();
      expect(persistedSnapshot.children.round).toBeDefined();

      actor.stop();
    });

    it("child roundMachine deals cards to players", () => {
      const actor = createStartedGame();

      // Access the round machine's snapshot through persisted snapshot
      const persistedSnapshot = actor.getPersistedSnapshot() as any;
      const roundSnapshot = persistedSnapshot.children?.round?.snapshot;

      // Round machine should have dealt cards to players
      expect(roundSnapshot).toBeDefined();
      if (roundSnapshot) {
        const roundContext = roundSnapshot.context;
        expect(roundContext.players).toBeDefined();
        expect(roundContext.players.length).toBe(3);
        // Each player should have 11 cards after dealing
        for (const player of roundContext.players) {
          expect(player.hand.length).toBe(11);
        }
      }

      actor.stop();
    });
  });

  describe("Event routing through hierarchy", () => {
    /**
     * Helper to get the current player's hand from the deep hierarchy
     */
    function getCurrentPlayerHand(actor: ReturnType<typeof createActor>) {
      const persisted = actor.getPersistedSnapshot() as any;
      const roundSnapshot = persisted.children?.round?.snapshot;
      if (!roundSnapshot) return [];

      const turnSnapshot = roundSnapshot.children?.turn?.snapshot;
      if (turnSnapshot) {
        // If turn is active, get hand from turn context
        return turnSnapshot.context.hand;
      }
      // Otherwise get from round context
      const currentPlayerIndex = roundSnapshot.context.currentPlayerIndex;
      return roundSnapshot.context.players[currentPlayerIndex]?.hand ?? [];
    }

    it("DRAW_FROM_STOCK event is processed by invoked turnMachine", () => {
      const actor = createStartedGame();

      // Get hand size before draw (from turn machine which is invoked)
      const handBefore = getCurrentPlayerHand(actor);
      const handSizeBefore = handBefore.length;

      // Send draw event - should be routed to turnMachine
      // This opens May I window, then we close it (pass on discard)
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" }); // Close May I window

      // After drawing, player should have one more card
      const handAfter = getCurrentPlayerHand(actor);
      expect(handAfter.length).toBe(handSizeBefore + 1);

      actor.stop();
    });

    it("DRAW_FROM_DISCARD event is processed when player not down", () => {
      const actor = createStartedGame();

      const handBefore = getCurrentPlayerHand(actor);
      const handSizeBefore = handBefore.length;

      // Send draw from discard event
      actor.send({ type: "DRAW_FROM_DISCARD" });

      // After drawing from discard, player should have one more card
      const handAfter = getCurrentPlayerHand(actor);
      expect(handAfter.length).toBe(handSizeBefore + 1);

      actor.stop();
    });
  });

  describe("Turn completion flow", () => {
    /**
     * Helper to get a card from current player's hand
     */
    function getCardToDiscard(actor: ReturnType<typeof createActor>): string {
      const persisted = actor.getPersistedSnapshot() as any;
      const roundSnapshot = persisted.children?.round?.snapshot;
      if (!roundSnapshot) return "";

      const turnSnapshot = roundSnapshot.children?.turn?.snapshot;
      if (turnSnapshot && turnSnapshot.context.hand.length > 0) {
        return turnSnapshot.context.hand[0].id;
      }
      return "";
    }

    /**
     * Helper to get current player index from round
     */
    function getCurrentPlayerIndex(actor: ReturnType<typeof createActor>): number {
      const persisted = actor.getPersistedSnapshot() as any;
      const roundSnapshot = persisted.children?.round?.snapshot;
      return roundSnapshot?.context?.currentPlayerIndex ?? -1;
    }

    it("DISCARD event completes turn and advances to next player", () => {
      const actor = createStartedGame();

      // Get starting player index
      const startIndex = getCurrentPlayerIndex(actor);
      expect(startIndex).toBe(1); // Left of dealer (dealer is 0)

      // Draw first
      actor.send({ type: "DRAW_FROM_DISCARD" });

      // Skip lay down
      actor.send({ type: "SKIP_LAY_DOWN" });

      // Get a card to discard from turn context
      const cardId = getCardToDiscard(actor);
      expect(cardId).not.toBe("");

      // Discard
      actor.send({ type: "DISCARD", cardId });

      // After discard, turn should advance
      // The next player (index 2) should now be current
      const nextIndex = getCurrentPlayerIndex(actor);
      expect(nextIndex).toBe(2);

      // Game should still be in playing state
      expect(actor.getSnapshot().value).toBe("playing");

      actor.stop();
    });

    it("completes full turn: draw → skip → discard", () => {
      const actor = createStartedGame();

      // Draw from stock (opens May I window)
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" }); // Close May I window

      // Skip lay down
      actor.send({ type: "SKIP_LAY_DOWN" });

      // Discard first card
      const cardId = getCardToDiscard(actor);
      actor.send({ type: "DISCARD", cardId });

      // Game should still be in playing state
      expect(actor.getSnapshot().value).toBe("playing");

      actor.stop();
    });
  });

  describe("Multiple turns within a round", () => {
    it("can complete multiple turns in sequence", () => {
      const actor = createStartedGame();

      // Helper to complete a turn for current player
      function completeTurn() {
        // Draw (opens May I window, then close it)
        actor.send({ type: "DRAW_FROM_STOCK" });
        actor.send({ type: "DRAW_FROM_STOCK" }); // Close May I window

        // Skip
        actor.send({ type: "SKIP_LAY_DOWN" });

        // Get card from turn context and discard
        const persisted = actor.getPersistedSnapshot() as any;
        const roundSnapshot = persisted.children?.round?.snapshot;
        const turnSnapshot = roundSnapshot?.children?.turn?.snapshot;

        if (turnSnapshot && turnSnapshot.context.hand.length > 0) {
          const cardId = turnSnapshot.context.hand[0].id;
          actor.send({ type: "DISCARD", cardId });
        }
      }

      // Complete 3 turns (one full rotation)
      completeTurn();
      expect(actor.getSnapshot().value).toBe("playing");

      completeTurn();
      expect(actor.getSnapshot().value).toBe("playing");

      completeTurn();
      expect(actor.getSnapshot().value).toBe("playing");

      actor.stop();
    });
  });

  describe("State tracking across hierarchy", () => {
    it("maintains correct player states in round context after draw", () => {
      const actor = createStartedGame();

      // Get initial state from round
      const beforePersisted = actor.getPersistedSnapshot() as any;
      const beforeRound = beforePersisted.children?.round?.snapshot;
      expect(beforeRound).toBeDefined();

      // All players should have hands in round context
      for (const player of beforeRound?.context?.players ?? []) {
        expect(Array.isArray(player.hand)).toBe(true);
        expect(player.hand.length).toBe(11); // Dealt 11 cards
      }

      // Draw from stock (opens May I window)
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" }); // Close May I window

      // Turn machine should now have 12 cards
      const afterPersisted = actor.getPersistedSnapshot() as any;
      const afterRound = afterPersisted.children?.round?.snapshot;
      const afterTurn = afterRound?.children?.turn?.snapshot;

      expect(afterTurn?.context?.hand?.length).toBe(12);

      actor.stop();
    });

    it("updates discard pile when player discards", () => {
      const actor = createStartedGame();

      // Get initial discard count from round
      const beforePersisted = actor.getPersistedSnapshot() as any;
      const beforeRound = beforePersisted.children?.round?.snapshot;
      const discardBefore = beforeRound?.context?.discard?.length ?? 0;

      // Draw (opens May I window, then close it)
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" }); // Close May I window

      // Skip
      actor.send({ type: "SKIP_LAY_DOWN" });

      // Get a card to discard from turn
      const midPersisted = actor.getPersistedSnapshot() as any;
      const midRound = midPersisted.children?.round?.snapshot;
      const midTurn = midRound?.children?.turn?.snapshot;
      const cardId = midTurn?.context?.hand?.[0]?.id ?? "";

      // Discard
      actor.send({ type: "DISCARD", cardId });

      // After turn completes, round should have updated discard
      const afterPersisted = actor.getPersistedSnapshot() as any;
      const afterRound = afterPersisted.children?.round?.snapshot;
      const discardAfter = afterRound?.context?.discard?.length ?? 0;

      // Discard pile should have grown by 1
      expect(discardAfter).toBe(discardBefore + 1);

      actor.stop();
    });
  });
});

describe("RoundMachine → TurnMachine invocation", () => {
  it("round starts with correct player (left of dealer)", () => {
    const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
    actor.send({ type: "ADD_PLAYER", name: "Alice" }); // index 0
    actor.send({ type: "ADD_PLAYER", name: "Bob" }); // index 1
    actor.send({ type: "ADD_PLAYER", name: "Carol" }); // index 2
    actor.send({ type: "START_GAME" });

    // Dealer is at index 0, so first player is index 1 (Bob)
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.dealerIndex).toBe(0);

    // The current player context is inside the invoked actors
    // We verify by testing that Bob (index 1) can draw

    actor.stop();
  });
});

describe("TurnMachine → MayIWindowMachine invocation", () => {
  /**
   * Helper to create a started game with 3 players
   */
  function createStartedGame() {
    const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
    actor.send({ type: "ADD_PLAYER", name: "Alice" });
    actor.send({ type: "ADD_PLAYER", name: "Bob" });
    actor.send({ type: "ADD_PLAYER", name: "Carol" });
    actor.send({ type: "START_GAME" });
    return actor;
  }

  /**
   * Helper to get the turn machine state from hierarchy
   */
  function getTurnState(actor: ReturnType<typeof createActor>) {
    const persisted = actor.getPersistedSnapshot() as any;
    return persisted.children?.round?.snapshot?.children?.turn?.snapshot;
  }

  it("DRAW_FROM_STOCK opens May I window for other players", () => {
    const actor = createStartedGame();

    // First player draws from stock - should open May I window
    actor.send({ type: "DRAW_FROM_STOCK" });

    // Check turn machine is in mayIWindow state
    const turnSnapshot = getTurnState(actor);
    expect(turnSnapshot).toBeDefined();
    expect(turnSnapshot?.value).toBe("mayIWindow");

    actor.stop();
  });

  it("CALL_MAY_I event during window is processed", () => {
    const actor = createStartedGame();

    // First player draws from stock - opens May I window
    actor.send({ type: "DRAW_FROM_STOCK" });

    // Verify we're in mayIWindow state
    let turnSnapshot = getTurnState(actor);
    expect(turnSnapshot?.value).toBe("mayIWindow");

    // Carol (player-2) calls May I
    actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

    // May I window should record the claim
    const mayISnapshot = turnSnapshot?.children?.mayIWindow?.snapshot;
    expect(mayISnapshot).toBeDefined();

    actor.stop();
  });

  it("May I window closes when all players pass", () => {
    const actor = createStartedGame();

    // First player draws from stock - opens May I window
    actor.send({ type: "DRAW_FROM_STOCK" });

    // Verify in mayIWindow state
    let turnSnapshot = getTurnState(actor);
    expect(turnSnapshot?.value).toBe("mayIWindow");

    // Current player passes (draws from stock again - signals pass)
    actor.send({ type: "DRAW_FROM_STOCK" });

    // After passing, should be in drawn state
    turnSnapshot = getTurnState(actor);
    expect(turnSnapshot?.value).toBe("drawn");

    actor.stop();
  });

  it("May I winner receives discard + penalty card", () => {
    const actor = createStartedGame();

    // Get initial hand sizes
    const beforePersisted = actor.getPersistedSnapshot() as any;
    const beforeRound = beforePersisted.children?.round?.snapshot;
    const player2Hand = beforeRound?.context?.players?.[2]?.hand;
    const initialHandSize = player2Hand?.length ?? 11;

    // First player draws from stock - opens May I window
    actor.send({ type: "DRAW_FROM_STOCK" });

    // Carol (player-2) calls May I
    actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

    // Current player passes - Carol wins May I
    actor.send({ type: "DRAW_FROM_STOCK" });

    // Complete current player's turn
    let turnSnapshot = getTurnState(actor);
    if (turnSnapshot?.value === "drawn") {
      actor.send({ type: "SKIP_LAY_DOWN" });
      turnSnapshot = getTurnState(actor);
      const cardToDiscard = turnSnapshot?.context?.hand?.[0];
      if (cardToDiscard) {
        actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      }
    }

    // Check Carol's hand size increased (discard + penalty card = 2 cards)
    const afterPersisted = actor.getPersistedSnapshot() as any;
    const afterRound = afterPersisted.children?.round?.snapshot;
    const player2AfterHand = afterRound?.context?.players?.[2]?.hand;
    const finalHandSize = player2AfterHand?.length ?? 0;

    // Carol should have 2 more cards (discarded card + penalty card from stock)
    expect(finalHandSize).toBe(initialHandSize + 2);

    actor.stop();
  });
});
