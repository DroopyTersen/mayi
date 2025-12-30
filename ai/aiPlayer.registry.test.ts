/**
 * Tests for AI Player Registry
 *
 * These are fast unit tests that don't require LLM calls.
 */

import { describe, it, expect } from "bun:test";
import { AIPlayerRegistry, setupGameWithAI, setupAllAIGame } from "./aiPlayer.registry";

describe("AIPlayerRegistry", () => {
  it("should register and lookup AI players", () => {
    const registry = new AIPlayerRegistry();

    registry.register("player-1", { name: "GPT 5 Mini", modelId: "openai:gpt-5-mini" });
    registry.register("player-2", { name: "Haiku", modelId: "anthropic:claude-haiku-4-5" });

    expect(registry.isAI("player-0")).toBe(false);
    expect(registry.isAI("player-1")).toBe(true);
    expect(registry.isAI("player-2")).toBe(true);

    expect(registry.getModelId("player-1")).toBe("openai:gpt-5-mini");
    expect(registry.getModelId("player-2")).toBe("anthropic:claude-haiku-4-5");
    expect(registry.getModelId("player-0")).toBeUndefined();

    expect(registry.getAIPlayerIds()).toEqual(["player-1", "player-2"]);
  });

  it("should get player names", () => {
    const registry = new AIPlayerRegistry();
    registry.register("player-1", { name: "GPT 5 Mini", modelId: "openai:gpt-5-mini" });

    expect(registry.getName("player-1")).toBe("GPT 5 Mini");
    expect(registry.getName("player-0")).toBeUndefined();
  });

  it("should clear registrations", () => {
    const registry = new AIPlayerRegistry();
    registry.register("player-1", { name: "GPT 5 Mini", modelId: "openai:gpt-5-mini" });

    expect(registry.isAI("player-1")).toBe(true);

    registry.clear();

    expect(registry.isAI("player-1")).toBe(false);
    expect(registry.getAIPlayerIds()).toEqual([]);
  });

  it("should get all entries", () => {
    const registry = new AIPlayerRegistry();
    registry.register("player-1", { name: "GPT 5 Mini", modelId: "openai:gpt-5-mini" });
    registry.register("player-2", { name: "Haiku", modelId: "anthropic:claude-haiku-4-5" });

    const entries = registry.getAll();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      playerId: "player-1",
      name: "GPT 5 Mini",
      modelId: "openai:gpt-5-mini",
    });
  });

  it("should get model instances from registry", () => {
    const registry = new AIPlayerRegistry();
    registry.register("player-1", { name: "GPT 5 Mini", modelId: "openai:gpt-5-mini" });

    const model = registry.getModel("player-1");
    expect(model).toBeDefined();

    const noModel = registry.getModel("player-0");
    expect(noModel).toBeUndefined();
  });
});

describe("setupGameWithAI", () => {
  it("should setup game with human and AI players", () => {
    const registry = new AIPlayerRegistry();

    const playerNames = setupGameWithAI(
      {
        humanName: "Drew",
        aiPlayers: [
          { name: "GPT 5 Mini", modelId: "openai:gpt-5-mini" },
          { name: "Haiku", modelId: "anthropic:claude-haiku-4-5" },
          { name: "Gemini", modelId: "gemini:gemini-3-flash-preview" },
        ],
      },
      registry
    );

    expect(playerNames).toEqual(["Drew", "GPT 5 Mini", "Haiku", "Gemini"]);
    expect(registry.isAI("player-0")).toBe(false); // Human
    expect(registry.isAI("player-1")).toBe(true);
    expect(registry.isAI("player-2")).toBe(true);
    expect(registry.isAI("player-3")).toBe(true);
  });
});

describe("setupAllAIGame", () => {
  it("should setup all-AI game", () => {
    const registry = new AIPlayerRegistry();

    const playerNames = setupAllAIGame(
      [
        { name: "GPT 5 Mini", modelId: "openai:gpt-5-mini" },
        { name: "Haiku", modelId: "anthropic:claude-haiku-4-5" },
        { name: "Gemini", modelId: "gemini:gemini-3-flash-preview" },
      ],
      registry
    );

    expect(playerNames).toEqual(["GPT 5 Mini", "Haiku", "Gemini"]);
    expect(registry.isAI("player-0")).toBe(true);
    expect(registry.isAI("player-1")).toBe(true);
    expect(registry.isAI("player-2")).toBe(true);
  });

  it("should throw for fewer than 3 players", () => {
    const registry = new AIPlayerRegistry();

    expect(() =>
      setupAllAIGame(
        [
          { name: "GPT 5 Mini", modelId: "openai:gpt-5-mini" },
          { name: "Haiku", modelId: "anthropic:claude-haiku-4-5" },
        ],
        registry
      )
    ).toThrow("May I requires at least 3 players");
  });
});
