/**
 * Zod Validation for Agent Test State Injection
 *
 * Validates the simplified AgentTestState format and ensures:
 * - All card IDs are unique
 * - Card suits and ranks are valid
 * - Player count is within bounds (3-8)
 * - Round number is valid (1-6)
 * - Meld owner IDs reference existing players
 */

import { z } from "zod";
import type { AgentTestState } from "./agent-state.types";
import { AI_MODEL_IDS } from "./ai-models";
import { decodeBase64UrlToUtf8, encodeUtf8ToBase64Url } from "../../core/utils/base64url";

// ═══════════════════════════════════════════════════════════════════════════
// Card Schema
// ═══════════════════════════════════════════════════════════════════════════

const suitSchema = z.enum(["hearts", "diamonds", "clubs", "spades"]);

const rankSchema = z.enum([
  "A",
  "K",
  "Q",
  "J",
  "10",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
  "Joker",
]);

const cardSchema = z.object({
  id: z.string().min(1),
  suit: suitSchema.nullable(), // null for Joker
  rank: rankSchema,
});

// ═══════════════════════════════════════════════════════════════════════════
// Meld Schema
// ═══════════════════════════════════════════════════════════════════════════

const meldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["set", "run"]),
  cards: z.array(cardSchema).min(3), // Melds need at least 3 cards
  ownerId: z.string().min(1),
});

// ═══════════════════════════════════════════════════════════════════════════
// Player Schema
// ═══════════════════════════════════════════════════════════════════════════

const aiModelIdSchema = z.enum(AI_MODEL_IDS);

const playerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(24),
  isAI: z.boolean(),
  aiModelId: aiModelIdSchema.optional(),
  hand: z.array(cardSchema),
  isDown: z.boolean(),
  totalScore: z.number().int().min(0).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// Turn State Schema
// ═══════════════════════════════════════════════════════════════════════════

const turnPhaseSchema = z.enum([
  "awaitingDraw",
  "awaitingAction",
  "awaitingDiscard",
]);

const turnStateSchema = z.object({
  currentPlayerIndex: z.number().int().min(0),
  hasDrawn: z.boolean(),
  drawSource: z.enum(["stock", "discard"]).optional(),
  phase: turnPhaseSchema,
});

// ═══════════════════════════════════════════════════════════════════════════
// Main Schema
// ═══════════════════════════════════════════════════════════════════════════

const roundNumberSchema = z.number().int().min(1).max(6) as z.ZodType<1 | 2 | 3 | 4 | 5 | 6>;

