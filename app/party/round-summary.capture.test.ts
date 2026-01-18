import { describe, it, expect } from "bun:test";
import { captureRoundSummary } from "./round-summary.capture";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { PlayerMapping } from "./party-game-adapter";
import type { Card, Rank, Suit } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";

// Rank mapping for test convenience
const rankMap: Record<number, Rank> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A",
};

// Helper to create a mock card
function mockCard(id: string, rankNum: number, suit: Suit): Card {
  return {
    id,
    rank: rankMap[rankNum] ?? "A",
    suit,
  };
}

// Helper to create a mock meld
function mockMeld(id: string, ownerId: string, cards: Card[], type: "set" | "run"): Meld {
  return {
    id,
    type,
    cards,
    ownerId,
  };
}

// Helper to create a minimal valid GameSnapshot for testing
function createTestSnapshot(overrides: Partial<GameSnapshot>): GameSnapshot {
  return {
    version: "3.0",
    gameId: "test-game",
    lastError: null,
    phase: "ROUND_ACTIVE",
    turnPhase: "AWAITING_DRAW",
    turnNumber: 1,
    lastDiscardedByPlayerId: null,
    discardClaimed: false,
    currentRound: 1,
    contract: { roundNumber: 1, sets: 2, runs: 0 },
    players: [],
    dealerIndex: 0,
    currentPlayerIndex: 0,
    awaitingPlayerId: "player-0",
    stock: [],
    discard: [],
    table: [],
    hasDrawn: false,
    laidDownThisTurn: false,
    tookActionThisTurn: false,
    mayIContext: null,
    roundHistory: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("captureRoundSummary", () => {
  it("captures basic round summary with winner, melds, hands, and scores", () => {
    // Setup: 3-player game where player-1 went out
    const snapshot = createTestSnapshot({
      currentRound: 1,
      turnNumber: 5,
      table: [
        mockMeld("meld-1", "player-0", [mockCard("c1", 7, "hearts"), mockCard("c2", 7, "spades"), mockCard("c3", 7, "diamonds")], "set"),
        mockMeld("meld-2", "player-1", [mockCard("c4", 3, "clubs"), mockCard("c5", 4, "clubs"), mockCard("c6", 5, "clubs")], "run"),
      ],
      players: [
        {
          id: "player-0",
          name: "Alice",
          hand: [mockCard("h1", 10, "hearts"), mockCard("h2", 5, "spades")],
          isDown: true,
          totalScore: 25,
        },
        {
          id: "player-1",
          name: "Bob",
          hand: [], // Winner - went out
          isDown: true,
          totalScore: 10,
        },
        {
          id: "player-2",
          name: "Charlie",
          hand: [mockCard("h3", 2, "diamonds"), mockCard("h4", 8, "clubs"), mockCard("h5", 9, "hearts")],
          isDown: false,
          totalScore: 50,
        },
      ],
      currentPlayerIndex: 1,
    });

    const playerMappings: PlayerMapping[] = [
      { lobbyId: "lobby-alice", engineId: "player-0", name: "Alice", avatarId: "avatar-a", isAI: false },
      { lobbyId: "lobby-bob", engineId: "player-1", name: "Bob", avatarId: "avatar-b", isAI: true, aiModelId: "grok" },
      { lobbyId: "lobby-charlie", engineId: "player-2", name: "Charlie", isAI: false },
    ];

    const result = captureRoundSummary(snapshot, playerMappings);

    // Verify winner is the player who went out (empty hand)
    expect(result.winnerId).toBe("lobby-bob");

    // Verify table melds are captured
    expect(result.tableMelds).toHaveLength(2);
    expect(result.tableMelds[0]?.id).toBe("meld-1");
    expect(result.tableMelds[1]?.id).toBe("meld-2");

    // Verify player hands are mapped to lobby IDs
    expect(result.playerHands["lobby-alice"]).toHaveLength(2);
    expect(result.playerHands["lobby-bob"]).toHaveLength(0);
    expect(result.playerHands["lobby-charlie"]).toHaveLength(3);

    // Verify scores are mapped to lobby IDs
    expect(result.scores["lobby-alice"]).toBe(25);
    expect(result.scores["lobby-bob"]).toBe(10);
    expect(result.scores["lobby-charlie"]).toBe(50);

    // Verify player names are mapped
    expect(result.playerNames["lobby-alice"]).toBe("Alice");
    expect(result.playerNames["lobby-bob"]).toBe("Bob");
    expect(result.playerNames["lobby-charlie"]).toBe("Charlie");

    // Verify avatars are mapped (including undefined)
    expect(result.playerAvatars["lobby-alice"]).toBe("avatar-a");
    expect(result.playerAvatars["lobby-bob"]).toBe("avatar-b");
    expect(result.playerAvatars["lobby-charlie"]).toBeUndefined();
  });

  it("handles winner going out with 0 cards - winner is detected correctly", () => {
    const snapshot = createTestSnapshot({
      currentRound: 2,
      turnNumber: 8,
      contract: { roundNumber: 2, sets: 1, runs: 1 },
      players: [
        { id: "player-0", name: "P1", hand: [], isDown: true, totalScore: 0 },
        { id: "player-1", name: "P2", hand: [mockCard("x1", 5, "hearts")], isDown: true, totalScore: 20 },
      ],
      currentPlayerIndex: 0,
    });

    const playerMappings: PlayerMapping[] = [
      { lobbyId: "winner", engineId: "player-0", name: "P1", isAI: false },
      { lobbyId: "loser", engineId: "player-1", name: "P2", isAI: false },
    ];

    const result = captureRoundSummary(snapshot, playerMappings);

    expect(result.winnerId).toBe("winner");
    expect(result.playerHands["winner"]).toHaveLength(0);
    expect(result.playerHands["loser"]).toHaveLength(1);
  });

  it("captures multiple melds per player correctly", () => {
    const snapshot = createTestSnapshot({
      currentRound: 3,
      turnNumber: 10,
      contract: { roundNumber: 3, sets: 0, runs: 2 },
      table: [
        mockMeld("m1", "player-0", [mockCard("a1", 4, "hearts"), mockCard("a2", 4, "spades"), mockCard("a3", 4, "diamonds")], "set"),
        mockMeld("m2", "player-0", [mockCard("b1", 6, "clubs"), mockCard("b2", 7, "clubs"), mockCard("b3", 8, "clubs")], "run"),
        mockMeld("m3", "player-1", [mockCard("c1", 10, "hearts"), mockCard("c2", 10, "spades"), mockCard("c3", 10, "diamonds")], "set"),
      ],
      players: [
        { id: "player-0", name: "Multi", hand: [], isDown: true, totalScore: 15 },
        { id: "player-1", name: "Single", hand: [mockCard("d1", 2, "hearts")], isDown: true, totalScore: 30 },
      ],
      currentPlayerIndex: 0,
    });

    const playerMappings: PlayerMapping[] = [
      { lobbyId: "player-multi", engineId: "player-0", name: "Multi", isAI: false },
      { lobbyId: "player-single", engineId: "player-1", name: "Single", isAI: false },
    ];

    const result = captureRoundSummary(snapshot, playerMappings);

    // All melds should be captured
    expect(result.tableMelds).toHaveLength(3);
    // First two melds belong to player-0
    expect(result.tableMelds.filter(m => m.ownerId === "player-0")).toHaveLength(2);
    // Third meld belongs to player-1
    expect(result.tableMelds.filter(m => m.ownerId === "player-1")).toHaveLength(1);
  });

  it("handles player with 15+ remaining cards", () => {
    const suits = ["hearts", "spades", "diamonds", "clubs"] as const;
    const manyCards = Array.from({ length: 17 }, (_, i) =>
      mockCard(`card-${i}`, (i % 10) + 3, suits[i % 4] as Suit)
    );

    const snapshot = createTestSnapshot({
      currentRound: 1,
      turnNumber: 3,
      players: [
        { id: "player-0", name: "Winner", hand: [], isDown: true, totalScore: 0 },
        { id: "player-1", name: "ManyCards", hand: manyCards, isDown: false, totalScore: 100 },
      ],
      currentPlayerIndex: 0,
    });

    const playerMappings: PlayerMapping[] = [
      { lobbyId: "winner", engineId: "player-0", name: "Winner", isAI: false },
      { lobbyId: "loser", engineId: "player-1", name: "ManyCards", isAI: false },
    ];

    const result = captureRoundSummary(snapshot, playerMappings);

    expect(result.playerHands["loser"]).toHaveLength(17);
  });
});
