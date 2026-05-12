import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LobbyView } from "./LobbyView";

describe("LobbyView", () => {
  it("offers a fresh new game link from an existing room", () => {
    const html = renderToStaticMarkup(
      <LobbyView
        roomId="HNPXR6"
        connectionStatus="connected"
        joinStatus="unjoined"
        players={[]}
        currentPlayerId={null}
        showNamePrompt={false}
        onNamePromptChange={() => undefined}
        onJoin={() => undefined}
      />
    );

    expect(html).toContain('href="/game/new"');
    expect(html).toContain("New Game");
  });
});
