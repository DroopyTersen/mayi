import { describe, it, expect } from "bun:test";
import {
  parseAgentTestState,
  decodeAndParseAgentTestState,
  encodeAgentTestState,
} from "./agent-state.validation";
import type { AgentTestState } from "./agent-state.types";

describe("agent-state.validation", () => {
  // Helper to create a minimal valid state
  const createValidState = (): AgentTestState => ({
    players: [
      {
        id: "player-0",
        name: "Agent",
        isAI: false,
        hand: [
          { id: "card-1", suit: "hearts", rank: "K" },
          { id: "card-2", suit: "diamonds", rank: "Q" },
        ],
        isDown: false,
      },
      {
        id: "player-1",
        name: "Grok-1",
        isAI: true,
        aiModelId: "default:grok",
        hand: [
          { id: "card-3", suit: "clubs", rank: "10" },
          { id: "card-4", suit: "spades", rank: "9" },
        ],
        isDown: false,
      },
      {
        id: "player-2",
        name: "Grok-2",
        isAI: true,
        aiModelId: "default:grok",
        hand: [
          { id: "card-5", suit: "hearts", rank: "8" },
          { id: "card-6", suit: "diamonds", rank: "7" },
        ],
        isDown: false,
      },
    ],
    roundNumber: 1,
    stock: [
      { id: "card-7", suit: "clubs", rank: "6" },
      { id: "card-8", suit: "spades", rank: "5" },
    ],
    discard: [{ id: "card-9", suit: "hearts", rank: "4" }],
    table: [],
    turn: {
      currentPlayerIndex: 0,
      hasDrawn: false,
      phase: "awaitingDraw",
    },
  });

  describe("parseAgentTestState", () => {
    it("accepts a valid minimal state", () => {
      const state = createValidState();
      const result = parseAgentTestState(state);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.players.length).toBe(3);
        expect(result.data.roundNumber).toBe(1);
      }
    });

    it("accepts a valid state with melds on table", () => {
      const state = createValidState();
      state.table = [
        {
          id: "meld-1",
          type: "set",
          cards: [
            { id: "card-m1", suit: "hearts", rank: "A" },
            { id: "card-m2", suit: "diamonds", rank: "A" },
            { id: "card-m3", suit: "clubs", rank: "A" },
          ],
          ownerId: "player-0",
        },
      ];
      state.players[0]!.isDown = true;

      const result = parseAgentTestState(state);
      expect(result.success).toBe(true);
    });

    it("accepts a state with Joker cards", () => {
      const state = createValidState();
      state.players[0]!.hand.push({
        id: "card-joker",
        suit: null,
        rank: "Joker",
      });

      const result = parseAgentTestState(state);
      expect(result.success).toBe(true);
    });

    it("rejects state with too few players", () => {
      const state = createValidState();
      state.players = state.players.slice(0, 2);

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("players");
      }
    });

    it("rejects state with too many players", () => {
      const state = createValidState();
      for (let i = 3; i < 10; i++) {
        state.players.push({
          id: `player-${i}`,
          name: `Player-${i}`,
          isAI: true,
          aiModelId: "default:grok",
          hand: [{ id: `card-p${i}`, suit: "hearts", rank: "2" }],
          isDown: false,
        });
      }

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("players");
      }
    });

    it("rejects state with duplicate card IDs", () => {
      const state = createValidState();
      // Add a duplicate ID
      state.stock.push({ id: "card-1", suit: "spades", rank: "3" });

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Duplicate card IDs");
      }
    });

    it("rejects state with invalid round number", () => {
      const state = createValidState();
      (state as { roundNumber: number }).roundNumber = 7;

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
    });

    it("rejects state with zero human players", () => {
      const state = createValidState();
      state.players[0]!.isAI = true;
      state.players[0]!.aiModelId = "default:grok";

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Exactly one human player");
      }
    });

    it("rejects state with multiple human players", () => {
      const state = createValidState();
      state.players[2]!.isAI = false;
      state.players[2]!.aiModelId = undefined;

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Exactly one human player");
      }
    });

    it("rejects state with out-of-bounds currentPlayerIndex", () => {
      const state = createValidState();
      state.turn.currentPlayerIndex = 5;

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("currentPlayerIndex");
      }
    });

    it("rejects state with invalid meld owner", () => {
      const state = createValidState();
      state.table = [
        {
          id: "meld-1",
          type: "set",
          cards: [
            { id: "card-m1", suit: "hearts", rank: "A" },
            { id: "card-m2", suit: "diamonds", rank: "A" },
            { id: "card-m3", suit: "clubs", rank: "A" },
          ],
          ownerId: "player-999", // Invalid owner
        },
      ];

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not a valid player ID");
      }
    });

    it("rejects Joker card with non-null suit", () => {
      const state = createValidState();
      state.players[0]!.hand.push({
        id: "card-bad-joker",
        suit: "hearts",
        rank: "Joker",
      });

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Joker card");
        expect(result.error).toContain("must have null suit");
      }
    });

    it("rejects non-Joker card with null suit", () => {
      const state = createValidState();
      state.players[0]!.hand.push({
        id: "card-bad-suit",
        suit: null,
        rank: "K",
      });

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("must have a suit");
      }
    });

    it("rejects AI player without aiModelId", () => {
      const state = createValidState();
      state.players[1]!.aiModelId = undefined;

      const result = parseAgentTestState(state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("must have aiModelId");
      }
    });

    it("accepts all valid turn phases", () => {
      const phases = ["awaitingDraw", "awaitingAction", "awaitingDiscard"] as const;

      for (const phase of phases) {
        const state = createValidState();
        state.turn.phase = phase;
        state.turn.hasDrawn = phase !== "awaitingDraw";

        const result = parseAgentTestState(state);
        expect(result.success).toBe(true);
      }
    });

    it("accepts all valid AI model IDs", () => {
      const modelIds = [
        "default:grok",
        "default:claude",
        "default:openai",
        "default:gemini",
      ] as const;

      for (const modelId of modelIds) {
        const state = createValidState();
        state.players[1]!.aiModelId = modelId;

        const result = parseAgentTestState(state);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("encodeAgentTestState", () => {
    it("encodes state to base64url string", () => {
      const state = createValidState();
      const encoded = encodeAgentTestState(state);

      // Should be a base64url string (no +, /, or =)
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded.endsWith("=")).toBe(false);
    });

    it("produces decodable output", () => {
      const state = createValidState();
      const encoded = encodeAgentTestState(state);
      const result = decodeAndParseAgentTestState(encoded);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.players.length).toBe(3);
        expect(result.data.roundNumber).toBe(1);
      }
    });

    it("round-trips Unicode player names", () => {
      const state = createValidState();
      state.players[0]!.name = "Agént 漢字";
      const encoded = encodeAgentTestState(state);
      const result = decodeAndParseAgentTestState(encoded);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.players[0]!.name).toBe("Agént 漢字");
      }
    });
  });

  describe("decodeAndParseAgentTestState", () => {
    it("decodes and parses valid base64url state", () => {
      const state = createValidState();
      const encoded = encodeAgentTestState(state);
      const result = decodeAndParseAgentTestState(encoded);

      expect(result.success).toBe(true);
    });

    it("returns error for invalid base64", () => {
      const result = decodeAndParseAgentTestState("not-valid-base64!");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to decode");
      }
    });

    it("returns error for valid base64 but invalid JSON", () => {
      const notJson = btoa("this is not json")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const result = decodeAndParseAgentTestState(notJson);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to decode");
      }
    });

    it("returns error for valid JSON but invalid state", () => {
      const invalidState = { foo: "bar" };
      const encoded = btoa(JSON.stringify(invalidState))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const result = decodeAndParseAgentTestState(encoded);

      expect(result.success).toBe(false);
    });
  });

  describe("round-trip encoding", () => {
    it("preserves all state fields through encode/decode", () => {
      const state = createValidState();
      state.roundNumber = 3;
      state.players[0]!.isDown = true;
      state.players[0]!.totalScore = 42;
      state.turn.hasDrawn = true;
      state.turn.phase = "awaitingAction";
      state.table = [
        {
          id: "meld-1",
          type: "run",
          cards: [
            { id: "card-m1", suit: "spades", rank: "5" },
            { id: "card-m2", suit: "spades", rank: "6" },
            { id: "card-m3", suit: "spades", rank: "7" },
          ],
          ownerId: "player-0",
        },
      ];

      const encoded = encodeAgentTestState(state);
      const result = decodeAndParseAgentTestState(encoded);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.roundNumber).toBe(3);
        expect(result.data.players[0]!.isDown).toBe(true);
        expect(result.data.players[0]!.totalScore).toBe(42);
        expect(result.data.turn.hasDrawn).toBe(true);
        expect(result.data.turn.phase).toBe("awaitingAction");
        expect(result.data.table.length).toBe(1);
        expect(result.data.table[0]!.type).toBe("run");
      }
    });
  });
});
