import { buildMayINotebookGuidance } from "./mayIAgent.notebook-guidance";
import { buildSystemPrompt } from "./mayIAgent.prompt";
import { MAYI_PLAYER_GUIDANCE_VERSION } from "./mayIAgent.player-guidance";

// Preserve the evaluated wrapper and version so the promoted prompt is byte-identical.
// This remains player guidance; the authoritative rules and tactical hints are unchanged.
const experimentId = "player-examples-v1";
const systemPrompt = buildSystemPrompt()
  .replace(
    `<player_guidance version="${MAYI_PLAYER_GUIDANCE_VERSION}">`,
    `<player_guidance version="${MAYI_PLAYER_GUIDANCE_VERSION}+${experimentId}">`,
  )
  .replace(
    "</player_guidance>",
    () => `\n<evaluation_strategy_experiment id="${experimentId}">\n${buildMayINotebookGuidance(true).trim()}\n</evaluation_strategy_experiment>\n</player_guidance>`,
  );

export const MAYI_PLAYER_PROFILE = Object.freeze({
  id: "notebook-examples-v1",
  scratchpad: "per-hand",
  systemPrompt,
} as const);
