import { AI_MODEL_CATALOG, type AIModelId } from "../ai-model-catalog";
import {
  createOpenRouterMuseChatSettings,
  type OpenRouterMuseReasoningEffort,
} from "../openrouter-muse-profile";

export type AIPlayerEvalJSONValue =
  | null
  | boolean
  | number
  | string
  | AIPlayerEvalJSONValue[]
  | { [key: string]: AIPlayerEvalJSONValue };

export interface AIPlayerEvalModelConfiguration {
  schemaVersion: 1;
  configuredModelId: string;
  resolvedModelId: string;
  provider: string;
  profile: string;
  transport: "responses" | "chat";
  modelSettings: { [key: string]: AIPlayerEvalJSONValue };
  requestProviderOptions: { [key: string]: AIPlayerEvalJSONValue };
  instructionProviderOptions?: { [key: string]: AIPlayerEvalJSONValue };
  dynamicTurnPolicy: { [key: string]: AIPlayerEvalJSONValue };
}

export interface AIPlayerEvalModelConfigurationSnapshot {
  configuration: AIPlayerEvalModelConfiguration;
  sha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJSONValue(value: unknown, context: string): AIPlayerEvalJSONValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      toJSONValue(entry, `${context}[${index}]`),
    );
  }
  if (isRecord(value)) {
    const result: { [key: string]: AIPlayerEvalJSONValue } = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        result[key] = toJSONValue(entry, `${context}.${key}`);
      }
    }
    return result;
  }
  throw new Error(`${context} is not JSON-serializable`);
}

function requireJSONObject(
  value: unknown,
  context: string,
): { [key: string]: AIPlayerEvalJSONValue } {
  const converted = toJSONValue(value, context);
  if (converted === null || Array.isArray(converted) || typeof converted !== "object") {
    throw new Error(`${context} must be an object`);
  }
  return converted;
}

function canonicalize(value: AIPlayerEvalJSONValue): AIPlayerEvalJSONValue {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalize(value[key] as AIPlayerEvalJSONValue)]),
  );
}

export function fingerprintAIPlayerEvalModelConfiguration(
  configuration: AIPlayerEvalModelConfiguration,
): string {
  const canonical = JSON.stringify(
    canonicalize(toJSONValue(configuration, "model configuration")),
  );
  return new Bun.CryptoHasher("sha256").update(canonical).digest("hex");
}

export function parseAIPlayerEvalModelConfiguration(
  value: unknown,
  context = "model configuration",
): AIPlayerEvalModelConfiguration {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error(`${context}.schemaVersion must be 1`);
  }
  const configuredModelId = value.configuredModelId;
  if (
    typeof configuredModelId !== "string" ||
    configuredModelId.length === 0
  ) {
    throw new Error(`${context}.configuredModelId must be a non-empty string`);
  }
  if (
    typeof value.resolvedModelId !== "string" ||
    typeof value.provider !== "string" ||
    typeof value.profile !== "string" ||
    (value.transport !== "responses" && value.transport !== "chat")
  ) {
    throw new Error(`${context} has invalid provider identity`);
  }
  const instructionProviderOptions =
    value.instructionProviderOptions === undefined
      ? undefined
      : requireJSONObject(
          value.instructionProviderOptions,
          `${context}.instructionProviderOptions`,
        );
  return {
    schemaVersion: 1,
    configuredModelId,
    resolvedModelId: value.resolvedModelId,
    provider: value.provider,
    profile: value.profile,
    transport: value.transport,
    modelSettings: requireJSONObject(
      value.modelSettings,
      `${context}.modelSettings`,
    ),
    requestProviderOptions: requireJSONObject(
      value.requestProviderOptions,
      `${context}.requestProviderOptions`,
    ),
    ...(instructionProviderOptions === undefined
      ? {}
      : { instructionProviderOptions }),
    dynamicTurnPolicy: requireJSONObject(
      value.dynamicTurnPolicy,
      `${context}.dynamicTurnPolicy`,
    ),
  };
}

function isSparkReasoningEffort(
  value: string,
): value is OpenRouterMuseReasoningEffort {
  return ["minimal", "low", "medium", "high", "xhigh"].includes(value);
}

export function createAIPlayerEvalModelConfigurationSnapshot(
  configuredModelId: AIModelId,
  reasoningEffort: string,
  options: { retainReasoning?: boolean } = {},
): AIPlayerEvalModelConfigurationSnapshot {
  const definition = AI_MODEL_CATALOG[configuredModelId];
  let configuration: AIPlayerEvalModelConfiguration;

  if (configuredModelId === "default:openai") {
    if (reasoningEffort !== "xhigh") {
      throw new Error(
        "Luna evaluation configuration requires xhigh reasoning effort",
      );
    }
    const { providerOptions, ...modelSettings } = definition.settings;
    configuration = {
      schemaVersion: 1,
      configuredModelId,
      resolvedModelId: definition.model,
      provider: definition.provider,
      profile: "standard",
      transport: "responses",
      modelSettings: requireJSONObject(
        modelSettings,
        "Luna model settings",
      ),
      requestProviderOptions: requireJSONObject(providerOptions, "Luna request provider options"),
      dynamicTurnPolicy: {
        allowedTools: "current available tool names",
      },
    };
  } else if (configuredModelId === "default:meta") {
    if (!isSparkReasoningEffort(reasoningEffort)) {
      throw new Error(`Unsupported Spark reasoning effort: ${reasoningEffort}`);
    }
    configuration = {
      schemaVersion: 1,
      configuredModelId,
      resolvedModelId: definition.model,
      provider: definition.provider,
      profile: "standard",
      transport: "chat",
      modelSettings: requireJSONObject(
        definition.settings,
        "Spark model settings",
      ),
      requestProviderOptions: {
        openrouter: requireJSONObject(
          createOpenRouterMuseChatSettings(reasoningEffort, options),
          "Spark request provider options",
        ),
      },
      dynamicTurnPolicy: {
        allowedTools: "current available tool names",
      },
    };
  } else {
    throw new Error(
      `Model ${configuredModelId} is not an AI player evaluation candidate`,
    );
  }

  return {
    configuration,
    sha256: fingerprintAIPlayerEvalModelConfiguration(configuration),
  };
}
