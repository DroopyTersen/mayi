import { describe, expect, it } from "bun:test";
import { formatActivityLogEntries } from "~/routes/game/game-room-session.logic";
import { getNewAvatarReaction } from "./avatar-reaction";

function activity(id: string, action: string, playerId = "andrew") {
  return formatActivityLogEntries([{
    id, action, playerId, playerName: "Same display name",
    timestamp: "2026-09-09T18:00:00Z", roundNumber: 1, turnNumber: 2,
  }])[0]!;
}

describe("avatar reactions from confirmed game activity", () => {
  const drawn = activity("draw", "drew from the draw pile");
  const laidDown = activity("down", "laid down contract");

  it("celebrates a new lay down by the acting player's ID", () => {
    expect(getNewAvatarReaction([drawn, laidDown], "draw")).toEqual({
      id: "down", playerId: "andrew", kind: "lay-down",
    });
  });

  it.each(["laid off", "laid off at start"])("recognizes %s, including onto another player's meld", (action) => {
    const entry = activity("off", action, "jane");
    expect(getNewAvatarReaction([drawn, entry], "draw")).toEqual({
      id: "off", playerId: "jane", kind: "lay-off",
    });
  });

  it("does not celebrate a draw or discard", () => {
    expect(getNewAvatarReaction([drawn, activity("discard", "discarded")], "draw")).toBeNull();
  });

  it("does not replay duplicate updates or a replaced round", () => {
    expect(getNewAvatarReaction([drawn, laidDown], "down")).toBeNull();
    expect(getNewAvatarReaction([laidDown], "old-round-event")).toBeNull();
    expect(getNewAvatarReaction([], "down")).toBeNull();
  });

  it("reacts to the first confirmed move when the previously observed log was empty", () => {
    expect(getNewAvatarReaction([laidDown], undefined)).toEqual({
      id: "down", playerId: "andrew", kind: "lay-down",
    });
  });

  it("finds the latest celebration even when an AI also discarded in the same update", () => {
    const entries = [drawn, laidDown, activity("off", "laid off"), activity("discard", "discarded")];
    expect(getNewAvatarReaction(entries, "draw")?.id).toBe("off");
  });
});
