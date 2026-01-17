/**
 * Agent Testing Quick Start Route
 *
 * GET /game/agent/new
 *
 * Creates a new room and redirects into "agent quick start" mode where the
 * client auto-joins as "Agent", adds 2 Grok AI players, and starts the game.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/game.agent.new";
import { generateRoomId } from "../../core/room/room-id.utils";

export function loader({}: Route.LoaderArgs) {
  if (import.meta.env.MODE === "production") {
    throw new Response("Not Found", { status: 404 });
  }

  const roomId = generateRoomId();
  return redirect(`/game/${roomId}?agent=true`);
}
