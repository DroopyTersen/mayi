/**
 * Wire Protocol Types for Phase 3 WebSocket Communication
 *
 * This file defines all client → server and server → client message types
 * with Zod schemas for runtime validation.
 */

import { z } from "zod";
import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import type { PlayerView, MeldSpec } from "../../core/engine/game-engine.types";
import type { RoundNumber } from "../../core/engine/engine.types";
import type { Contract } from "../../core/engine/contracts";
import type { AgentTestState } from "./agent-state.types";
import { agentTestStateSchema } from "./agent-state.validation";
import { AI_MODEL_DISPLAY_NAMES, AI_MODEL_IDS, type AIModelId } from "./ai-models";
import { agentSetupMessageSchema } from "./agent-harness.types";

// Re-export types needed by clients
export type { PlayerView } from "../../core/engine/game-engine.types";

// ═══════════════════════════════════════════════════════════════════════════
// Activity Log Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Activity log entry for game actions
 *
 * Used to display a human-readable log of game events to players.
 */
export interface ActivityLogEntry {
  /** Unique ID for React keys */
  id: string;
  /** Timestamp of the action */
  timestamp: string;
  /** Round number when action occurred */
  roundNumber: RoundNumber;
  /** Turn number when action occurred */
  turnNumber: number;
  /** Player who performed the action (lobby ID) */
  playerId: string;
  /** Player name */
  playerName: string;
  /** Action type (e.g., "drew from stock", "discarded", "laid down") */
  action: string;
  /** Additional details (e.g., card that was discarded) */
  details?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Player Types
// ═══════════════════════════════════════════════════════════════════════════

export { AI_MODEL_IDS, AI_MODEL_DISPLAY_NAMES };
export type { AIModelId };

/** AI player information */
export interface AIPlayerInfo {
  playerId: string;
  name: string;
  avatarId?: string;
  modelId: AIModelId;
  modelDisplayName: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Lobby State (Server-side representation for clients)
// ═══════════════════════════════════════════════════════════════════════════

/** Human player info (from Phase 2 presence) */
export interface HumanPlayerInfo {
  playerId: string;
  name: string;
  avatarId?: string;
  isConnected: boolean;
  disconnectedAt: number | null;
}

/** Full lobby state sent to clients */
export interface LobbyStatePayload {
  players: HumanPlayerInfo[];
  aiPlayers: AIPlayerInfo[];
  startingRound: RoundNumber;
  canStart: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Client → Server Messages
// ═══════════════════════════════════════════════════════════════════════════

// Zod schemas for validation
export const joinMessageSchema = z.object({
  type: z.literal("JOIN"),
  playerId: z.string().min(1).max(64),
  playerName: z.string().min(1).max(24),
  avatarId: z.string().max(32).optional(),
});

export const addAIPlayerSchema = z.object({
  type: z.literal("ADD_AI_PLAYER"),
  name: z.string().min(1).max(24),
  avatarId: z.string().max(32).optional(),
  modelId: z.enum(AI_MODEL_IDS),
});

export const removeAIPlayerSchema = z.object({
  type: z.literal("REMOVE_AI_PLAYER"),
  playerId: z.string().min(1),
});

export const setStartingRoundSchema = z.object({
  type: z.literal("SET_STARTING_ROUND"),
  round: z.number().int().min(1).max(6),
});

export const startGameSchema = z.object({
  type: z.literal("START_GAME"),
});

// Agent testing message for state injection
export const injectStateMessageSchema = z.object({
  type: z.literal("INJECT_STATE"),
  state: agentTestStateSchema,
});

// Agent harness setup (quick start / injection)
export const agentSetupSchema = agentSetupMessageSchema;

// Game action schemas
export const meldSpecSchema = z.object({
  type: z.enum(["set", "run"]),
  cardIds: z.array(z.string()),
});

export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("DRAW_FROM_STOCK") }),
  z.object({ type: z.literal("DRAW_FROM_DISCARD") }),
  z.object({ type: z.literal("LAY_DOWN"), melds: z.array(meldSpecSchema) }),
  z.object({ type: z.literal("LAY_OFF"), cardId: z.string(), meldId: z.string(), position: z.enum(["start", "end"]).optional() }),
  z.object({
    type: z.literal("SWAP_JOKER"),
    meldId: z.string(),
    jokerCardId: z.string(),
    swapCardId: z.string(),
  }),
  z.object({ type: z.literal("DISCARD"), cardId: z.string() }),
  z.object({ type: z.literal("SKIP") }),
  z.object({ type: z.literal("REORDER_HAND"), cardIds: z.array(z.string()) }),
  z.object({ type: z.literal("CALL_MAY_I") }),
  z.object({ type: z.literal("ALLOW_MAY_I") }),
  z.object({ type: z.literal("CLAIM_MAY_I") }),
]);

export const gameActionMessageSchema = z.object({
  type: z.literal("GAME_ACTION"),
  action: gameActionSchema,
});

// Combined client message schema
// Heartbeat messages for connection health monitoring
export const pingMessageSchema = z.object({
  type: z.literal("PING"),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  joinMessageSchema,
  addAIPlayerSchema,
  removeAIPlayerSchema,
  setStartingRoundSchema,
  startGameSchema,
  gameActionMessageSchema,
  pingMessageSchema,
  injectStateMessageSchema,
  agentSetupSchema,
]);

