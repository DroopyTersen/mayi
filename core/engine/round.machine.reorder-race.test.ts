/**
 * Tests for out-of-turn hand reordering race conditions
 *
 * These tests verify that when a non-current player reorders their hand,
 * the new order persists even when the current player takes actions.
 *
 * Bug scenario:
 * 1. Player 2 reorders hand while Player 1 is taking their turn
 * 2. Reorder succeeds, UI shows new order
 * 3. Player 1 takes an action (draw, lay down, discard)
 * 4. Player 2's hand "blips" back to old order
 *
 * Root cause hypothesis: Current player's action uses a stale snapshot
 * that doesn't include the non-current player's reorder.
 */

import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("Out-of-turn reorder race conditions", () => {
  it("non-current player's reorder persists after current player draws from stock", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Player1", "Player2", "Player3"],
    });

    const initial = engine.getSnapshot();
    const currentPlayerId = initial.awaitingPlayerId;
    expect(initial.turnPhase).toBe("AWAITING_DRAW");

    // Find a non-current player
    const nonCurrentPlayer = initial.players.find((p) => p.id !== currentPlayerId)!;
    const originalOrder = nonCurrentPlayer.hand.map((c) => c.id);
    const newOrder = [...originalOrder].reverse();

    // Non-current player reorders their hand
    engine.reorderHand(nonCurrentPlayer.id, newOrder);

    // Verify reorder worked
    const afterReorder = engine.getSnapshot();
    const playerAfterReorder = afterReorder.players.find((p) => p.id === nonCurrentPlayer.id)!;
    expect(playerAfterReorder.hand.map((c) => c.id)).toEqual(newOrder);

    // Current player draws from stock
    engine.drawFromStock(currentPlayerId);

    // CRITICAL: Non-current player's hand should STILL be in new order
    const afterDraw = engine.getSnapshot();
    const playerAfterDraw = afterDraw.players.find((p) => p.id === nonCurrentPlayer.id)!;
    expect(playerAfterDraw.hand.map((c) => c.id)).toEqual(newOrder);
  });

  it("non-current player's reorder persists after current player skips", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Player1", "Player2", "Player3"],
    });

    const initial = engine.getSnapshot();
    const currentPlayerId = initial.awaitingPlayerId;

    // Current player draws first
    engine.drawFromStock(currentPlayerId);

    const afterDraw = engine.getSnapshot();
    expect(afterDraw.turnPhase).toBe("AWAITING_ACTION");

    // Non-current player reorders their hand
    const nonCurrentPlayer = afterDraw.players.find((p) => p.id !== currentPlayerId)!;
    const originalOrder = nonCurrentPlayer.hand.map((c) => c.id);
    const newOrder = [...originalOrder].reverse();

    engine.reorderHand(nonCurrentPlayer.id, newOrder);

    // Verify reorder worked
    const afterReorder = engine.getSnapshot();
    const playerAfterReorder = afterReorder.players.find((p) => p.id === nonCurrentPlayer.id)!;
    expect(playerAfterReorder.hand.map((c) => c.id)).toEqual(newOrder);

    // Current player skips to discard phase
    engine.skip(currentPlayerId);

    // CRITICAL: Non-current player's hand should STILL be in new order
    const afterSkip = engine.getSnapshot();
    expect(afterSkip.turnPhase).toBe("AWAITING_DISCARD");
    const playerAfterSkip = afterSkip.players.find((p) => p.id === nonCurrentPlayer.id)!;
    expect(playerAfterSkip.hand.map((c) => c.id)).toEqual(newOrder);
  });

  it("non-current player's reorder persists after current player discards", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Player1", "Player2", "Player3"],
    });

    const initial = engine.getSnapshot();
    const currentPlayerId = initial.awaitingPlayerId;

    // Current player draws and skips to discard phase
    engine.drawFromStock(currentPlayerId);
    engine.skip(currentPlayerId);

    const beforeDiscard = engine.getSnapshot();
    expect(beforeDiscard.turnPhase).toBe("AWAITING_DISCARD");

    // Non-current player reorders their hand
    const nonCurrentPlayer = beforeDiscard.players.find((p) => p.id !== currentPlayerId)!;
    const originalOrder = nonCurrentPlayer.hand.map((c) => c.id);
    const newOrder = [...originalOrder].reverse();

    engine.reorderHand(nonCurrentPlayer.id, newOrder);

    // Verify reorder worked
    const afterReorder = engine.getSnapshot();
    const playerAfterReorder = afterReorder.players.find((p) => p.id === nonCurrentPlayer.id)!;
    expect(playerAfterReorder.hand.map((c) => c.id)).toEqual(newOrder);

    // Current player discards (ends their turn)
    const currentPlayer = beforeDiscard.players.find((p) => p.id === currentPlayerId)!;
    const cardToDiscard = currentPlayer.hand[0]!.id;
    engine.discard(currentPlayerId, cardToDiscard);

    // CRITICAL: Non-current player's hand should STILL be in new order
    const afterDiscard = engine.getSnapshot();
    const playerAfterDiscard = afterDiscard.players.find((p) => p.id === nonCurrentPlayer.id)!;
    expect(playerAfterDiscard.hand.map((c) => c.id)).toEqual(newOrder);
  });

  it("non-current player's reorder persists through entire turn cycle", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Player1", "Player2", "Player3"],
    });

    const initial = engine.getSnapshot();
    const player1Id = initial.awaitingPlayerId;

    // Find Player 2 (will reorder out of turn)
    const player2 = initial.players.find((p) => p.id !== player1Id)!;
    const originalOrder = player2.hand.map((c) => c.id);
    const newOrder = [...originalOrder].reverse();

    // Player 2 reorders during Player 1's turn
    engine.reorderHand(player2.id, newOrder);

    // Player 1 completes their turn: draw -> skip -> discard
    engine.drawFromStock(player1Id);

    // Check after draw
    let snapshot = engine.getSnapshot();
    let player2Snapshot = snapshot.players.find((p) => p.id === player2.id)!;
    expect(player2Snapshot.hand.map((c) => c.id)).toEqual(newOrder);

    engine.skip(player1Id);

    // Check after skip
    snapshot = engine.getSnapshot();
    player2Snapshot = snapshot.players.find((p) => p.id === player2.id)!;
    expect(player2Snapshot.hand.map((c) => c.id)).toEqual(newOrder);

    const player1 = snapshot.players.find((p) => p.id === player1Id)!;
    engine.discard(player1Id, player1.hand[0]!.id);

    // Check after discard (turn changes)
    snapshot = engine.getSnapshot();
    player2Snapshot = snapshot.players.find((p) => p.id === player2.id)!;
    expect(player2Snapshot.hand.map((c) => c.id)).toEqual(newOrder);

    // Verify turn moved to next player
    expect(snapshot.awaitingPlayerId).not.toBe(player1Id);
  });

  it("multiple non-current players can reorder simultaneously", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Player1", "Player2", "Player3"],
    });

    const initial = engine.getSnapshot();
    const currentPlayerId = initial.awaitingPlayerId;

    // Find both non-current players
    const nonCurrentPlayers = initial.players.filter((p) => p.id !== currentPlayerId);
    expect(nonCurrentPlayers.length).toBe(2);

    const player2 = nonCurrentPlayers[0]!;
    const player3 = nonCurrentPlayers[1]!;

    const player2OriginalOrder = player2.hand.map((c) => c.id);
    const player2NewOrder = [...player2OriginalOrder].reverse();

    const player3OriginalOrder = player3.hand.map((c) => c.id);
    const player3NewOrder = [...player3OriginalOrder].reverse();

    // Both non-current players reorder
    engine.reorderHand(player2.id, player2NewOrder);
    engine.reorderHand(player3.id, player3NewOrder);

    // Verify both reorders worked
    let snapshot = engine.getSnapshot();
    expect(snapshot.players.find((p) => p.id === player2.id)!.hand.map((c) => c.id)).toEqual(player2NewOrder);
    expect(snapshot.players.find((p) => p.id === player3.id)!.hand.map((c) => c.id)).toEqual(player3NewOrder);

    // Current player takes actions
    engine.drawFromStock(currentPlayerId);
    engine.skip(currentPlayerId);

    snapshot = engine.getSnapshot();
    const currentPlayer = snapshot.players.find((p) => p.id === currentPlayerId)!;
    engine.discard(currentPlayerId, currentPlayer.hand[0]!.id);

    // CRITICAL: Both reorders should persist
    snapshot = engine.getSnapshot();
    expect(snapshot.players.find((p) => p.id === player2.id)!.hand.map((c) => c.id)).toEqual(player2NewOrder);
    expect(snapshot.players.find((p) => p.id === player3.id)!.hand.map((c) => c.id)).toEqual(player3NewOrder);
  });
});
