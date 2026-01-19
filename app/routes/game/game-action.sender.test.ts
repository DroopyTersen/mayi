import { describe, expect, it } from "bun:test";
import type { ConnectionStatus } from "~/ui/lobby/lobby.types";
import type { ClientMessage, GameAction } from "~/party/protocol.types";
import { sendGameActionIfConnected } from "./game-action.sender";

function createSendCapture() {
  const sent: ClientMessage[] = [];
  const sendMessage = (message: ClientMessage) => {
    sent.push(message);
  };
  return { sent, sendMessage };
}

describe("sendGameActionIfConnected", () => {
  it("sends when connected", () => {
    const { sent, sendMessage } = createSendCapture();
    const action: GameAction = { type: "ALLOW_MAY_I" };

    const result = sendGameActionIfConnected({
      connectionStatus: "connected",
      sendMessage,
      action,
    });

    expect(result).toEqual({ sent: true, error: null });
    expect(sent).toEqual([{ type: "GAME_ACTION", action }]);
  });

  it("does not send when disconnected", () => {
    const { sent, sendMessage } = createSendCapture();
    const action: GameAction = { type: "CLAIM_MAY_I" };
    const status: ConnectionStatus = "disconnected";

    const result = sendGameActionIfConnected({
      connectionStatus: status,
      sendMessage,
      action,
    });

    expect(result).toEqual({ sent: false, error: "CONNECTION_NOT_READY" });
    expect(sent).toEqual([]);
  });
});
