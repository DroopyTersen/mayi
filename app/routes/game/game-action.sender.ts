import type { ConnectionStatus } from "~/ui/lobby/lobby.types";
import type { ClientMessage, GameAction } from "~/party/protocol.types";

interface SendGameActionOptions {
  connectionStatus: ConnectionStatus;
  sendMessage: (message: ClientMessage) => void;
  action: GameAction;
}

interface SendGameActionResult {
  sent: boolean;
  error: string | null;
}

export function sendGameActionIfConnected({
  connectionStatus,
  sendMessage,
  action,
}: SendGameActionOptions): SendGameActionResult {
  if (connectionStatus !== "connected") {
    return { sent: false, error: "CONNECTION_NOT_READY" };
  }

  sendMessage({ type: "GAME_ACTION", action });
  return { sent: true, error: null };
}
