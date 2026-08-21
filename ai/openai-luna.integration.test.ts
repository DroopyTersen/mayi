import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import {
  createOpenAILunaInstructions,
  createOpenAILunaProviderOptions,
} from "./openai-luna-profile";
import {
  createOpenAIContinuationMessages,
  type OpenAIPendingToolResult,
} from "./openai-response-lineage";
import { buildSystemPrompt } from "./mayIAgent.prompt";

const hasLiveCredentials =
  process.env.RUN_INTEGRATION_TESTS === "1" &&
  typeof process.env.OPENAI_API_KEY === "string" &&
  process.env.OPENAI_API_KEY.length > 0;

const HOUSE_RULE_FIXTURES = [
  ["draw/discard", "draw first", "choose a safe discard"],
  ["May-I", "discard plus penalty card", "claim only when strategically justified"],
  ["contract shape", "complete contract in one action", "prioritize going down"],
  ["wild ratio laydown", "wilds do not outnumber naturals", "save wilds when safe"],
  ["wild ratio layoff", "wilds may outnumber naturals", "use wild flexibility"],
  ["same-suit gap", "two-card gap between same-suit runs", "do not split one run"],
  ["Ace", "engine rank order", "avoid high-point liability"],
  ["multi-deck set", "distinct duplicate suits are valid", "never reuse a physical card"],
  ["layoff", "draw first and not on laydown turn", "empty hand efficiently"],
  ["Joker swap", "run only and before laying down", "swap when it reduces risk"],
  ["opponent-feed", "discard exactly one", "avoid ranks opponents collect"],
  ["endgame dump", "respect current phase", "shed high points before an opponent goes out"],
  ["Round 6", "use every card; no layoff or Joker swap", "avoid May-I unless all cards can meld"],
] as const;

const STABLE_HOUSE_RULE_INSTRUCTIONS = buildSystemPrompt();

function writeArtifact(name: string, value: unknown): void {
  const directory = ".data/ai-evals";
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    `${directory}/${name}-${Date.now()}.json`,
    JSON.stringify(value, null, 2),
  );
}

function getResponseId(result: { providerMetadata?: unknown }): string | undefined {
  const metadata = result.providerMetadata;
  if (typeof metadata !== "object" || metadata === null) return undefined;
  const openai = (metadata as { openai?: unknown }).openai;
  if (typeof openai !== "object" || openai === null) return undefined;
  const responseId = (openai as { responseId?: unknown }).responseId;
  return typeof responseId === "string" && responseId.length > 0
    ? responseId
    : undefined;
}

function getReasoningContext(result: { providerMetadata?: unknown }): string | undefined {
  const metadata = result.providerMetadata;
  if (typeof metadata !== "object" || metadata === null) return undefined;
  const openai = (metadata as { openai?: unknown }).openai;
  if (typeof openai !== "object" || openai === null) return undefined;
  const context = (openai as { reasoningContext?: unknown }).reasoningContext;
  return typeof context === "string" ? context : undefined;
}

function getCacheMetrics(result: {
  usage: {
    inputTokenDetails: {
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    };
  };
}) {
  return {
    cacheReadTokens: result.usage.inputTokenDetails.cacheReadTokens ?? 0,
    cacheWriteTokens: result.usage.inputTokenDetails.cacheWriteTokens ?? 0,
  };
}

function makeFinishTool() {
  return {
    finish_turn: tool({
      description: "Finish the current evaluation turn.",
      inputSchema: z.object({ decision: z.string() }),
      execute: async ({ decision }) => ({ ok: true, decision }),
    }),
  };
}

function assertLunaProviderProfile(
  options: ReturnType<typeof createOpenAILunaProviderOptions>,
  allowedToolNames?: string[],
): void {
  expect(options).toMatchObject({
    store: true,
    reasoningEffort: "medium",
    reasoningContext: "all_turns",
    parallelToolCalls: false,
  });
  if (allowedToolNames !== undefined) {
    expect(options.allowedTools).toEqual({
      toolNames: allowedToolNames,
      mode: "required",
    });
  }
}

