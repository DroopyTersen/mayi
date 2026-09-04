import { afterEach, describe, expect, it } from "bun:test";
import { GameEngine } from "../../core/engine/game-engine";
import { AI_PLAYER_GAME_ENGINE_RUNTIME_VERSION, createAIPlayerGameEngineRuntime } from "./ai-player-game-engine-runtime";

describe("AI player in-memory game runtime", () => {
  const engines: GameEngine[] = [];

  afterEach(() => {
    for (const engine of engines) engine.stop();
    engines.length = 0;
  });

  it("versions accepted-action recovery separately from the old runtime", () => {
    expect(AI_PLAYER_GAME_ENGINE_RUNTIME_VERSION).toBe("game-engine-runtime-v2");
  });

  it("accepts an unchanged valid organization after an error without accepting invalid permutations", async () => {
    const engine = GameEngine.createGame({ playerNames: ["A", "B", "C"], seed: "runtime-organize" });
    engines.push(engine);
    const playerId = engine.getSnapshot().awaitingPlayerId;
    const { runtime, attempts } = createAIPlayerGameEngineRuntime(engine, playerId);
    expect((await runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
    expect((await runtime.executeAction({ type: "LAY_DOWN", melds: [{ type: "set", cardIds: ["missing-1", "missing-2", "missing-3"] }] })).ok).toBe(false);
    expect(engine.getSnapshot().lastError).toBeTruthy();
    const cardIds = engine.getSnapshot().players.find(player => player.id === playerId)!.hand.map(card => card.id);
    expect((await runtime.executeAction({ type: "REORDER_HAND", cardIds })).ok).toBe(true);
    expect((await runtime.executeAction({ type: "REORDER_HAND", cardIds: [...cardIds].reverse() })).ok).toBe(true);
    expect((await runtime.executeAction({ type: "REORDER_HAND", cardIds: cardIds.slice(1) })).ok).toBe(false);
    expect((await runtime.executeAction({ type: "REORDER_HAND", cardIds: cardIds.map(() => cardIds[0]!) })).ok).toBe(false);
    expect((await runtime.executeAction({ type: "REORDER_HAND", cardIds: [...cardIds.slice(1), "missing"] })).ok).toBe(false);
    expect(attempts.map(attempt => attempt.ok)).toEqual([true, false, true, true, false, false, false]);
  });

  it("executes a complete legal turn against the production game engine", async () => {
    const engine = GameEngine.createGame({
      playerNames: ["A", "B", "C"],
      seed: "runtime-test",
    });
    engines.push(engine);
    const playerId = engine.getSnapshot().awaitingPlayerId;
    const state = createAIPlayerGameEngineRuntime(engine, playerId);

    expect((await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(
      true,
    );
    expect((await state.runtime.executeAction({ type: "SKIP" })).ok).toBe(true);
    const afterDraw = engine.getSnapshot();
    const player = afterDraw.players.find((candidate) => candidate.id === playerId);
    const discardCardId = player?.hand[0]?.id;
    expect(discardCardId).toBeDefined();
    if (discardCardId === undefined) return;
    expect(
      (await state.runtime.executeAction({ type: "DISCARD", cardId: discardCardId }))
        .ok,
    ).toBe(true);

    expect(engine.getSnapshot().awaitingPlayerId).not.toBe(playerId);
    expect(state.attempts.every((attempt) => attempt.ok)).toBe(true);
  });

  it("records rejected actions without pretending the state changed", async () => {
    const engine = GameEngine.createGame({
      playerNames: ["A", "B", "C"],
      seed: "runtime-test",
    });
    engines.push(engine);
    const playerId = engine.getSnapshot().awaitingPlayerId;
    const state = createAIPlayerGameEngineRuntime(engine, playerId);

    const result = await state.runtime.executeAction({
      type: "DISCARD",
      cardId: "card-not-in-hand",
    });

    expect(result.ok).toBe(false);
    expect(state.attempts).toEqual([
      expect.objectContaining({
        action: { type: "DISCARD", cardId: "card-not-in-hand" },
        ok: false,
      }),
    ]);
  });

  it("applies the production command policy before invoking the engine", async () => {
    const engine = GameEngine.createGame({
      playerNames: ["A", "B", "C"],
      seed: "runtime-command-policy-test",
    });
    engines.push(engine);
    const currentPlayerId = engine.getSnapshot().awaitingPlayerId;
    const state = createAIPlayerGameEngineRuntime(engine, currentPlayerId);

    const result = await state.runtime.executeAction({ type: "CALL_MAY_I" });

    expect(result).toMatchObject({
      ok: false,
      error: "CANNOT_CALL_MAY_I_ON_OWN_TURN",
    });
    expect(engine.getSnapshot().phase).toBe("ROUND_ACTIVE");
    expect(state.attempts).toEqual([
      {
        playerId: currentPlayerId,
        action: { type: "CALL_MAY_I" },
        ok: false,
        error: "CANNOT_CALL_MAY_I_ON_OWN_TURN",
      },
    ]);
  });
});
