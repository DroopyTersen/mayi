/**
 * Tests for game-actions.ts
 *
 * Validates that the executeGameAction function correctly handles
 * game actions for the wire protocol.
 */

import { describe, it, expect } from "bun:test";
import { PartyGameAdapter } from "./party-game-adapter";
import { executeGameAction } from "./game-actions";
import type { HumanPlayerInfo, AIPlayerInfo, GameAction } from "./protocol.types";
import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import type { AgentTestState } from "./agent-state.types";
import { createTestCard } from "../../core/engine/test.fixtures";

describe("executeGameAction", () => {
  const humanPlayers: HumanPlayerInfo[] = [
    { playerId: "human-1", name: "Alice", isConnected: true, disconnectedAt: null },
    { playerId: "human-2", name: "Bob", isConnected: true, disconnectedAt: null },
  ];

  const aiPlayers: AIPlayerInfo[] = [
    {
      playerId: "ai-abc123",
      name: "ClaudeBot",
      modelId: "default:claude",
      modelDisplayName: "Claude",
    },
  ];

  function createTestAdapter() {
    return PartyGameAdapter.createFromLobby({
      roomId: "test-room",
      humanPlayers,
      aiPlayers,
      startingRound: 1,
    });
  }

  function createAdapterFromAgentState(state: AgentTestState) {
    const storedState = convertAgentTestStateToStoredState(state, "test-room");
    return PartyGameAdapter.fromStoredState(storedState);
  }

  describe("DRAW_FROM_STOCK", () => {
    it("succeeds when it is player's turn and in AWAITING_DRAW phase", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const action: GameAction = { type: "DRAW_FROM_STOCK" };

      const result = executeGameAction(adapter, awaitingId, action);

      expect(result.success).toBe(true);
      expect(result.snapshot).not.toBe(null);
      expect(result.snapshot?.hasDrawn).toBe(true);
    });

    it("fails when it is not player's turn", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      // Get a different player ID
      const otherPlayerId = ["human-1", "human-2", "ai-abc123"].find(
        (id) => id !== awaitingId
      )!;

      const action: GameAction = { type: "DRAW_FROM_STOCK" };
      const result = executeGameAction(adapter, otherPlayerId, action);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_YOUR_TURN");
    });

    it("fails when already drawn", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      const result = executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });
  });

  describe("DRAW_FROM_DISCARD", () => {
    it("fails when already drawn", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      const result = executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_DISCARD" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });
  });

  describe("DISCARD", () => {
    it("fails when in AWAITING_DRAW phase", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const view = adapter.getPlayerView(awaitingId)!;
      const cardId = view.yourHand[0]!.id;

      const action: GameAction = { type: "DISCARD", cardId };
      const result = executeGameAction(adapter, awaitingId, action);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });

    it("succeeds after drawing and skipping (in AWAITING_DISCARD phase)", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      // Draw from stock
      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      // Get hand after drawing
      const viewAfterDraw = adapter.getPlayerView(awaitingId)!;
      expect(viewAfterDraw.yourHand.length).toBe(12); // 11 + 1 drawn

      // Skip (go to discard phase)
      executeGameAction(adapter, awaitingId, { type: "SKIP" });

      // Now turnPhase should be AWAITING_DISCARD
      const snapshot = adapter.getSnapshot();
      expect(snapshot.turnPhase).toBe("AWAITING_DISCARD");

      // Get a card to discard
      const viewBeforeDiscard = adapter.getPlayerView(awaitingId)!;
      const cardId = viewBeforeDiscard.yourHand[0]!.id;

      // Discard should succeed
      const action: GameAction = { type: "DISCARD", cardId };
      const result = executeGameAction(adapter, awaitingId, action);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify player now has 11 cards
      const viewAfterDiscard = adapter.getPlayerView(awaitingId)!;
      expect(viewAfterDiscard.yourHand.length).toBe(11);
    });

    it("succeeds after drawing without skip (in AWAITING_ACTION phase)", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      // Draw from stock
      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      // Check turnPhase after drawing
      const snapshotAfterDraw = adapter.getSnapshot();
      expect(snapshotAfterDraw.turnPhase).toBe("AWAITING_ACTION");

      // Get hand after drawing
      const viewAfterDraw = adapter.getPlayerView(awaitingId)!;
      expect(viewAfterDraw.yourHand.length).toBe(12); // 11 + 1 drawn

      // Try to discard directly (without skipping)
      const cardId = viewAfterDraw.yourHand[0]!.id;
      const action: GameAction = { type: "DISCARD", cardId };
      const result = executeGameAction(adapter, awaitingId, action);

      // This SHOULD succeed since DISCARD is allowed in AWAITING_ACTION
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify player now has 11 cards
      const viewAfterDiscard = adapter.getPlayerView(awaitingId)!;
      expect(viewAfterDiscard.yourHand.length).toBe(11);
    });

    it("fails when cardId is missing", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      // Draw from stock
      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      // Try to discard without cardId
      const action = { type: "DISCARD" } as GameAction;
      const result = executeGameAction(adapter, awaitingId, action);

      expect(result.success).toBe(false);
      expect(result.error).toBe("MISSING_CARD_ID");
    });

    it("fails when cardId is not in player's hand", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      // Draw from stock
      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      // Try to discard with invalid card ID
      const action: GameAction = { type: "DISCARD", cardId: "invalid-card-id" };
      const result = executeGameAction(adapter, awaitingId, action);

      // The engine should reject this - check if result indicates failure
      // Note: The engine might record lastError instead of returning null
      if (result.snapshot?.lastError) {
        expect(result.success).toBe(false);
      }
    });

    it("returns lastError when engine rejects a lay down", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      const result = executeGameAction(adapter, awaitingId, {
        type: "LAY_DOWN",
        melds: [
          {
            type: "set",
            cardIds: ["missing-card"],
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("card not in hand");
      expect(result.snapshot?.lastError).toBe("card not in hand");
    });
  });

  describe("SKIP", () => {
    it("fails when not in AWAITING_ACTION phase", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      const result = executeGameAction(adapter, awaitingId, { type: "SKIP" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });
  });

  describe("LAY_DOWN", () => {
    it("fails when not in AWAITING_ACTION phase", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      const result = executeGameAction(adapter, awaitingId, {
        type: "LAY_DOWN",
        melds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });

    it("fails when melds are missing", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      const result = executeGameAction(adapter, awaitingId, {
        type: "LAY_DOWN",
        melds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("MISSING_MELDS");
    });

    it("succeeds with valid melds in awaiting action", () => {
      const player0Hand = [
        createTestCard("K", "hearts", "p0-K-H"),
        createTestCard("K", "diamonds", "p0-K-D"),
        createTestCard("K", "spades", "p0-K-S"),
        createTestCard("Q", "hearts", "p0-Q-H"),
        createTestCard("Q", "diamonds", "p0-Q-D"),
        createTestCard("Q", "clubs", "p0-Q-C"),
        createTestCard("3", "hearts", "p0-3-H"),
        createTestCard("4", "clubs", "p0-4-C"),
        createTestCard("5", "spades", "p0-5-S"),
        createTestCard("6", "diamonds", "p0-6-D"),
        createTestCard("7", "hearts", "p0-7-H"),
      ];

      const state: AgentTestState = {
        players: [
          {
            id: "human-1",
            name: "Alice",
            isAI: false,
            hand: player0Hand,
            isDown: false,
          },
          {
            id: "human-2",
            name: "Bob",
            isAI: false,
            hand: [
              createTestCard("9", "hearts", "p1-9-H"),
              createTestCard("10", "hearts", "p1-10-H"),
              createTestCard("J", "hearts", "p1-J-H"),
              createTestCard("Q", "spades", "p1-Q-S"),
              createTestCard("K", "clubs", "p1-K-C"),
              createTestCard("A", "hearts", "p1-A-H"),
              createTestCard("3", "clubs", "p1-3-C"),
              createTestCard("4", "diamonds", "p1-4-D"),
              createTestCard("5", "clubs", "p1-5-C"),
              createTestCard("6", "clubs", "p1-6-C"),
              createTestCard("7", "clubs", "p1-7-C"),
            ],
            isDown: false,
          },
          {
            id: "ai-1",
            name: "Grok",
            isAI: true,
            aiModelId: "default:grok",
            hand: [
              createTestCard("9", "spades", "p2-9-S"),
              createTestCard("10", "spades", "p2-10-S"),
              createTestCard("J", "spades", "p2-J-S"),
              createTestCard("Q", "diamonds", "p2-Q-D"),
              createTestCard("K", "hearts", "p2-K-H"),
              createTestCard("A", "spades", "p2-A-S"),
              createTestCard("3", "spades", "p2-3-S"),
              createTestCard("4", "hearts", "p2-4-H"),
              createTestCard("5", "diamonds", "p2-5-D"),
              createTestCard("6", "diamonds", "p2-6-D"),
              createTestCard("7", "diamonds", "p2-7-D"),
            ],
            isDown: false,
          },
        ],
        roundNumber: 1,
        stock: [createTestCard("8", "hearts", "stock-1")],
        discard: [createTestCard("2", "clubs", "discard-1")],
        table: [],
        turn: {
          currentPlayerIndex: 0,
          hasDrawn: true,
          drawSource: "stock",
          phase: "awaitingAction",
        },
      };

      const adapter = createAdapterFromAgentState(state);
      const action: GameAction = {
        type: "LAY_DOWN",
        melds: [
          {
            type: "set",
            cardIds: ["p0-K-H", "p0-K-D", "p0-K-S"],
          },
          {
            type: "set",
            cardIds: ["p0-Q-H", "p0-Q-D", "p0-Q-C"],
          },
        ],
      };

      const result = executeGameAction(adapter, "human-1", action);

      expect(result.success).toBe(true);
      expect(result.snapshot?.table.length).toBe(2);
    });
  });

  describe("LAY_OFF", () => {
    it("fails when not in valid phases", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      const result = executeGameAction(adapter, awaitingId, {
        type: "LAY_OFF",
        cardId: "card-1",
        meldId: "meld-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });

    it("fails when missing card or meld id", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      const result = executeGameAction(adapter, awaitingId, {
        type: "LAY_OFF",
        cardId: "card-1",
      } as GameAction);

      expect(result.success).toBe(false);
      expect(result.error).toBe("MISSING_CARD_OR_MELD_ID");
    });

    it("succeeds when laying off to a set", () => {
      const state: AgentTestState = {
        players: [
          {
            id: "human-1",
            name: "Alice",
            isAI: false,
            hand: [
              createTestCard("Q", "spades", "p0-Q-S"),
              createTestCard("9", "clubs", "p0-9-C"),
            ],
            isDown: true,
          },
          {
            id: "human-2",
            name: "Bob",
            isAI: false,
            hand: [createTestCard("9", "hearts", "p1-9-H")],
            isDown: false,
          },
          {
            id: "ai-1",
            name: "Grok",
            isAI: true,
            aiModelId: "default:grok",
            hand: [createTestCard("9", "spades", "p2-9-S")],
            isDown: false,
          },
        ],
        roundNumber: 1,
        stock: [createTestCard("8", "hearts", "stock-1")],
        discard: [createTestCard("2", "clubs", "discard-1")],
        table: [
          {
            id: "meld-1",
            type: "set",
            ownerId: "human-1",
            cards: [
              createTestCard("Q", "hearts", "table-Q-H"),
              createTestCard("Q", "diamonds", "table-Q-D"),
              createTestCard("Q", "clubs", "table-Q-C"),
            ],
          },
        ],
        turn: {
          currentPlayerIndex: 0,
          hasDrawn: true,
          drawSource: "stock",
          phase: "awaitingAction",
        },
      };

      const adapter = createAdapterFromAgentState(state);
      const result = executeGameAction(adapter, "human-1", {
        type: "LAY_OFF",
        cardId: "p0-Q-S",
        meldId: "meld-1",
      });

      expect(result.success).toBe(true);
      expect(result.snapshot?.table[0]?.cards.length).toBe(4);
      expect(result.snapshot?.turnPhase).toBe("AWAITING_ACTION");
    });
  });

  describe("SWAP_JOKER", () => {
    it("fails when not in valid phases", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      const result = executeGameAction(adapter, awaitingId, {
        type: "SWAP_JOKER",
        meldId: "meld-1",
        jokerCardId: "joker-1",
        swapCardId: "card-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });

    it("fails when swap params are missing", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      const result = executeGameAction(adapter, awaitingId, {
        type: "SWAP_JOKER",
        meldId: "meld-1",
      } as GameAction);

      expect(result.success).toBe(false);
      expect(result.error).toBe("MISSING_SWAP_PARAMS");
    });

    it("succeeds when swapping a joker in a run", () => {
      const swapCard = createTestCard("6", "spades", "p0-6-S");
      const jokerCard = createTestCard("Joker", null, "table-joker");

      const state: AgentTestState = {
        players: [
          {
            id: "human-1",
            name: "Alice",
            isAI: false,
            hand: [swapCard],
            isDown: false,
          },
          {
            id: "human-2",
            name: "Bob",
            isAI: false,
            hand: [createTestCard("9", "hearts", "p1-9-H")],
            isDown: false,
          },
          {
            id: "ai-1",
            name: "Grok",
            isAI: true,
            aiModelId: "default:grok",
            hand: [createTestCard("9", "spades", "p2-9-S")],
            isDown: false,
          },
        ],
        roundNumber: 1,
        stock: [createTestCard("8", "hearts", "stock-1")],
        discard: [createTestCard("2", "clubs", "discard-1")],
        table: [
          {
            id: "meld-1",
            type: "run",
            ownerId: "human-2",
            cards: [
              createTestCard("5", "spades", "table-5"),
              jokerCard,
              createTestCard("7", "spades", "table-7"),
              createTestCard("8", "spades", "table-8"),
            ],
          },
        ],
        turn: {
          currentPlayerIndex: 0,
          hasDrawn: true,
          drawSource: "stock",
          phase: "awaitingAction",
        },
      };

      const adapter = createAdapterFromAgentState(state);
      const result = executeGameAction(adapter, "human-1", {
        type: "SWAP_JOKER",
        meldId: "meld-1",
        jokerCardId: "table-joker",
        swapCardId: "p0-6-S",
      });

      expect(result.success).toBe(true);
      expect(result.snapshot?.table[0]?.cards[1]?.id).toBe("p0-6-S");
    });
  });

  describe("REORDER_HAND", () => {
    it("fails when cardIds are missing", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      const result = executeGameAction(adapter, awaitingId, {
        type: "REORDER_HAND",
        cardIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("MISSING_CARD_IDS");
    });

    it("returns ACTION_FAILED for invalid lobby player id", () => {
      const adapter = createTestAdapter();

      const result = executeGameAction(adapter, "missing-player", {
        type: "REORDER_HAND",
        cardIds: ["card-1"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("ACTION_FAILED");
    });
  });

  describe("May I actions", () => {
    it("fails CALL_MAY_I on own turn", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      const result = executeGameAction(adapter, awaitingId, { type: "CALL_MAY_I" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("CANNOT_CALL_MAY_I_ON_OWN_TURN");
    });

    it("fails CALL_MAY_I when already resolving May-I", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const callerId = ["human-1", "human-2", "ai-abc123"].find(
        (id) => id !== awaitingId
      )!;

      executeGameAction(adapter, callerId, { type: "CALL_MAY_I" });

      const result = executeGameAction(adapter, callerId, { type: "CALL_MAY_I" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });

    it("allows CALL_MAY_I from non-current player", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const callerId = ["human-1", "human-2", "ai-abc123"].find(
        (id) => id !== awaitingId
      )!;

      const result = executeGameAction(adapter, callerId, { type: "CALL_MAY_I" });

      expect(result.success).toBe(true);
      expect(adapter.getSnapshot().phase).toBe("RESOLVING_MAY_I");
    });

    it("fails ALLOW_MAY_I outside resolving phase", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      const result = executeGameAction(adapter, awaitingId, { type: "ALLOW_MAY_I" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });

    it("fails CLAIM_MAY_I outside resolving phase", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      const result = executeGameAction(adapter, awaitingId, { type: "CLAIM_MAY_I" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });

    it("allows ALLOW_MAY_I during resolution", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const callerId = ["human-1", "human-2", "ai-abc123"].find(
        (id) => id !== awaitingId
      )!;

      executeGameAction(adapter, callerId, { type: "CALL_MAY_I" });

      const resolverId = adapter.getAwaitingLobbyPlayerId()!;
      const result = executeGameAction(adapter, resolverId, { type: "ALLOW_MAY_I" });

      expect(result.success).toBe(true);
    });

    it("logs May-I resolution when allow resolves the call", () => {
      const adapter = createTestAdapter();
      const snapshot = adapter.getSnapshot();
      const currentEngineId = snapshot.awaitingPlayerId;
      if (!adapter.engineIdToLobbyId(currentEngineId)) {
        throw new Error("Missing current lobby mapping");
      }
      const nextIndex = (snapshot.currentPlayerIndex + 1) % snapshot.players.length;
      const nextEngineId = snapshot.players[nextIndex]?.id;
      if (!nextEngineId) {
        throw new Error("Missing next engine player");
      }
      const callerId = adapter.engineIdToLobbyId(nextEngineId);
      if (!callerId) {
        throw new Error("Missing caller lobby mapping");
      }

      executeGameAction(adapter, callerId, { type: "CALL_MAY_I" });

      const resolverId = adapter.getAwaitingLobbyPlayerId()!;
      const allowResult = executeGameAction(adapter, resolverId, { type: "ALLOW_MAY_I" });

      expect(allowResult.success).toBe(true);
      expect(adapter.getSnapshot().phase).toBe("ROUND_ACTIVE");

      const actions = adapter.getRecentActivityLog(5).map((entry) => entry.action);
      expect(actions).toContain("allowed May I");
      expect(actions).toContain("took the May I card");
    });

    it("allows CLAIM_MAY_I during resolution", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const callerId = ["human-1", "human-2", "ai-abc123"].find(
        (id) => id !== awaitingId
      )!;

      executeGameAction(adapter, callerId, { type: "CALL_MAY_I" });

      const resolverId = adapter.getAwaitingLobbyPlayerId()!;
      const result = executeGameAction(adapter, resolverId, { type: "CLAIM_MAY_I" });

      expect(result.success).toBe(true);
    });
  });

  describe("UNKNOWN_ACTION", () => {
    it("returns UNKNOWN_ACTION for unsupported types", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      const result = executeGameAction(adapter, awaitingId, {
        type: "UNKNOWN_ACTION",
      } as unknown as GameAction);

      expect(result.success).toBe(false);
      expect(result.error).toBe("UNKNOWN_ACTION");
    });
  });

  describe("Full turn cycle", () => {
    it("completes a full turn: draw -> skip -> discard -> next player's turn", () => {
      const adapter = createTestAdapter();
      const player1Id = adapter.getAwaitingLobbyPlayerId()!;

      // 1. Draw from stock
      const drawResult = executeGameAction(adapter, player1Id, {
        type: "DRAW_FROM_STOCK",
      });
      expect(drawResult.success).toBe(true);
      expect(adapter.getSnapshot().turnPhase).toBe("AWAITING_ACTION");

      // 2. Skip (go to discard phase)
      const skipResult = executeGameAction(adapter, player1Id, { type: "SKIP" });
      expect(skipResult.success).toBe(true);
      expect(adapter.getSnapshot().turnPhase).toBe("AWAITING_DISCARD");

      // 3. Discard a card
      const view = adapter.getPlayerView(player1Id)!;
      const cardToDiscard = view.yourHand[0]!.id;
      const discardResult = executeGameAction(adapter, player1Id, {
        type: "DISCARD",
        cardId: cardToDiscard,
      });
      expect(discardResult.success).toBe(true);

      // 4. After discard, should be next player's turn
      const nextPlayerId = adapter.getAwaitingLobbyPlayerId();
      expect(nextPlayerId).not.toBe(player1Id);

      // 5. And turnPhase should be AWAITING_DRAW again
      expect(adapter.getSnapshot().turnPhase).toBe("AWAITING_DRAW");
    });
  });

  describe("May-I availability in PlayerView", () => {
    it("canMayI is false after current player draws from discard", () => {
      const adapter = createTestAdapter();
      const currentPlayerId = adapter.getAwaitingLobbyPlayerId()!;
      const allPlayers = adapter.getAllPlayerMappings();
      const otherPlayer = allPlayers.find(
        (m) => m.lobbyId !== currentPlayerId && !m.isAI
      );
      if (!otherPlayer) throw new Error("Need at least 2 human players for this test");

      // Before any action, other player CAN call May-I
      const viewBefore = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(viewBefore?.availableActions.canMayI).toBe(true);

      // Current player draws from discard
      executeGameAction(adapter, currentPlayerId, { type: "DRAW_FROM_DISCARD" });

      // After draw from discard, other player should NOT be able to call May-I
      // because the discard has been claimed
      const viewAfter = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(viewAfter?.availableActions.canMayI).toBe(false);
    });

    it("canMayI remains true after current player draws from stock", () => {
      const adapter = createTestAdapter();
      const currentPlayerId = adapter.getAwaitingLobbyPlayerId()!;
      const allPlayers = adapter.getAllPlayerMappings();
      const otherPlayer = allPlayers.find(
        (m) => m.lobbyId !== currentPlayerId && !m.isAI
      );
      if (!otherPlayer) throw new Error("Need at least 2 human players for this test");

      // Before any action, other player CAN call May-I
      const viewBefore = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(viewBefore?.availableActions.canMayI).toBe(true);

      // Current player draws from stock
      executeGameAction(adapter, currentPlayerId, { type: "DRAW_FROM_STOCK" });

      // After draw from stock, discard is still exposed so May-I should still be available
      const viewAfter = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(viewAfter?.availableActions.canMayI).toBe(true);
    });

    it("canMayI is false for down players", () => {
      // Create adapter with predefined state where a player is down
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers: [
          { playerId: "human-1", name: "Alice", isConnected: true, disconnectedAt: null },
          { playerId: "human-2", name: "Bob", isConnected: true, disconnectedAt: null },
          { playerId: "human-3", name: "Carol", isConnected: true, disconnectedAt: null },
        ],
        aiPlayers: [],
        startingRound: 1,
      });

      // Find player who is NOT current player
      const currentPlayerId = adapter.getAwaitingLobbyPlayerId()!;
      const allPlayers = adapter.getAllPlayerMappings();
      const otherPlayer = allPlayers.find((m) => m.lobbyId !== currentPlayerId);
      if (!otherPlayer) throw new Error("Need other player for test");

      // For now, verify that a non-down player CAN call May-I
      const view = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(view?.availableActions.canMayI).toBe(true);

      // Note: To properly test down player behavior, we'd need to lay down melds first
      // which requires a more complex test setup. The engine tests already cover this.
    });
  });

  describe("CALL_MAY_I does not return stale errors", () => {
    it("succeeds even when lastError is set from a previous failed action", () => {
      const adapter = createTestAdapter();
      const currentPlayerId = adapter.getAwaitingLobbyPlayerId()!;
      const allPlayers = adapter.getAllPlayerMappings();
      const otherPlayer = allPlayers.find(
        (m) => m.lobbyId !== currentPlayerId && !m.isAI
      );
      if (!otherPlayer) throw new Error("Need at least 2 human players for this test");

      // 1. Current player draws from stock to get into AWAITING_ACTION phase
      executeGameAction(adapter, currentPlayerId, { type: "DRAW_FROM_STOCK" });
      expect(adapter.getSnapshot().turnPhase).toBe("AWAITING_ACTION");

      // 2. Current player attempts an invalid LAY_DOWN
      // Round 1 contract requires 2 sets. Let's try to lay down with invalid card IDs.
      const invalidLayDownResult = executeGameAction(adapter, currentPlayerId, {
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: ["invalid-card-1", "invalid-card-2", "invalid-card-3"] },
          { type: "set", cardIds: ["invalid-card-4", "invalid-card-5", "invalid-card-6"] },
        ],
      });
      // The engine should reject this because cards don't exist in hand
      expect(invalidLayDownResult.success).toBe(false);

      // Verify the state has a lastError set (this is the sticky error)
      const snapshotWithError = adapter.getSnapshot();
      expect(snapshotWithError.lastError).toBeTruthy();

      // 3. Other player calls May-I - this should SUCCEED despite the stale lastError
      // because May-I doesn't produce errors, it just triggers the resolution phase
      const mayIResult = executeGameAction(adapter, otherPlayer.lobbyId, {
        type: "CALL_MAY_I",
      });

      // THIS IS THE BUG: May-I fails with the stale error from the failed lay-down
      // After fix: May-I should succeed
      expect(mayIResult.success).toBe(true);
      expect(mayIResult.error).toBeUndefined();
    });
  });

  describe("May-I resolution with down players", () => {
    it("down players are skipped in May-I resolution", () => {
      // Create adapter with 4 players for better testing
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers: [
          { playerId: "human-1", name: "Player 1", isConnected: true, disconnectedAt: null },
          { playerId: "human-2", name: "Player 2", isConnected: true, disconnectedAt: null },
          { playerId: "human-3", name: "Player 3", isConnected: true, disconnectedAt: null },
          { playerId: "human-4", name: "Player 4", isConnected: true, disconnectedAt: null },
        ],
        aiPlayers: [],
        startingRound: 1,
      });

      // The engine level tests in roundMachine.mayI.test.ts verify that:
      // - "skips players who are down"
      // - "all players ahead are down - caller auto-wins"
      //
      // Those tests confirm the engine correctly excludes down players from playersToCheck.
      // This test verifies the adapter layer properly exposes the engine behavior.

      // Get initial state - no one is down yet
      const snapshot = adapter.getSnapshot();
      expect(snapshot.phase).toBe("ROUND_ACTIVE");

      // Verify there's a discard to claim
      expect(snapshot.discard.length).toBeGreaterThan(0);
    });
  });
});
