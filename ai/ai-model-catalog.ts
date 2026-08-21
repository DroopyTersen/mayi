/** The only AI models May I? exposes to players. */
export type AIModelId =
  | "default:openai"
  | "default:grok"
  | "default:claude"
  | "default:gemini";

type ModelProvider = "openai" | "xai" | "anthropic" | "gemini";

export interface AIModelDefinition {
  name: string;
  providerName: string;
  provider: ModelProvider;
  model: string;
  profile: "openai-luna" | "standard";
  settings: { maxOutputTokens: number; temperature?: number };
}

export const DEFAULT_AI_MODEL_ID = "default:openai" as const;
export const DEFAULT_AI_PLAYER_NAME_PREFIX = "Luna";

const LUNA_SETTINGS = { maxOutputTokens: 4096 } as const;
const STANDARD_SETTINGS = { maxOutputTokens: 4096, temperature: 0.7 } as const;

export const AI_MODEL_CATALOG: Record<AIModelId, AIModelDefinition> = {
  "default:openai": {
    name: "GPT-5.6 Luna",
    providerName: "OpenAI",
    provider: "openai",
    model: "gpt-5.6-luna",
    profile: "openai-luna",
    settings: LUNA_SETTINGS,
  },
  "default:grok": {
    name: "Grok",
    providerName: "xAI",
    provider: "xai",
    model: "grok-4-1-fast-reasoning",
    profile: "standard",
    settings: STANDARD_SETTINGS,
  },
  "default:claude": {
    name: "Claude",
    providerName: "Anthropic",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    profile: "standard",
    settings: STANDARD_SETTINGS,
  },
  "default:gemini": {
    name: "Gemini",
    providerName: "Google",
    provider: "gemini",
    model: "gemini-3.1-flash-lite-preview",
    profile: "standard",
    settings: STANDARD_SETTINGS,
  },
};

export const AI_MODEL_IDS = Object.keys(AI_MODEL_CATALOG) as AIModelId[];

export const AI_MODEL_OPTIONS = AI_MODEL_IDS.map((id) => ({
  id,
  name: AI_MODEL_CATALOG[id].name,
  provider: AI_MODEL_CATALOG[id].providerName,
}));

export const AI_MODEL_DISPLAY_NAMES: Record<AIModelId, string> = Object.fromEntries(
  AI_MODEL_IDS.map((id) => [id, AI_MODEL_CATALOG[id].name]),
) as Record<AIModelId, string>;

export function isAIModelId(value: string): value is AIModelId {
  return value in AI_MODEL_CATALOG;
}
