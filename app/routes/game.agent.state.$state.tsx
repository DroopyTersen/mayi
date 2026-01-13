/**
 * Agent Testing State Injection Route
 *
 * GET /game/agent/state/:state
 *
 * Creates a new room with the specified state for agent testing.
 * The :state parameter is a base64url-encoded AgentTestState JSON.
 *
 * Example:
 *   /game/agent/state/eyJwbGF5ZXJzIjpbLi4uXX0
 *
 * Redirects to /game/:roomId with the agentState query parameter.
 */

import { redirect } from "react-router";
import { nanoid } from "nanoid";
import type { Route } from "./+types/game.agent.state.$state";
import { decodeAndParseAgentTestState, encodeAgentTestState } from "~/party/agent-state.validation";

export function loader({ params }: Route.LoaderArgs) {
  const encodedState = params.state;

  if (!encodedState) {
    throw new Response("Missing state parameter", { status: 400 });
  }

  // Validate the state can be decoded (don't store invalid state)
  const result = decodeAndParseAgentTestState(encodedState);
  if (!result.success) {
    throw new Response(`Invalid state: ${result.error}`, { status: 400 });
  }

  const roomId = nanoid(8);

  // Re-encode to ensure clean URL encoding
  const cleanEncoded = encodeAgentTestState(result.data);

  // Redirect to the game with the state parameter
  return redirect(`/game/${roomId}?agentState=${cleanEncoded}`);
}
