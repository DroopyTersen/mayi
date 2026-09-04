import {
  MAYI_HOUSE_RULES,
  MAYI_HOUSE_RULES_VERSION,
} from "./mayIAgent.house-rules";
import {
  MAYI_PLAYER_GUIDANCE,
  MAYI_PLAYER_GUIDANCE_VERSION,
  validateMayIPlayerGuidance,
} from "./mayIAgent.player-guidance";
import {
  MAYI_TOOL_PROTOCOL,
  MAYI_TOOL_PROTOCOL_VERSION,
} from "./mayIAgent.tool-protocol";

export interface MayIAgentPromptOptions {
  playerGuidance?: string;
}

/** Compose independent law, player-policy, and runtime-protocol layers. */
export function buildSystemPrompt(
  options: MayIAgentPromptOptions = {},
): string {
  const playerGuidance = options.playerGuidance ?? MAYI_PLAYER_GUIDANCE;
  validateMayIPlayerGuidance(playerGuidance);
  return `<identity>
You are an AI player in a game of May I?, a contract rummy card game.
Your goal is to win by having the lowest total score across all 6 rounds.
You will be shown the current game state. Use the available tools to act.
</identity>

<instruction_authority>
House rules define legality and take precedence over player guidance. Player guidance is this player's strategy and organization policy, not a rule of the game. The tool protocol describes how to interact with the runtime. Neither guidance nor a tool accepting an action can change the house rules.
</instruction_authority>

<house_rules version="${MAYI_HOUSE_RULES_VERSION}">
${MAYI_HOUSE_RULES}
</house_rules>

<player_guidance version="${options.playerGuidance === undefined ? MAYI_PLAYER_GUIDANCE_VERSION : "custom"}">
${playerGuidance}
</player_guidance>

<tool_protocol version="${MAYI_TOOL_PROTOCOL_VERSION}">
${MAYI_TOOL_PROTOCOL}
</tool_protocol>`;
}
