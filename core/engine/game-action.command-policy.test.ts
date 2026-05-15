import { describe, expect, it } from "bun:test";
import { GameEngine } from "./game-engine";
import { getActionAvailabilityDetails } from "./game-engine.availability";
import { validateGameActionCommand } from "./game-action.command-policy";

describe("validateGameActionCommand", () => {
  it("accepts actions that availability exposes as executable", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const drawSnapshot = engine.getSnapshot();
    const currentPlayer = drawSnapshot.players[drawSnapshot.currentPlayerIndex]!;

    expect(
      getActionAvailabilityDetails(drawSnapshot, currentPlayer.id)
        .availableActions.canDrawFromStock
    ).toBe(true);
    expect(
      validateGameActionCommand(drawSnapshot, currentPlayer.id, {
        type: "DRAW_FROM_STOCK",
      })
    ).toEqual({ ok: true });

    const actionSnapshot = engine.drawFromStock(currentPlayer.id);
    const cardToDiscard = actionSnapshot.players.find(
      (player) => player.id === currentPlayer.id
    )!.hand[0]!;

    expect(
      getActionAvailabilityDetails(actionSnapshot, currentPlayer.id)
        .availableActions.canDiscard
    ).toBe(true);
    expect(
      validateGameActionCommand(actionSnapshot, currentPlayer.id, {
        type: "DISCARD",
        cardId: cardToDiscard.id,
      })
    ).toEqual({ ok: true });
  });

  it("accepts May-I response actions only for the prompted player", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const snapshot = engine.getSnapshot();
    const caller = snapshot.players.find(
      (_player, index) => index !== snapshot.currentPlayerIndex
    )!;
    const resolving = engine.callMayI(caller.id);
    const prompted = resolving.awaitingPlayerId;

    expect(
      getActionAvailabilityDetails(resolving, prompted).availableActions
        .canAllowMayI
    ).toBe(true);
    expect(
      validateGameActionCommand(resolving, prompted, { type: "ALLOW_MAY_I" })
    ).toEqual({ ok: true });
    expect(
      validateGameActionCommand(resolving, caller.id, { type: "ALLOW_MAY_I" })
    ).toEqual({ ok: false, error: "NOT_MAY_I_RESPONDER" });
  });

  it("rejects unavailable phase and malformed payloads with explicit errors", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const snapshot = engine.getSnapshot();
    const currentPlayer = snapshot.players[snapshot.currentPlayerIndex]!;
    const otherPlayer = snapshot.players.find(
      (player) => player.id !== currentPlayer.id
    )!;

    expect(
      validateGameActionCommand(snapshot, otherPlayer.id, {
        type: "DRAW_FROM_STOCK",
      })
    ).toEqual({ ok: false, error: "NOT_YOUR_TURN" });
    expect(
      validateGameActionCommand(snapshot, currentPlayer.id, {
        type: "DISCARD",
        cardId: "not-yet-discardable",
      })
    ).toEqual({ ok: false, error: "INVALID_PHASE" });
    expect(
      validateGameActionCommand(snapshot, currentPlayer.id, {
        type: "REORDER_HAND",
        cardIds: [],
      })
    ).toEqual({ ok: false, error: "MISSING_CARD_IDS" });
  });
});
