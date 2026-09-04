import type { AssistantModelMessage, ModelMessage, ToolModelMessage } from "ai";
import type { GameSnapshot } from "../core/engine/game-engine.types";

export const AI_HAND_CONVERSATION_VERSION = "private-hand-conversation-v1";

export interface AIHandConversationOwner {
  gameId: string;
  playerId: string;
  /** Trusted caller identity for one serialized, never-rewound game incarnation. */
  lineageId: string;
}

export interface AIHandConversationContext extends AIHandConversationOwner,
  Pick<GameSnapshot, "currentRound" | "turnNumber" | "phase"> {
  modelId: string;
  modelConfigurationSha256: string;
  /** Exact effective instructions, not a version label or changing observation. */
  systemPrompt: string;
}

type AIConversationResponse = AssistantModelMessage | ToolModelMessage;

export interface AIHandConversationTrace {
  outcome: "committed" | "discarded" | "reset";
  reason: string;
  suppliedHistoryMessageCount: number;
  requestMessageCount: number;
  committedHistoryMessageCount: number;
}

export interface AIHandConversationFinish {
  /** Undefined when the required fresh runtime read failed. */
  latestContext: AIHandConversationContext | undefined;
  responseMessages: readonly AIConversationResponse[];
  /** Caller must verify the actual terminal decision, including May I validity. */
  completed: boolean;
  aborted: boolean;
}

export interface AIHandConversationDecision {
  /** A new defensive copy on each access. Never put these messages in traces. */
  readonly messages: ModelMessage[];
  finish(result: AIHandConversationFinish): AIHandConversationTrace;
  cancel(): AIHandConversationTrace;
}

function isActiveHand(context: AIHandConversationContext): boolean {
  return context.phase === "ROUND_ACTIVE" || context.phase === "RESOLVING_MAY_I";
}

/** Validate linkage without changing or reconstructing any returned messages. */
export function hasCompletedAIPlayerToolExchange(messages: readonly AIConversationResponse[]): boolean {
  const pending = new Map<string, string>();
  const seen = new Set<string>();
  let terminalResult = false;
  for (const message of messages) {
    if (message.role === "assistant") {
      if (pending.size !== 0) return false;
      if (typeof message.content === "string") continue;
      for (const part of message.content) {
        if (part.type !== "tool-call") continue;
        if (seen.has(part.toolCallId)) return false;
        seen.add(part.toolCallId);
        pending.set(part.toolCallId, part.toolName);
      }
    } else if (message.role === "tool") {
      for (const part of message.content) {
        if (part.type !== "tool-result") return false;
        if (pending.get(part.toolCallId) !== part.toolName) return false;
        pending.delete(part.toolCallId);
        const output = part.output;
        if (output.type === "json" && output.value !== null &&
          typeof output.value === "object" && !Array.isArray(output.value) &&
          output.value.success === true && output.value.turnComplete === true) {
          terminalResult = true;
        }
      }
    } else return false;
  }
  return terminalResult && pending.size === 0;
}

/**
 * Private, process-local history only. This lease prevents competing history
 * commits; it does not serialize game actions or detect arbitrary board rewinds.
 * The caller owns runtime serialization, fresh-state checks and cancellation.
 */
export class AIHandConversation {
  readonly #owner: AIHandConversationOwner;
  #messages: ModelMessage[] = [];
  #round = 0;
  #turn = 0;
  #ended = false;
  #configuration = "";
  #generation = 0;
  #pending: number | undefined;

  constructor(owner: AIHandConversationOwner) {
    if ([owner.gameId, owner.playerId, owner.lineageId].some(value => value.trim().length === 0)) {
      throw new Error("Conversation owner identity must not be empty");
    }
    this.#owner = { gameId: owner.gameId, playerId: owner.playerId, lineageId: owner.lineageId };
  }

  #assertOwner(context: AIHandConversationContext): void {
    if (context.gameId !== this.#owner.gameId || context.playerId !== this.#owner.playerId ||
      context.lineageId !== this.#owner.lineageId) throw new Error("Conversation owner mismatch");
  }

  /** Clears memory and invalidates outstanding tickets, not already played actions. */
  reset(): void {
    this.#messages = [];
    this.#generation++;
    this.#pending = undefined;
  }

  #synchronize(context: AIHandConversationContext): boolean {
    this.#assertOwner(context);
    if (context.currentRound < this.#round ||
      (context.currentRound === this.#round && context.turnNumber < this.#turn)) {
      throw new Error("Conversation context is stale");
    }
    const configuration = JSON.stringify([
      context.modelId, context.modelConfigurationSha256, context.systemPrompt,
    ]);
    if (context.currentRound > this.#round) {
      this.reset();
      this.#round = context.currentRound;
      this.#turn = 0;
      this.#ended = false;
    }
    if (configuration !== this.#configuration) {
      this.reset();
      this.#configuration = configuration;
    }
    this.#turn = context.turnNumber;
    if (!isActiveHand(context)) {
      this.reset();
      this.#ended = true;
    }
    return !this.#ended;
  }

  begin(context: AIHandConversationContext, observation: string): AIHandConversationDecision {
    this.#assertOwner(context);
    if (this.#pending !== undefined) throw new Error("Conversation decision already in flight");
    if (!this.#synchronize(context)) throw new Error("Conversation hand has ended");
    const token = ++this.#generation;
    this.#pending = token;
    const suppliedHistoryMessageCount = this.#messages.length;
    const requestMessages: ModelMessage[] = structuredClone([
      ...this.#messages, { role: "user", content: observation },
    ]);
    let finished = false;
    const trace = (outcome: AIHandConversationTrace["outcome"], reason: string): AIHandConversationTrace => ({
      outcome, reason, suppliedHistoryMessageCount,
      requestMessageCount: requestMessages.length,
      committedHistoryMessageCount: this.#messages.length,
    });
    const discard = (reason: string): AIHandConversationTrace => {
      if (this.#pending === token) this.#pending = undefined;
      finished = true;
      return trace("discarded", reason);
    };
    return {
      get messages() { return structuredClone(requestMessages); },
      cancel: () => discard("cancelled"),
      finish: (result) => {
        if (finished || this.#pending !== token || this.#generation !== token) {
          return discard("stale-or-consumed-ticket");
        }
        if (result.latestContext === undefined) return discard("fresh-context-unavailable");
        try {
          const active = this.#synchronize(result.latestContext);
          if (!active || this.#generation !== token) {
            finished = true;
            return trace("reset", active ? "lineage-changed" : "hand-ended");
          }
        } catch {
          return discard("invalid-latest-context");
        }
        if (result.aborted || !result.completed) return discard(result.aborted ? "aborted" : "incomplete");
        if (!hasCompletedAIPlayerToolExchange(result.responseMessages)) return discard("invalid-tool-exchange");
        this.#messages = structuredClone([...requestMessages, ...result.responseMessages]);
        this.#pending = undefined;
        finished = true;
        return trace("committed", "completed-decision");
      },
    };
  }
}
