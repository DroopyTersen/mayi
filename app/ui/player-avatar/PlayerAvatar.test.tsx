import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerAvatar } from "./PlayerAvatar";
import { TableDisplay } from "~/ui/game-table/TableDisplay";
import { PlayersTableDisplay } from "~/ui/game-status/PlayersTableDisplay";

describe("animated player avatars", () => {
  it("retains the original portrait at rest and loops only during its turn", () => {
    const idle = renderToStaticMarkup(<PlayerAvatar name="Andrew" avatarId="andrew" />);
    const turn = renderToStaticMarkup(<PlayerAvatar name="Andrew" avatarId="andrew" isActiveTurn />);
    expect(idle).toContain("/avatars/animated/andrew-turn.webp");
    expect(idle).toContain('src="/avatars/andrew.svg"');
    expect(idle).toContain('data-avatar-motion="idle"');
    expect(turn).toContain('data-avatar-motion="turn"');
    expect(turn).toContain('aria-label="Andrew"');
    expect(turn).toContain('src="/avatars/andrew.svg"');
  });

  it("gives a confirmed move priority over the turn loop", () => {
    const html = renderToStaticMarkup(<PlayerAvatar name="Jane" avatarId="jane" isActiveTurn
      reaction={{ id: "move-1", playerId: "p2", kind: "lay-off" }} />);
    expect(html).toContain('data-avatar-motion="lay-off"');
  });

  it("preserves existing portraits and initials for characters without a sheet", () => {
    expect(renderToStaticMarkup(<PlayerAvatar name="Robin" avatarId="robin" isActiveTurn />)).toContain('/avatars/robin.svg');
    expect(renderToStaticMarkup(<PlayerAvatar name="Alice" />)).toContain('>A</span>');
  });

  it("targets the same player in the meld table and the status table", () => {
    const players = [
      { id: "p1", name: "Andrew", avatarId: "andrew", cardCount: 5, isDown: true, score: 0 },
      { id: "p2", name: "Jane", avatarId: "jane", cardCount: 8, isDown: false, score: 0 },
    ];
    const reaction = { id: "move-1", playerId: "p1", kind: "lay-down" as const };
    const table = renderToStaticMarkup(<TableDisplay players={players} melds={[]} currentPlayerId="p2" avatarReaction={reaction} />);
    const status = renderToStaticMarkup(<PlayersTableDisplay players={players} activePlayerId="p2" avatarReaction={reaction} />);
    expect(table.match(/data-avatar-motion="lay-down"/g)).toHaveLength(2);
    expect(table.match(/data-avatar-motion="turn"/g)).toHaveLength(2);
    expect(status.match(/data-avatar-motion="lay-down"/g)).toHaveLength(1);
    expect(status.match(/data-avatar-motion="turn"/g)).toHaveLength(1);
  });
});
