import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GameEndScreen } from "./GameEndScreen";

describe("GameEndScreen", () => {
  it("links Play Again to a fresh room when a new game href is provided", () => {
    const html = renderToStaticMarkup(
      <GameEndScreen
        finalScores={{ player1: 0, player2: 45 }}
        winnerId="player1"
        playerNames={{ player1: "Andrew", player2: "Mom" }}
        currentPlayerId="player1"
        newGameHref="/game/new"
        onLeave={() => undefined}
      />
    );

    expect(html).toContain('href="/game/new"');
    expect(html).toContain("Play Again");
  });
});
