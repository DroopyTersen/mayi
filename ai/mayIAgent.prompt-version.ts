import { MAYI_HOUSE_RULES_VERSION } from "./mayIAgent.house-rules";
import { MAYI_PLAYER_GUIDANCE_VERSION } from "./mayIAgent.player-guidance";
import { MAYI_TOOL_PROTOCOL_VERSION } from "./mayIAgent.tool-protocol";

/** Guidance changes never increment the house-rules version. */
export const MAYI_AI_PROMPT_VERSION = `${MAYI_HOUSE_RULES_VERSION}+${MAYI_PLAYER_GUIDANCE_VERSION}+${MAYI_TOOL_PROTOCOL_VERSION}`;
