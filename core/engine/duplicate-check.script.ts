import { GameEngine } from "./game-engine";

// Test: Create a game and check for duplicates immediately
function testInitialDuplicates() {
  console.log("Testing for duplicates after game creation...\n");

  for (let i = 0; i < 10; i++) {
    const engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    const snapshot = engine.getSnapshot();

    if (snapshot.lastError) {
      console.log(`Game ${i + 1}: ERROR - ${snapshot.lastError}`);

      // Dump the full state for investigation
      console.log("\nSnapshot details:");
      console.log("Players:");
      snapshot.players.forEach((p) => {
        console.log(`  ${p.name}: ${p.hand.length} cards - ${p.hand.map(c => c.id).join(", ")}`);
      });
      console.log(`Stock: ${snapshot.stock.length} cards`);
      console.log(`Discard: ${snapshot.discard.length} cards`);

      engine.stop();
      return false;
    }

    // Test draw and discard
    const currentPlayer = snapshot.players[snapshot.currentPlayerIndex]!;
    const drawResult = engine.drawFromStock(currentPlayer.id);

    if (drawResult?.lastError) {
      console.log(`Game ${i + 1}: ERROR after draw - ${drawResult.lastError}`);
      engine.stop();
      return false;
    }

    // Try to discard
    const afterDraw = engine.getSnapshot();
    const discardCard = afterDraw.players.find(p => p.id === currentPlayer.id)!.hand[0]!;
    const discardResult = engine.discard(currentPlayer.id, discardCard.id);

    if (discardResult?.lastError) {
      console.log(`Game ${i + 1}: ERROR after discard - ${discardResult.lastError}`);
      engine.stop();
      return false;
    }

    console.log(`Game ${i + 1}: OK`);
    engine.stop();
  }

  return true;
}

const success = testInitialDuplicates();
console.log(success ? "\nAll tests passed!" : "\nTests failed!");
process.exit(success ? 0 : 1);
