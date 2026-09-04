import type { AssistantModelMessage, ModelMessage, ToolModelMessage } from "ai";
import type { GameSnapshot } from "../core/engine/game-engine.types";
import { getActionAvailabilityDetails } from "../core/engine/game-engine.availability";
import { AIHandConversation, hasCompletedAIPlayerToolExchange, type AIHandConversationContext, type AIHandConversationTrace } from "./mayIAgent.conversation";

export interface AIPlayerDecisionContextOptions {
  /** One serialized, never-rewound runtime incarnation, shared across its decisions. */
  lineageId: string;
  modelConfigurationSha256: string;
  /** Omit for the fresh-context control; both arms receive identical tracing. */
  conversation?: AIHandConversation;
}

export interface AIPlayerDecisionContextTrace extends Omit<AIHandConversationTrace, "outcome"> {
  mode: "fresh" | "per-hand";
  outcome: AIHandConversationTrace["outcome"] | "not-retained";
  observationSha256: string;
  systemPromptSha256: string;
  modelConfigurationSha256: string;
  suppliedHistorySha256: string;
  requestMessagesSha256: string;
  responseMessagesSha256: string;
  responseMessageCount: number;
  completionValidated: boolean;
}

interface BeginDecisionContext {
  options: AIPlayerDecisionContextOptions;
  snapshot: GameSnapshot;
  playerId: string;
  modelId: string | undefined;
  systemPrompt: string;
  observation: string;
  kind: "turn" | "may-i-call";
}

interface FinishDecisionContext {
  /** A fresh authoritative read, not the observation-time snapshot. */
  latestSnapshot: GameSnapshot | undefined;
  responseMessages: readonly (AssistantModelMessage | ToolModelMessage)[];
  completed: boolean;
  mayICallDecision?: "call" | "pass";
  abortSignal?: AbortSignal;
  aborted?: boolean;
}

export interface AIPlayerDecisionContext {
  /** Undefined in the control: leave its existing prompt path unchanged. */
  readonly messages: ModelMessage[] | undefined;
  finish(result: FinishDecisionContext): Promise<{
    completed: boolean;
    aborted: boolean;
    trace: AIPlayerDecisionContextTrace;
  }>;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Player observations and opaque messages stay private; only hashes enter evals. */
export async function beginAIPlayerDecisionContext(input: BeginDecisionContext): Promise<AIPlayerDecisionContext> {
  const { options, playerId, modelId, systemPrompt, observation } = input;
  if (modelId === undefined || modelId.trim().length === 0) {
    throw new Error("Decision context requires a configured model identity");
  }
  if (!/^[a-f0-9]{64}$/.test(options.modelConfigurationSha256) || options.lineageId.trim().length === 0) {
    throw new Error("Decision context requires an effective configuration SHA256 and runtime lineage");
  }
  // Capture scalars, not the caller-owned snapshot/options or hidden game state.
  const identity = { playerId, modelId, systemPrompt, lineageId: options.lineageId, modelConfigurationSha256: options.modelConfigurationSha256 };
  const initial = {
    gameId: input.snapshot.gameId, currentRound: input.snapshot.currentRound,
    turnNumber: input.snapshot.turnNumber, exposedCardId: input.snapshot.discard[0]?.id,
    lastDiscardedByPlayerId: input.snapshot.lastDiscardedByPlayerId,
    kind: input.kind,
  };
  const context = (snapshot: GameSnapshot): AIHandConversationContext => ({
    ...identity, gameId: snapshot.gameId, currentRound: snapshot.currentRound,
    turnNumber: snapshot.turnNumber, phase: snapshot.phase,
  });
  const ticket = options.conversation?.begin(context(input.snapshot), observation);
  try {
    const messages: ModelMessage[] = ticket?.messages ?? [{ role: "user", content: observation }];
    const [observationSha256, systemPromptSha256, suppliedHistorySha256, requestMessagesSha256] = await Promise.all([
      sha256(observation), sha256(systemPrompt), sha256(JSON.stringify(messages.slice(0, -1))), sha256(JSON.stringify(messages)),
    ]);
    return {
      get messages() { return ticket === undefined ? undefined : structuredClone(messages); },
      async finish(result) {
        const responseMessages = structuredClone(result.responseMessages);
        const latest = result.latestSnapshot;
        const latestContext = latest === undefined ? undefined : context(latest);
        const abortSignal = result.abortSignal;
        const previouslyAborted = result.aborted === true;
        let completed = result.completed && hasCompletedAIPlayerToolExchange(responseMessages) && latest !== undefined &&
          latest.gameId === initial.gameId && latest.currentRound >= initial.currentRound &&
          (latest.currentRound > initial.currentRound || latest.turnNumber >= initial.turnNumber);
        if (initial.kind === "may-i-call") {
          completed = completed && result.mayICallDecision !== undefined;
          if (result.mayICallDecision === "pass") {
            completed = completed && latest !== undefined && initial.exposedCardId !== undefined &&
              latest.currentRound === initial.currentRound && latest.turnNumber === initial.turnNumber &&
              latest.discard[0]?.id === initial.exposedCardId &&
              latest.lastDiscardedByPlayerId === initial.lastDiscardedByPlayerId &&
              getActionAvailabilityDetails(latest, playerId).availableActions.canMayI;
          }
        }
        const responseMessagesSha256 = await sha256(JSON.stringify(responseMessages));
        const aborted = previouslyAborted || abortSignal?.aborted === true;
        completed = completed && !aborted;
        const historyTrace = ticket?.finish({
          latestContext, responseMessages, completed, aborted,
        });
        if (historyTrace?.outcome === "discarded") completed = false;
        return {
          completed, aborted,
          trace: {
            mode: ticket === undefined ? "fresh" : "per-hand",
            ...(historyTrace ?? {
              outcome: "not-retained", reason: completed ? "completed-decision" : "incomplete",
              suppliedHistoryMessageCount: 0, requestMessageCount: 1, committedHistoryMessageCount: 0,
            }),
            observationSha256, systemPromptSha256,
            modelConfigurationSha256: identity.modelConfigurationSha256,
            suppliedHistorySha256, requestMessagesSha256, responseMessagesSha256,
            responseMessageCount: responseMessages.length, completionValidated: completed,
          },
        };
      },
    };
  } catch (error) {
    ticket?.cancel();
    throw error;
  }
}