describe("GPT-5.6 Luna live Responses verification", () => {
  it("keeps fixed house-rule quality fixtures explicit for the eval matrix", () => {
    expect(HOUSE_RULE_FIXTURES).toHaveLength(13);
    expect(STABLE_HOUSE_RULE_INSTRUCTIONS.length).toBeGreaterThan(4000);
    const instructions = createOpenAILunaInstructions(STABLE_HOUSE_RULE_INSTRUCTIONS);
    expect(instructions.providerOptions?.openai).toMatchObject({
      promptCacheBreakpoint: { mode: "explicit" },
    });
    for (const fixture of HOUSE_RULE_FIXTURES) {
      expect(fixture).toHaveLength(3);
      expect(fixture.every((field) => field.length > 0)).toBe(true);
    }
  });

  describe.skipIf(!hasLiveCredentials)("real provider", () => {
    it("uses a tool, returns a response ID, and continues with its pending terminal tool result", async () => {
      const model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
        "gpt-5.6-luna",
      );
      const tools = makeFinishTool();
      const firstProviderOptions = createOpenAILunaProviderOptions({
        allowedToolNames: ["finish_turn"],
      });
      assertLunaProviderProfile(firstProviderOptions, ["finish_turn"]);
      const first = await generateText({
        model,
        instructions: createOpenAILunaInstructions(STABLE_HOUSE_RULE_INSTRUCTIONS),
        prompt: "Call finish_turn with the decision draw_from_stock.",
        tools,
        toolChoice: "required",
        stopWhen: stepCountIs(1),
        providerOptions: {
          openai: firstProviderOptions,
        },
      });

      const responseId = getResponseId(first);
      const toolResult = first.steps.at(-1)?.toolResults.at(-1);
      expect(responseId).toBeString();
      expect(toolResult?.toolCallId).toBeString();

      const pendingToolResult: OpenAIPendingToolResult = {
        toolCallId: toolResult!.toolCallId,
        toolName: toolResult!.toolName,
        output: JSON.stringify(toolResult!.output),
      };
      const secondProviderOptions = createOpenAILunaProviderOptions({
        previousResponseId: responseId,
        allowedToolNames: ["finish_turn"],
      });
      assertLunaProviderProfile(secondProviderOptions, ["finish_turn"]);
      const second = await generateText({
        model,
        instructions: createOpenAILunaInstructions(STABLE_HOUSE_RULE_INSTRUCTIONS),
        messages: createOpenAIContinuationMessages(
          pendingToolResult,
          "Use the previous terminal result and call finish_turn again with decision continue.",
        ),
        tools,
        toolChoice: "required",
        stopWhen: stepCountIs(1),
        providerOptions: {
          openai: secondProviderOptions,
        },
      });

      const secondResponseId = getResponseId(second);
      expect(secondResponseId).toBeString();
      expect(second.steps.at(-1)?.toolResults.at(-1)?.toolName).toBe("finish_turn");
      expect(getReasoningContext(first)).toBeString();
      expect(getReasoningContext(second)).toBeString();

      writeArtifact("continuation", {
        fixtures: HOUSE_RULE_FIXTURES,
        responseId,
        secondResponseId,
        reasoningContext: getReasoningContext(first),
        firstUsage: first.usage,
        secondUsage: second.usage,
      });
    }, 120000);

    it("accepts the stable house-rule cache breakpoint and reports usage", async () => {
      const model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
        "gpt-5.6-luna",
      );
      const cacheProviderOptions = {
        ...createOpenAILunaProviderOptions({}),
        promptCacheKey: `mayi:cache-probe:${Date.now()}`,
      };
      assertLunaProviderProfile(cacheProviderOptions);
      const options = {
        model,
        instructions: createOpenAILunaInstructions(STABLE_HOUSE_RULE_INSTRUCTIONS),
        maxOutputTokens: 128,
        providerOptions: {
          openai: cacheProviderOptions,
        },
      } as const;
      const cold = await generateText({ ...options, prompt: "Evaluate fixture A." });
      const coldCache = getCacheMetrics(cold);
      const warm = await generateText({ ...options, prompt: "Evaluate fixture B." });
      const warmCache = getCacheMetrics(warm);

      writeArtifact("prompt-cache", {
        fixtures: HOUSE_RULE_FIXTURES,
        coldCache,
        warmCache,
        coldUsage: cold.usage,
        warmUsage: warm.usage,
      });
      expect((cold.usage.inputTokens ?? 0) + (warm.usage.inputTokens ?? 0)).toBeGreaterThan(
        1_024,
      );
      expect(
        [
          coldCache.cacheReadTokens,
          coldCache.cacheWriteTokens,
          warmCache.cacheReadTokens,
          warmCache.cacheWriteTokens,
        ].every((tokens) => Number.isFinite(tokens) && tokens >= 0),
      ).toBe(true);
    }, 120000);

    it("surfaces a compaction item with a deliberately low threshold", async () => {
      const model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
        "gpt-5.6-luna",
      );
      const result = await generateText({
        model,
        instructions: createOpenAILunaInstructions(STABLE_HOUSE_RULE_INSTRUCTIONS),
        prompt: `${STABLE_HOUSE_RULE_INSTRUCTIONS}\nRepeat the rules and summarize the legal priority.`,
        maxOutputTokens: 64,
        providerOptions: {
          openai: createOpenAILunaProviderOptions({ compactThreshold: 1024 }),
        },
      });
      const compactionParts = result.steps.flatMap((step) =>
        step.content.filter(
          (part) => part.type === "custom" && part.kind === "openai.compaction",
        ),
      );

      expect(compactionParts.length).toBeGreaterThan(0);
      writeArtifact("compaction", {
        fixtures: HOUSE_RULE_FIXTURES,
        compactionCount: compactionParts.length,
        reasoningContext: getReasoningContext(result),
        usage: result.usage,
      });
    }, 120000);
  });
});
