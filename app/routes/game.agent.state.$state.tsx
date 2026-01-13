/**
 * Agent Testing State Injection Route
 *
 * GET /game/agent/state/:state
 *
 * Creates a new room with the specified state for agent testing.
 * The :state parameter is base64url-encoded JSON:
 * - Legacy: AgentTestState
 * - New: AgentStoredStateV1 (engine snapshot + mappings)
 *
 * Example:
 *   /game/agent/state/eyJwbGF5ZXJzIjpbLi4uXX0
 *
 * Redirects to /game/:roomId with the agentState query parameter.
 */

import { redirect } from "react-router";
import { nanoid } from "nanoid";
import type { Route } from "./+types/game.agent.state.$state";
import { agentTestStateSchema, encodeAgentTestState } from "~/party/agent-state.validation";
import { agentStoredStateV1Schema } from "~/party/agent-harness.types";
import { decodeBase64UrlToUtf8, encodeUtf8ToBase64Url } from "core/utils/base64url";

export function loader({ params }: Route.LoaderArgs) {
  if (import.meta.env.MODE === "production") {
    throw new Response("Not Found", { status: 404 });
  }

  const encodedState = params.state;

  if (!encodedState) {
    throw new Response("Missing state parameter", { status: 400 });
  }

  // Validate the payload can be decoded (don't redirect into a broken state).
  let cleanEncoded: string;
  try {
    const json = decodeBase64UrlToUtf8(encodedState);
    const raw = JSON.parse(json) as unknown;

    const agentTest = agentTestStateSchema.safeParse(raw);
    if (agentTest.success) {
      cleanEncoded = encodeAgentTestState(agentTest.data);
    } else {
      const stored = agentStoredStateV1Schema.safeParse(raw);
      if (!stored.success) {
        throw new Error(agentTest.error.issues.map((i) => i.message).join("; "));
      }
      cleanEncoded = encodeUtf8ToBase64Url(JSON.stringify(stored.data));
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid state";
    throw new Response(`Invalid state: ${message}`, { status: 400 });
  }

  const roomId = nanoid(8);

  // Redirect to the game with the state parameter
  return redirect(`/game/${roomId}?agentState=${cleanEncoded}`);
}
