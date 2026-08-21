import type {
  LanguageModelV4GenerateResult,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import type { Telemetry } from "ai";

export interface LangfuseGameContext {
  gameId: string;
  playerId: string;
  playerName: string;
  round: number;
  turnNumber: number;
}

type AttributeValue = string | number | boolean;

export interface LangfuseSpan {
  setAttributes(
    attributes: Record<string, AttributeValue | undefined>,
  ): void;
  setAttribute(key: string, value: AttributeValue): void;
}

export interface LangfuseTracing {
  enterSpan<T>(
    name: string,
    callback: (span: LangfuseSpan) => PromiseLike<T>,
  ): PromiseLike<T>;
}

export function buildLangfuseGenerationAttributes(options: {
  context: LangfuseGameContext;
  provider: string;
  modelId: string;
  input: unknown;
  output?: unknown;
  usage?: LanguageModelV4Usage;
}): Record<string, AttributeValue> {
  const { context, provider, modelId, input, output, usage } = options;
  const attributes: Record<string, AttributeValue> = {
    "langfuse.trace.name": "may-i-game",
    "session.id": context.gameId,
    "langfuse.environment": "production",
    "langfuse.observation.type": "generation",
    "langfuse.observation.model.name": modelId,
    "langfuse.observation.input": JSON.stringify(input),
    "langfuse.observation.metadata.provider": provider,
    "langfuse.observation.metadata.player_id": context.playerId,
    "langfuse.observation.metadata.player_name": context.playerName,
    "langfuse.observation.metadata.round": context.round,
    "langfuse.observation.metadata.turn_number": context.turnNumber,
  };

  if (output !== undefined) {
    attributes["langfuse.observation.output"] = JSON.stringify(output);
  }

  if (usage !== undefined) {
    const inputTotal = usage.inputTokens.total ?? 0;
    const cacheRead = usage.inputTokens.cacheRead ?? 0;
    const cacheWrite = usage.inputTokens.cacheWrite ?? 0;
    const input =
      usage.inputTokens.noCache ??
      Math.max(0, inputTotal - cacheRead - cacheWrite);
    const output = usage.outputTokens.total ?? 0;

    attributes["langfuse.observation.usage_details"] = JSON.stringify({
      input,
      cache_read_input_tokens: cacheRead,
      cache_write_input_tokens: cacheWrite,
      output,
      total: inputTotal + output,
    });
  }

  return attributes;
}

function isLanguageModelResult(
  value: unknown,
): value is LanguageModelV4GenerateResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(Reflect.get(value, "content")) &&
    typeof Reflect.get(value, "usage") === "object" &&
    typeof Reflect.get(value, "finishReason") === "object"
  );
}

export function createLangfuseAITelemetry(
  tracing: LangfuseTracing,
  context: LangfuseGameContext,
): Telemetry {
  return {
    executeLanguageModelCall: (options) =>
      tracing.enterSpan("may-i-agent", async (span) => {
        const provider = options.provider ?? "unknown";
        const modelId = options.modelId ?? "unknown";
        const input = {
          instructions: options.instructions,
          messages: options.messages,
          tools: options.tools,
        };

        span.setAttributes(
          buildLangfuseGenerationAttributes({
            context,
            provider,
            modelId,
            input,
          }),
        );

        try {
          const result = await options.execute();
          if (isLanguageModelResult(result)) {
            span.setAttributes(
              buildLangfuseGenerationAttributes({
                context,
                provider,
                modelId: result.response?.modelId ?? modelId,
                input,
                output: {
                  content: result.content,
                  finishReason: result.finishReason.unified,
                },
                usage: result.usage,
              }),
            );
          }
          return result;
        } catch (error) {
          span.setAttribute("langfuse.observation.level", "ERROR");
          span.setAttribute(
            "langfuse.observation.status_message",
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      }),
  };
}
