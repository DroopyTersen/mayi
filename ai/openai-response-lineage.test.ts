import { describe, expect, it } from "bun:test";

import {
  commitOpenAIResponseLineage,
  createOpenAIContinuationMessages,
  executeWithOpenAIResponseLineage,
  resolveOpenAIResponseLineage,
  type OpenAIResponseContinuation,
  type OpenAIResponseLineageContext,
} from "./openai-response-lineage";
import {
  AI_MODEL_CATALOG,
  DEFAULT_AI_MODEL_ID,
} from "./ai-model-catalog";

const baseContext: OpenAIResponseLineageContext = {
  gameId: "game-1",
  playerId: "player-1",
  round: 2,
  modelId: AI_MODEL_CATALOG[DEFAULT_AI_MODEL_ID].model,
  promptVersion: "mayi-luna-v2",
};

const pendingToolResult = {
  toolCallId: "call-discard",
  toolName: "discard",
  output: '{"success":true,"turnComplete":true}',
};

function createContinuation(responseId: string): OpenAIResponseContinuation {
  return { responseId, pendingToolResult };
}

describe("OpenAI response lineage", () => {
  it("owns continuation retry and commit as one atomic flow", async () => {
    const previousContinuation: OpenAIResponseContinuation = {
      responseId: "resp-expired",
      pendingToolResult,
    };
    const nextContinuation: OpenAIResponseContinuation = {
      responseId: "resp-current",
      pendingToolResult: {
        ...pendingToolResult,
        toolCallId: "call-current",
      },
    };
    let stored = commitOpenAIResponseLineage(
      baseContext,
      previousContinuation,
    );
    const received: Array<OpenAIResponseContinuation | undefined> = [];
    let clears = 0;

    const result = await executeWithOpenAIResponseLineage({
      context: baseContext,
      store: {
        get: () => stored,
        set: (lineage) => {
          stored = lineage;
        },
        clear: () => {
          clears++;
        },
      },
      execute: async (continuation) => {
        received.push(continuation);
        return received.length === 1
          ? { success: false, actions: [] }
          : {
              success: true,
              actions: ["discard"],
              continuation: nextContinuation,
            };
      },
    });

    expect(result.success).toBe(true);
    expect(received).toEqual([previousContinuation, undefined]);
    expect(clears).toBe(1);
    expect(stored).toEqual(
      commitOpenAIResponseLineage(baseContext, nextContinuation),
    );
  });

  it("never commits a continuation after the execution was aborted", async () => {
    const abortController = new AbortController();
    let committed = false;

    const result = await executeWithOpenAIResponseLineage({
      context: baseContext,
      abortSignal: abortController.signal,
      store: {
        get: () => undefined,
        set: () => {
          committed = true;
        },
        clear: () => undefined,
      },
      execute: async () => {
        abortController.abort();
        return {
          success: true,
          actions: ["discard"],
          continuation: {
            responseId: "resp-after-abort",
            pendingToolResult,
          },
        };
      },
    });

    expect(result.aborted).toBe(true);
    expect(committed).toBe(false);
  });

  it("clears a consumed continuation when the provider returns no successor", async () => {
    let clears = 0;
    const stored = commitOpenAIResponseLineage(
      baseContext,
      createContinuation("resp-consumed"),
    );

    await executeWithOpenAIResponseLineage({
      context: baseContext,
      store: {
        get: () => stored,
        set: () => undefined,
        clear: () => {
          clears++;
        },
      },
      execute: async () => ({ success: true, actions: ["discard"] }),
    });

    expect(clears).toBe(1);
  });

  it("continues only for the same game, player, round, model, and prompt", () => {
    const committed = commitOpenAIResponseLineage(
      baseContext,
      createContinuation("resp-1"),
    );

    expect(resolveOpenAIResponseLineage(committed, baseContext)).toEqual(
      createContinuation("resp-1"),
    );

    for (const changedContext of [
      { ...baseContext, gameId: "game-2" },
      { ...baseContext, playerId: "player-2" },
      { ...baseContext, round: 3 },
      { ...baseContext, modelId: AI_MODEL_CATALOG["default:grok"].model },
      { ...baseContext, promptVersion: "mayi-luna-v3" },
    ]) {
      expect(resolveOpenAIResponseLineage(committed, changedContext)).toBeUndefined();
    }
  });

  it("represents a successful committed response without exposing prompt or reasoning data", () => {
    const committed = commitOpenAIResponseLineage(
      baseContext,
      createContinuation("resp-success"),
    );

    expect(committed).toEqual({
      ...baseContext,
      continuation: createContinuation("resp-success"),
    });
  });

  it("rejects an empty response ID instead of creating an unusable continuation", () => {
    expect(() => commitOpenAIResponseLineage(baseContext, createContinuation(""))).toThrow(
      "response ID must not be empty"
    );
    expect(() => commitOpenAIResponseLineage(baseContext, createContinuation("   "))).toThrow(
      "response ID must not be empty"
    );
  });

  it("resets a missing lineage rather than attempting to continue it", () => {
    expect(resolveOpenAIResponseLineage(undefined, baseContext)).toBeUndefined();
  });

  it("replays the terminal tool result before the newest authoritative state", () => {
    expect(
      createOpenAIContinuationMessages(
        pendingToolResult,
        "newest authoritative game state",
      ),
    ).toEqual([
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-discard",
            toolName: "discard",
            output: {
              type: "text",
              value: '{"success":true,"turnComplete":true}',
            },
          },
        ],
      },
      {
        role: "user",
        content: "newest authoritative game state",
      },
    ]);

    expect(
      commitOpenAIResponseLineage(
        baseContext,
        createContinuation("resp-with-tool"),
      ).continuation.pendingToolResult,
    ).toEqual(pendingToolResult);
  });
});
