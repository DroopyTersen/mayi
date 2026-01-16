import { describe, it, expect } from "bun:test";

import {
  parseClientMessage,
  isLobbyPhaseMessage,
  isGamePhaseMessage,
  serializeServerMessage,
} from "./protocol.types";
import type { ClientMessage, ServerMessage } from "./protocol.types";

describe("protocol.types", () => {
  describe("parseClientMessage", () => {
    it("accepts a valid JOIN message", () => {
      const raw = {
        type: "JOIN",
        playerId: "player-1",
        playerName: "Alice",
      };

      const result = parseClientMessage(raw);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("JOIN");
        expect(result.data.playerId).toBe("player-1");
      }
    });

    it("rejects an invalid message payload", () => {
      const result = parseClientMessage({ type: "JOIN", playerId: "" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.length).toBeGreaterThan(0);
      }
    });
  });

  describe("type guards", () => {
    it("identifies lobby phase messages", () => {
      const join: ClientMessage = {
        type: "JOIN",
        playerId: "player-1",
        playerName: "Alice",
      };

      expect(isLobbyPhaseMessage(join)).toBe(true);
      expect(isGamePhaseMessage(join)).toBe(false);
    });

    it("identifies game phase messages", () => {
      const action: ClientMessage = {
        type: "GAME_ACTION",
        action: { type: "DRAW_FROM_STOCK" },
      };

      expect(isGamePhaseMessage(action)).toBe(true);
      expect(isLobbyPhaseMessage(action)).toBe(false);
    });
  });

  describe("serializeServerMessage", () => {
    it("serializes server messages to JSON", () => {
      const message: ServerMessage = { type: "PONG" };
      const serialized = serializeServerMessage(message);

      expect(serialized).toBe(JSON.stringify(message));
    });
  });
});
