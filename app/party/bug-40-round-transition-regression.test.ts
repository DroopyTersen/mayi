/**
 * Regression repro for Bug #40:
 * AI ends a round, ROUND_ENDED is broadcast, but the persisted state snaps back
 * to the previous round so the game can never advance.
 */

import { describe, it, expect } from "bun:test";
import { AITurnCoordinator, type AITurnCoordinatorDeps } from "./ai-turn-coordinator";
import { executeFallbackTurn } from "./ai-turn-handler";
import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import { PartyGameAdapter, type StoredGameState } from "./party-game-adapter";

describe("Bug #40 - round transition after AI goes out", () => {
  it("persists round 2 when AI discard ends round 1", async () => {
    // Arrange: force an AI to be the current player in AWAITING_DISCARD with 1 card.
    // Discarding that card goes out and immediately transitions the engine to round 2.
    const initialStored = convertAgentTestStateToStoredState(
      {
        players: [
          {
            id: "human",
            name: "Human",
            isAI: false,
            isDown: true,
            hand: [
              { id: "h1", rank: "2", suit: "hearts" },
              { id: "h2", rank: "3", suit: "clubs" },
            ],
          },
          {
            id: "ai1",
            name: "AI-1",
            isAI: true,
            aiModelId: "default:fallback",
            isDown: true,
            hand: [{ id: "c1", rank: "A", suit: "spades" }],
          },
          {
            id: "ai2",
            name: "AI-2",
            isAI: true,
            aiModelId: "default:fallback",
            isDown: false,
            hand: [{ id: "a2-1", rank: "K", suit: "diamonds" }],
          },
        ],
        roundNumber: 1,
        stock: [{ id: "s1", rank: "4", suit: "spades" }],
        discard: [{ id: "d1", rank: "5", suit: "clubs" }],
        table: [],
        turn: {
          currentPlayerIndex: 1, // ai1
          hasDrawn: true,
          phase: "awaitingDiscard",
        },
      },
      "room-bug-40"
    );

    let storedState: StoredGameState | null = initialStored;

    // Only let the coordinator attempt a single AI turn so the test doesn't loop.
    let aiTurnChecks = 0;

    const deps: AITurnCoordinatorDeps = {
      getState: async () => storedState,
      setState: async (state) => {
        storedState = state;
      },
      broadcast: async () => {},
      executeAITurn: async ({ adapter, aiPlayerId, abortSignal, onPersist }) => {
        return await executeFallbackTurn(adapter, aiPlayerId, {
          abortSignal,
          onPersist,
          phaseDelayMs: 0,
        });
      },
      isAIPlayerTurn: (adapter) => {
        if (aiTurnChecks++ > 0) return null;
        const awaitingLobbyId = adapter.getAwaitingLobbyPlayerId();
        if (!awaitingLobbyId) return null;
        const mapping = adapter.getPlayerMapping(awaitingLobbyId);
        return mapping?.isAI ? mapping : null;
      },
      createAdapter: PartyGameAdapter.fromStoredState,
      env: {} as AITurnCoordinatorDeps["env"],
      thinkingDelayMs: 0,
      interTurnDelayMs: 0,
      toolDelayMs: 0,
      debug: false,
    };

    const coordinator = new AITurnCoordinator(deps);

    // Act
    await coordinator.executeAITurnsIfNeeded();

    // Assert: the round transition should be persisted.
    // Regression: previously the AI persist merge could revert to round 1 when fresh/AI rounds differed.
    expect(storedState).not.toBeNull();
    const finalSnapshot = PartyGameAdapter.fromStoredState(storedState!).getSnapshot();
    expect(finalSnapshot.currentRound).toBe(2);
  });
});
