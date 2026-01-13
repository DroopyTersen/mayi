/**
 * AI model identifiers and display names.
 *
 * Kept in a small standalone module to avoid circular dependencies between
 * protocol types and agent test state validation.
 */

/** Available AI model IDs - use default: prefix for stable references */
export const AI_MODEL_IDS = [
  "default:grok",
  "default:claude",
  "default:openai",
  "default:gemini",
] as const;

export type AIModelId = (typeof AI_MODEL_IDS)[number];

/** Display names for AI models */
export const AI_MODEL_DISPLAY_NAMES: Record<AIModelId, string> = {
  "default:grok": "Grok",
  "default:claude": "Claude",
  "default:openai": "GPT",
  "default:gemini": "Gemini",
};