export const agentTestStateSchema = z
  .object({
    players: z.array(playerSchema).min(3).max(8),
    roundNumber: roundNumberSchema,
    stock: z.array(cardSchema),
    discard: z.array(cardSchema),
    table: z.array(meldSchema),
    turn: turnStateSchema,
  })
  .superRefine((data, ctx) => {
    // Require exactly one human player (the agent under test).
    // This keeps injection deterministic and avoids ambiguous connection mapping.
    const humanCount = data.players.filter((p) => !p.isAI).length;
    if (humanCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Exactly one human player (isAI: false) is required; found ${humanCount}`,
        path: ["players"],
      });
    }

    // Validate currentPlayerIndex is within bounds
    if (data.turn.currentPlayerIndex >= data.players.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `currentPlayerIndex (${data.turn.currentPlayerIndex}) is out of bounds for ${data.players.length} players`,
        path: ["turn", "currentPlayerIndex"],
      });
    }

    // Validate hasDrawn is consistent with phase.
    if (data.turn.phase === "awaitingDraw" && data.turn.hasDrawn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `hasDrawn must be false when phase is awaitingDraw`,
        path: ["turn", "hasDrawn"],
      });
    }
    if (data.turn.phase !== "awaitingDraw" && !data.turn.hasDrawn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `hasDrawn must be true when phase is ${data.turn.phase}`,
        path: ["turn", "hasDrawn"],
      });
    }
    if (!data.turn.hasDrawn && data.turn.drawSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `drawSource must be omitted when hasDrawn is false`,
        path: ["turn", "drawSource"],
      });
    }

    // Collect all card IDs to check for uniqueness
    const cardIds = new Set<string>();
    const duplicateIds: string[] = [];

    const checkCard = (card: { id: string }, location: string) => {
      if (cardIds.has(card.id)) {
        duplicateIds.push(`${card.id} (${location})`);
      }
      cardIds.add(card.id);
    };

    // Check all cards in all locations
    data.players.forEach((player, i) => {
      player.hand.forEach((card, j) => {
        checkCard(card, `players[${i}].hand[${j}]`);
      });
    });

    data.stock.forEach((card, i) => {
      checkCard(card, `stock[${i}]`);
    });

    data.discard.forEach((card, i) => {
      checkCard(card, `discard[${i}]`);
    });

    data.table.forEach((meld, i) => {
      meld.cards.forEach((card, j) => {
        checkCard(card, `table[${i}].cards[${j}]`);
      });
    });

    if (duplicateIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate card IDs found: ${duplicateIds.join(", ")}`,
        path: [],
      });
    }

    // Validate meld owner IDs reference existing players
    const playerIds = new Set(data.players.map((p) => p.id));
    data.table.forEach((meld, i) => {
      if (!playerIds.has(meld.ownerId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Meld owner "${meld.ownerId}" is not a valid player ID`,
          path: ["table", i, "ownerId"],
        });
      }
    });

    // Validate Joker cards have null suit
    const validateJokerSuit = (card: { id: string; suit: string | null; rank: string }, location: string) => {
      if (card.rank === "Joker" && card.suit !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Joker card at ${location} must have null suit`,
          path: [],
        });
      }
      if (card.rank !== "Joker" && card.suit === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Non-Joker card at ${location} must have a suit`,
          path: [],
        });
      }
    };

    data.players.forEach((player, i) => {
      player.hand.forEach((card, j) => {
        validateJokerSuit(card, `players[${i}].hand[${j}]`);
      });
    });

    data.stock.forEach((card, i) => {
      validateJokerSuit(card, `stock[${i}]`);
    });

    data.discard.forEach((card, i) => {
      validateJokerSuit(card, `discard[${i}]`);
    });

    data.table.forEach((meld, i) => {
      meld.cards.forEach((card, j) => {
        validateJokerSuit(card, `table[${i}].cards[${j}]`);
      });
    });

    // Validate AI players have aiModelId
    data.players.forEach((player, i) => {
      if (player.isAI && !player.aiModelId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `AI player "${player.name}" must have aiModelId`,
          path: ["players", i, "aiModelId"],
        });
      }
    });
  });

// ═══════════════════════════════════════════════════════════════════════════
// Validation Functions
// ═══════════════════════════════════════════════════════════════════════════

export type AgentTestStateParseResult =
  | { success: true; data: AgentTestState }
  | { success: false; error: string };

/**
 * Parse and validate an AgentTestState from unknown input
 */
export function parseAgentTestState(input: unknown): AgentTestStateParseResult {
  const result = agentTestStateSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as AgentTestState };
  }
  const errors = result.error.issues.map((e) => {
    const path = e.path.join(".");
    return path ? `${path}: ${e.message}` : e.message;
  });
  return { success: false, error: errors.join("; ") };
}

/**
 * Decode a base64url-encoded state string and parse it
 */
export function decodeAndParseAgentTestState(
  encoded: string
): AgentTestStateParseResult {
  try {
    const json = decodeBase64UrlToUtf8(encoded);
    const parsed = JSON.parse(json);
    return parseAgentTestState(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: `Failed to decode state: ${message}` };
  }
}

/**
 * Encode an AgentTestState as a base64url string
 */
export function encodeAgentTestState(state: AgentTestState): string {
  return encodeUtf8ToBase64Url(JSON.stringify(state));
}
