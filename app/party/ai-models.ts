/** Protocol-facing model exports. The AI package owns the catalog so every
 * runtime resolves the same five player choices. */
export {
  AI_MODEL_DISPLAY_NAMES,
  AI_MODEL_IDS,
  AI_MODEL_OPTIONS,
  DEFAULT_AI_MODEL_ID,
  DEFAULT_AI_PLAYER_NAME_PREFIX,
} from "../../ai/ai-model-catalog";
export type { AIModelId } from "../../ai/ai-model-catalog";
