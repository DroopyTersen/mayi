import { z } from "zod";
import { agentTestStateSchema } from "./agent-state.validation";
import { AI_MODEL_IDS } from "./ai-models";

const humanSchema = z.object({
  playerId: z.string().min(1).max(64),
  name: z.string().min(1).max(24),
});

const playerMappingSchema = z.object({
  lobbyId: z.string().min(1).max(64),
  engineId: z.string().regex(/^player-\d+$/),
  name: z.string().min(1).max(24),
  isAI: z.boolean(),
  aiModelId: z.enum(AI_MODEL_IDS).optional(),
});

export const agentStoredStateV1Schema = z.object({
  version: z.literal(1),
  engineSnapshot: z.string().min(1),
  playerMappings: z.array(playerMappingSchema).min(3).max(8),
});

export type AgentStoredStateV1 = z.infer<typeof agentStoredStateV1Schema>;

export const agentSetupMessageSchema = z.discriminatedUnion("mode", [
  z.object({
    type: z.literal("AGENT_SETUP"),
    requestId: z.string().min(1),
    mode: z.literal("quickStart"),
    human: humanSchema,
    ai: z.object({
      modelId: z.literal("default:grok"),
      count: z.literal(2),
      namePrefix: z.string().optional(),
    }),
    startingRound: z.number().int().min(1).max(6).optional(),
  }),
  z.object({
    type: z.literal("AGENT_SETUP"),
    requestId: z.string().min(1),
    mode: z.literal("injectStoredState"),
    human: humanSchema,
    storedState: agentStoredStateV1Schema,
  }),
  z.object({
    type: z.literal("AGENT_SETUP"),
    requestId: z.string().min(1),
    mode: z.literal("injectAgentTestState"),
    human: humanSchema,
    agentTestState: agentTestStateSchema,
  }),
]);

export type AgentSetupMessage = z.infer<typeof agentSetupMessageSchema>;

export const agentSetupResultMessageSchema = z.object({
  type: z.literal("AGENT_SETUP_RESULT"),
  requestId: z.string().min(1),
  status: z.enum(["ok", "already_setup", "error"]),
  message: z.string().optional(),
});

export type AgentSetupResultMessage = z.infer<
  typeof agentSetupResultMessageSchema
>;

