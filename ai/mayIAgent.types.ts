/**
 * Type definitions for May I? AI Agent
 */

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
  /** Whether the action was successful */
  success: boolean;

  /** Human-readable message about what happened */
  message: string;

  /** The new game state as text for the LLM */
  gameState: string;

  /** Whether the AI's turn is complete (it's now another player's turn or game phase changed) */
  turnComplete: boolean;
}
