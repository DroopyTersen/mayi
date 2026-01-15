import { describe, expect, it } from "bun:test";

import { isAvatarIdTaken } from "./mayi-room.lobby";
import type { AIPlayerInfo, HumanPlayerInfo } from "./protocol.types";

describe("mayi-room.lobby", () => {
  describe("isAvatarIdTaken", () => {
    const humans: HumanPlayerInfo[] = [
      { playerId: "p1", name: "Alice", avatarId: "ethel", isConnected: true, disconnectedAt: null },
      { playerId: "p2", name: "Bob", avatarId: "curt", isConnected: false, disconnectedAt: 123 },
      { playerId: "p3", name: "NoAvatar", isConnected: true, disconnectedAt: null },
    ];

    const aiPlayers: AIPlayerInfo[] = [
      { playerId: "ai-1", name: "Grok-1", avatarId: "bart", modelId: "default:grok", modelDisplayName: "Grok" },
    ];

    it("returns false for blank avatarId", () => {
      expect(isAvatarIdTaken("   ", { humanPlayers: humans, aiPlayers })).toBe(false);
    });

    it("detects avatars used by humans", () => {
      expect(isAvatarIdTaken("ethel", { humanPlayers: humans, aiPlayers })).toBe(true);
    });

    it("detects avatars used by AI players", () => {
      expect(isAvatarIdTaken("bart", { humanPlayers: humans, aiPlayers })).toBe(true);
    });

    it("excludes the specified human playerId (rejoin with same avatar)", () => {
      expect(
        isAvatarIdTaken("ethel", {
          humanPlayers: humans,
          aiPlayers,
          excludeHumanPlayerId: "p1",
        })
      ).toBe(false);
    });
  });
});

