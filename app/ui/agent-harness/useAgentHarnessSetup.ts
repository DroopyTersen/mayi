import { useCallback, useMemo } from "react";
import type { ClientMessage } from "~/party/protocol.types";
import { decodeAndParseAgentTestState } from "~/party/agent-state.validation";
import { decodeBase64UrlToUtf8 } from "core/utils/base64url";
import {
  agentStoredStateV1Schema,
  type AgentStoredStateV1,
} from "~/party/agent-harness.types";

type AgentHarnessIdentity = { playerId: string; name: string };

type AgentHarnessMode = "none" | "quickStart" | "injectAgentTestState" | "injectStoredState";

export function useAgentHarnessSetup(options: {
  roomId: string;
  agentQuickStart: boolean;
  agentStateEncoded: string | null;
}) {
  const enabled = import.meta.env.MODE !== "production";

  const parsed = useMemo(() => {
    if (!enabled) {
      return { mode: "none" as const };
    }

    if (options.agentQuickStart) {
      return {
        mode: "quickStart" as const,
        identity: { playerId: null as string | null, name: "Agent" },
      };
    }

    const encoded = options.agentStateEncoded;
    if (!encoded) {
      return { mode: "none" as const };
    }

    // Legacy: agentState contains AgentTestState
    const agentTestState = decodeAndParseAgentTestState(encoded);
    if (agentTestState.success) {
      const human = agentTestState.data.players.find((p) => !p.isAI) ?? null;
      if (!human) {
        return { mode: "error" as const, error: "AgentTestState missing human player" };
      }
      return {
        mode: "injectAgentTestState" as const,
        identity: { playerId: human.id, name: human.name },
        agentTestState: agentTestState.data,
      };
    }

    // New: agentState contains AgentStoredStateV1
    try {
      const json = decodeBase64UrlToUtf8(encoded);
      const raw = JSON.parse(json) as unknown;
      const storedResult = agentStoredStateV1Schema.safeParse(raw);
      if (!storedResult.success) {
        return { mode: "error" as const, error: agentTestState.error };
      }

      const storedState: AgentStoredStateV1 = storedResult.data;
      const humans = storedState.playerMappings.filter((m) => !m.isAI);
      const human = humans[0] ?? null;
      if (!human || humans.length !== 1) {
        return { mode: "error" as const, error: "StoredState must include exactly one human mapping" };
      }

      return {
        mode: "injectStoredState" as const,
        identity: { playerId: human.lobbyId, name: human.name },
        storedState,
      };
    } catch {
      return { mode: "error" as const, error: agentTestState.error };
    }
  }, [enabled, options.agentQuickStart, options.agentStateEncoded]);

  const stripAgentParams = useCallback(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("agentState");
    url.searchParams.delete("agent");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [enabled]);

  const desiredIdentity: AgentHarnessIdentity | null = useMemo(() => {
    if (!enabled) return null;
    if (parsed.mode === "quickStart") {
      // playerId will be filled in by the caller via getOrCreatePlayerId(roomId)
      return { playerId: "", name: parsed.identity.name };
    }
    if (parsed.mode === "injectAgentTestState") return parsed.identity;
    if (parsed.mode === "injectStoredState") return parsed.identity;
    return null;
  }, [enabled, parsed]);

  const getSetupMessage = useCallback(
    (playerId: string): ClientMessage | null => {
      if (!enabled) return null;
      const requestId = `agent-${options.roomId}`;

      if (parsed.mode === "quickStart") {
        return {
          type: "AGENT_SETUP",
          requestId,
          mode: "quickStart",
          human: { playerId, name: parsed.identity.name },
          ai: { modelId: "default:grok", count: 2, namePrefix: "Grok" },
        } as ClientMessage;
      }

      if (parsed.mode === "injectAgentTestState") {
        return {
          type: "AGENT_SETUP",
          requestId,
          mode: "injectAgentTestState",
          human: parsed.identity,
          agentTestState: parsed.agentTestState,
        } as ClientMessage;
      }

      if (parsed.mode === "injectStoredState") {
        return {
          type: "AGENT_SETUP",
          requestId,
          mode: "injectStoredState",
          human: parsed.identity,
          storedState: parsed.storedState,
        } as ClientMessage;
      }

      return null;
    },
    [enabled, options.roomId, parsed]
  );

  return {
    enabled,
    mode: parsed.mode as AgentHarnessMode | "error",
    error: (parsed as { error?: string }).error ?? null,
    desiredIdentity,
    getSetupMessage,
    stripAgentParams,
  };
}
