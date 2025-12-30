/**
 * AI player names for May I? games
 * Named after AI models for fun
 */

/** AI opponent names (up to 7 needed for interactive, 8 for harness) */
export const AI_PLAYER_NAMES = [
  "Haiku",
  "GPT-5 Mini",
  "Gemini Flash",
  "Grok",
  "Llama",
  "Mistral",
  "DeepSeek",
  "Qwen",
] as const;

/**
 * Generate player names for a game
 * @param count Number of players (3-8)
 * @param includeHuman If true, first player is "You" (for interactive mode)
 */
export function generatePlayerNames(count: number, includeHuman: boolean): string[] {
  if (count < 3 || count > 8) {
    throw new Error("Player count must be between 3 and 8");
  }

  const aiCount = includeHuman ? count - 1 : count;
  const aiNames = AI_PLAYER_NAMES.slice(0, aiCount);

  return includeHuman ? ["You", ...aiNames] : [...aiNames];
}
