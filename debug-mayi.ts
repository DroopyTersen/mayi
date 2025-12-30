import { GameEngine } from "./core/engine/game-engine.ts";

const engine = GameEngine.createGame({ playerNames: ["Alice", "Bob", "Carol"] });
const snap = engine.getSnapshot();
const currentPlayer = snap.awaitingPlayerId;

console.log("Initial state:");
console.log("  Phase:", snap.phase);
console.log("  Turn phase:", snap.turnPhase);
console.log("  Current player:", currentPlayer);

// Draw from stock - should open May I window
console.log("\n--- Drawing from stock ---");
engine.drawFromStock(currentPlayer);

const afterDraw = engine.getSnapshot();
console.log("After draw:");
console.log("  Phase:", afterDraw.phase);
console.log("  Turn phase:", afterDraw.turnPhase);
console.log("  awaitingPlayerId:", afterDraw.awaitingPlayerId);
console.log("  mayIContext:", afterDraw.mayIContext);

// Check the persisted snapshot structure
const persisted = engine.getPersistedSnapshot() as any;
const turnSnapshot = persisted.children?.round?.snapshot?.children?.turn?.snapshot;
console.log("Turn state:", turnSnapshot?.value);
const mayISnapshot = turnSnapshot?.children?.mayIWindow?.snapshot;
console.log("MayI snapshot exists:", !!mayISnapshot);
console.log("MayI state:", mayISnapshot?.value);
console.log("MayI context claimants:", mayISnapshot?.context?.claimants);

if (afterDraw.phase === "MAY_I_WINDOW") {
  // Use awaitingPlayerId which is now set to the next player who can call May I
  const canCallPlayerId = afterDraw.awaitingPlayerId;

  console.log("\n--- Calling May I as player:", canCallPlayerId, "---");
  const claimantHandBefore = afterDraw.players.find(p => p.id === canCallPlayerId)?.hand.length;
  console.log("Claimant hand before:", claimantHandBefore);

  engine.callMayI(canCallPlayerId);

  const afterCall = engine.getSnapshot();
  console.log("After call claimants:", afterCall.mayIContext?.claimants);

  // Current player passes (close window)
  console.log("\n--- Current player passes ---");
  engine.drawFromStock(currentPlayer);

  const afterPass = engine.getSnapshot();
  console.log("After pass phase:", afterPass.phase);
  console.log("After pass turn phase:", afterPass.turnPhase);

  // Check winner's hand (won't be updated until turn completes)
  const winnerMidTurn = afterPass.players.find(p => p.id === canCallPlayerId);
  console.log("Winner hand mid-turn:", winnerMidTurn?.hand.length, "(not yet updated)");

  // Check persisted snapshot for mayIResult
  const persisted3 = engine.getPersistedSnapshot() as any;
  const turnSnapshot3 = persisted3.children?.round?.snapshot?.children?.turn?.snapshot;
  console.log("Turn mayIResult:", turnSnapshot3?.context?.mayIResult);

  // Complete the turn - skip and discard
  console.log("\n--- Current player completes turn ---");
  engine.skip(currentPlayer);

  const afterSkip = engine.getSnapshot();
  console.log("After skip turn phase:", afterSkip.turnPhase);

  // Discard first card in hand
  const cardToDiscard = afterSkip.players.find(p => p.id === currentPlayer)?.hand[0]?.id;
  if (cardToDiscard) {
    engine.discard(currentPlayer, cardToDiscard);

    const afterDiscard = engine.getSnapshot();
    console.log("After discard phase:", afterDiscard.phase);
    console.log("After discard turn phase:", afterDiscard.turnPhase);
    console.log("After discard awaiting player:", afterDiscard.awaitingPlayerId);

    // NOW check winner's hand (should be updated after turn completed)
    const winnerAfterTurn = afterDiscard.players.find(p => p.id === canCallPlayerId);
    console.log("\n=== Final check ===");
    console.log("Winner hand after turn completes:", winnerAfterTurn?.hand.length);
    console.log("Expected:", (claimantHandBefore || 0) + 2, "(+2 for discard and penalty)");
  }
}
