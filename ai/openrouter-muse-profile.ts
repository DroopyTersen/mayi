import type { OpenRouterChatSettings } from "@openrouter/ai-sdk-provider";

export type OpenRouterMuseReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export function createOpenRouterMuseChatSettings(
  effort: OpenRouterMuseReasoningEffort,
  options: { retainReasoning?: boolean } = {},
): OpenRouterChatSettings {
  return {
    reasoning: { effort, exclude: options.retainReasoning !== true },
    usage: { include: true },
  };
}

/** User-selected Spark-low notebook-plus-examples configuration. */
export const OPENROUTER_MUSE_CHAT_SETTINGS =
  createOpenRouterMuseChatSettings("low");