// TypeScript types derived from Zod schemas
export type JoinMessage = z.infer<typeof joinMessageSchema>;
export type AddAIPlayerMessage = z.infer<typeof addAIPlayerSchema>;
export type RemoveAIPlayerMessage = z.infer<typeof removeAIPlayerSchema>;
export type SetStartingRoundMessage = z.infer<typeof setStartingRoundSchema>;
export type StartGameMessage = z.infer<typeof startGameSchema>;
export type InjectStateMessage = z.infer<typeof injectStateMessageSchema>;
export type AgentSetupMessage = z.infer<typeof agentSetupSchema>;
export type GameActionMessage = z.infer<typeof gameActionMessageSchema>;
export type GameAction = z.infer<typeof gameActionSchema>;
export type PingMessage = z.infer<typeof pingMessageSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Server → Client Messages
// ═══════════════════════════════════════════════════════════════════════════

// Phase 2 (existing) messages
export interface ConnectedMessage {
  type: "CONNECTED";
  roomId: string;
}

export interface JoinedMessage {
  type: "JOINED";
  playerId: string;
  playerName: string;
}

export interface PlayersMessage {
  type: "PLAYERS";
  players: HumanPlayerInfo[];
}

export interface ErrorMessage {
  type: "ERROR";
  error: string;
  message: string;
}

/** Server response to PING - confirms connection is alive */
export interface PongMessage {
  type: "PONG";
}

// Phase 3 lobby additions
export interface LobbyStateMessage {
  type: "LOBBY_STATE";
  lobbyState: LobbyStatePayload;
}

export interface AIPlayerAddedMessage {
  type: "AI_PLAYER_ADDED";
  player: AIPlayerInfo;
}

export interface AIPlayerRemovedMessage {
  type: "AI_PLAYER_REMOVED";
  playerId: string;
}

export interface StartingRoundChangedMessage {
  type: "STARTING_ROUND_CHANGED";
  round: RoundNumber;
}

// Phase 3 game state messages
export interface GameStartedMessage {
  type: "GAME_STARTED";
  state: PlayerView;
  activityLog: ActivityLogEntry[];
}

export interface GameStateMessage {
  type: "GAME_STATE";
  state: PlayerView;
  activityLog: ActivityLogEntry[];
}

export interface AIThinkingMessage {
  type: "AI_THINKING";
  playerId: string;
  playerName: string;
}

export interface AIDoneMessage {
  type: "AI_DONE";
  playerId: string;
}

// May I messages
export interface MayIPromptMessage {
  type: "MAY_I_PROMPT";
  callerId: string;
  callerName: string;
  card: Card;
}

/**
 * Broadcast to ALL players when someone calls May I
 * This is separate from MAY_I_PROMPT which only goes to the current player being prompted.
 * Used to show a notification in the calling player's status area on the table view.
 */
export interface MayINotificationMessage {
  type: "MAY_I_NOTIFICATION";
  callerId: string;
  callerName: string;
  card: Card;
}

export interface MayIResolvedMessage {
  type: "MAY_I_RESOLVED";
  winnerId: string | null;
  outcome: string;
}

// Round/Game transition messages
export interface RoundEndedMessage {
  type: "ROUND_ENDED";
  roundNumber: number;
  scores: Record<string, number>;
  /** Map of lobby player IDs to display names */
  playerNames: Record<string, string>;
}

export interface GameEndedMessage {
  type: "GAME_ENDED";
  finalScores: Record<string, number>;
  winnerId: string;
  /** Map of lobby player IDs to display names */
  playerNames: Record<string, string>;
}

export interface AgentSetupResultMessage {
  type: "AGENT_SETUP_RESULT";
  requestId: string;
  status: "ok" | "already_setup" | "error";
  message?: string;
}

// Union of all server messages
export type ServerMessage =
  | ConnectedMessage
  | JoinedMessage
  | PlayersMessage
  | ErrorMessage
  | PongMessage
  | LobbyStateMessage
  | AIPlayerAddedMessage
  | AIPlayerRemovedMessage
  | StartingRoundChangedMessage
  | GameStartedMessage
  | GameStateMessage
  | AIThinkingMessage
  | AIDoneMessage
  | MayIPromptMessage
  | MayINotificationMessage
  | MayIResolvedMessage
  | RoundEndedMessage
  | GameEndedMessage
  | AgentSetupResultMessage;

// ═══════════════════════════════════════════════════════════════════════════
// Validation Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse and validate a client message
 * Returns the parsed message or an error object
 */
export function parseClientMessage(
  raw: unknown
): { success: true; data: ClientMessage } | { success: false; error: string } {
  const result = clientMessageSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map((e) => e.message).join(", "),
  };
}

/**
 * Type guard for lobby phase messages
 */
export function isLobbyPhaseMessage(msg: ClientMessage): boolean {
  return (
    msg.type === "JOIN" ||
    msg.type === "ADD_AI_PLAYER" ||
    msg.type === "REMOVE_AI_PLAYER" ||
    msg.type === "SET_STARTING_ROUND" ||
    msg.type === "START_GAME" ||
    msg.type === "INJECT_STATE" ||
    msg.type === "AGENT_SETUP"
  );
}

/**
 * Type guard for game phase messages
 */
export function isGamePhaseMessage(msg: ClientMessage): boolean {
  return msg.type === "GAME_ACTION";
}

/**
 * Serialize a server message to JSON string
 */
export function serializeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}
