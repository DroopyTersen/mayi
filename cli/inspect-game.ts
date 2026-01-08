#!/usr/bin/env bun
/**
 * Inspect a game's state via WebSocket connection
 * Usage: bun cli/inspect-game.ts <game-id>
 */

const gameId = process.argv[2];
if (!gameId) {
  console.error("Usage: bun cli/inspect-game.ts <game-id>");
  process.exit(1);
}

const url = `ws://localhost:5173/parties/may-i-room/${gameId}`;
console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url);

ws.onopen = () => {
  console.log("Connected! Joining as inspector...");
  // Join as a temp player to get state
  ws.send(JSON.stringify({
    type: "JOIN",
    playerId: "inspector-" + Date.now(),
    playerName: "Inspector",
    isAI: false,
  }));
};

ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    console.log("\n=== Message received ===");
    console.log("Type:", msg.type);

    if (msg.type === "GAME_STATE") {
      console.log("\n--- Game State ---");
      console.log("Phase:", msg.snapshot?.phase);
      console.log("Turn Phase:", msg.snapshot?.turnPhase);
      console.log("Current Round:", msg.snapshot?.currentRound);
      console.log("Awaiting Player:", msg.snapshot?.awaitingPlayer);

      if (msg.snapshot?.mayIContext) {
        console.log("\n--- May-I Context ---");
        console.log("Original Caller:", msg.snapshot.mayIContext.originalCaller);
        console.log("Card Being Claimed:", JSON.stringify(msg.snapshot.mayIContext.cardBeingClaimed));
        console.log("Player Being Prompted:", msg.snapshot.mayIContext.playerBeingPrompted);
        console.log("Players Who Allowed:", msg.snapshot.mayIContext.playersWhoAllowed);
      }

      console.log("\n--- Players ---");
      if (msg.snapshot?.players) {
        for (const [id, player] of Object.entries(msg.snapshot.players)) {
          const p = player as any;
          console.log(`  ${id}: ${p.hand?.length || 0} cards, down=${p.hasLaidDown}`);
        }
      }

      console.log("\n--- Full Snapshot ---");
      console.log(JSON.stringify(msg.snapshot, null, 2));

      // Close after receiving state
      setTimeout(() => {
        ws.close();
        process.exit(0);
      }, 1000);
    } else if (msg.type === "ERROR") {
      console.log("Error:", msg.error, msg.message);
    } else {
      console.log("Data:", JSON.stringify(msg, null, 2).slice(0, 500));
    }
  } catch (e) {
    console.log("Raw message:", event.data);
  }
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("Connection closed");
};

// Timeout after 10 seconds
setTimeout(() => {
  console.log("Timeout - closing connection");
  ws.close();
  process.exit(1);
}, 10000);
