/**
 * Agent Testing Quick Start Route
 *
 * GET /game/agent/new
 *
 * Creates a new room with a default 3-player state for agent testing:
 * - Player 0: Human "Agent" (the AI agent being tested)
 * - Player 1: AI "Grok-1"
 * - Player 2: AI "Grok-2"
 *
 * Redirects to /game/:roomId with a base64-encoded state URL parameter.
 */

import { redirect } from "react-router";
import { nanoid } from "nanoid";
import type { Route } from "./+types/game.agent.new";
import { encodeAgentTestState } from "~/party/agent-state.validation";
import type { AgentTestState } from "~/party/agent-state.types";
import { createDefaultTestDeck } from "~/party/agent-state.deck";

export function loader({}: Route.LoaderArgs) {
  if (import.meta.env.MODE === "production") {
    throw new Response("Not Found", { status: 404 });
  }

  const roomId = nanoid(8);
  const state = createDefaultAgentTestState();
  const encodedState = encodeAgentTestState(state);

  // Redirect to the game with the state parameter
  return redirect(`/game/${roomId}?agentState=${encodedState}`);
}

/**
 * Create a default test state for agent testing
 */
function createDefaultAgentTestState(): AgentTestState {
  const deck = createDefaultTestDeck();

  // Deal 11 cards to each of 3 players
  const hand0 = deck.splice(0, 11);
  const hand1 = deck.splice(0, 11);
  const hand2 = deck.splice(0, 11);

  // First card goes to discard
  const discardCard = deck.splice(0, 1);

  // Rest is stock
  const stock = deck;

  return {
    players: [
      {
        id: "agent-player",
        name: "Agent",
        isAI: false,
        hand: hand0,
        isDown: false,
      },
      {
        id: "ai-grok-1",
        name: "Grok-1",
        isAI: true,
        aiModelId: "default:grok",
        hand: hand1,
        isDown: false,
      },
      {
        id: "ai-grok-2",
        name: "Grok-2",
        isAI: true,
        aiModelId: "default:grok",
        hand: hand2,
        isDown: false,
      },
    ],
    roundNumber: 1,
    stock,
    discard: discardCard,
    table: [],
    turn: {
      currentPlayerIndex: 0,
      hasDrawn: false,
      phase: "awaitingDraw",
    },
  };
}
