import type { ModelMessage } from "ai";

export interface OpenAIResponseLineageContext {
  gameId: string;
  playerId: string;
  round: number;
  modelId: string;
  promptVersion: string;
}

export interface OpenAIPendingToolResult {
  toolCallId: string;
  toolName: string;
  output: string;
}

export interface OpenAIResponseContinuation {
  responseId: string;
  pendingToolResult: OpenAIPendingToolResult;
}

export interface OpenAIResponseLineage extends OpenAIResponseLineageContext {
  continuation: OpenAIResponseContinuation;
}

export function commitOpenAIResponseLineage(
  context: OpenAIResponseLineageContext,
  continuation: OpenAIResponseContinuation,
): OpenAIResponseLineage {
  if (continuation.responseId.trim().length === 0) {
    throw new Error("response ID must not be empty");
  }

  return {
    ...context,
    continuation,
  };
}

export function createOpenAIContinuationMessages(
  pendingToolResult: OpenAIPendingToolResult,
  gameState: string,
): ModelMessage[] {
  return [
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: pendingToolResult.toolCallId,
          toolName: pendingToolResult.toolName,
          output: {
            type: "text",
            value: pendingToolResult.output,
          },
        },
      ],
    },
    {
      role: "user",
      content: gameState,
    },
  ];
}

export function resolveOpenAIResponseLineage(
  lineage: OpenAIResponseLineage | undefined,
  context: OpenAIResponseLineageContext,
): OpenAIResponseContinuation | undefined {
  if (
    lineage === undefined ||
    lineage.gameId !== context.gameId ||
    lineage.playerId !== context.playerId ||
    lineage.round !== context.round ||
    lineage.modelId !== context.modelId ||
    lineage.promptVersion !== context.promptVersion
  ) {
    return undefined;
  }

  return lineage.continuation;
}

type Awaitable<T> = T | Promise<T>;

export interface OpenAIResponseLineageStore {
  get: (playerId: string) => Awaitable<OpenAIResponseLineage | undefined>;
  set: (lineage: OpenAIResponseLineage) => Awaitable<void>;
  clear: (playerId: string) => Awaitable<void>;
}

export interface OpenAIResponseTurnResult {
  success: boolean;
  actions: readonly unknown[];
  aborted?: boolean;
  continuation?: OpenAIResponseContinuation;
}

interface ExecuteWithOpenAIResponseLineageOptions<
  Result extends OpenAIResponseTurnResult,
> {
  context: OpenAIResponseLineageContext;
  store: OpenAIResponseLineageStore;
  execute: (
    continuation: OpenAIResponseContinuation | undefined,
  ) => Promise<Result>;
  abortSignal?: AbortSignal;
}

/**
 * Run one AI turn with its stored Responses continuation.
 *
 * This is the single owner of compatibility checks, stale-state clearing,
 * one stateless retry, and successful continuation commits.
 */
export async function executeWithOpenAIResponseLineage<
  Result extends OpenAIResponseTurnResult,
>(
  options: ExecuteWithOpenAIResponseLineageOptions<Result>,
): Promise<Result & { aborted?: boolean }> {
  const existing = await options.store.get(options.context.playerId);
  const continuation = resolveOpenAIResponseLineage(existing, options.context);

  if (existing !== undefined && continuation === undefined) {
    await options.store.clear(options.context.playerId);
  }

  let result = await options.execute(continuation);
  if (options.abortSignal?.aborted || result.aborted) {
    return Object.assign({}, result, { success: false, aborted: true });
  }

  if (continuation !== undefined && !result.success) {
    await options.store.clear(options.context.playerId);
    if (result.actions.length === 0) {
      result = await options.execute(undefined);
      if (options.abortSignal?.aborted || result.aborted) {
        return Object.assign({}, result, { success: false, aborted: true });
      }
    }
  }

  if (result.success && result.actions.length > 0) {
    if (result.continuation !== undefined) {
      await options.store.set(
        commitOpenAIResponseLineage(options.context, result.continuation),
      );
    } else if (continuation !== undefined) {
      await options.store.clear(options.context.playerId);
    }
  }

  return result;
}
