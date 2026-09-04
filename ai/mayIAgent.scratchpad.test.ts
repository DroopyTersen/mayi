import { expect, it } from "bun:test";
import { AIHandScratchpad, parseAIStrategyNote } from "./mayIAgent.scratchpad";

const context = {
  gameId: "game-a",
  playerId: "player-a",
  currentRound: 1 as const,
  phase: "ROUND_ACTIVE" as const,
};

it("starts empty and carries only a completed turn's private intent forward", () => {
  const memory = new AIHandScratchpad(context.gameId, context.playerId);
  expect(memory.read(context)).toBeUndefined();
  const turn = memory.begin(context);
  turn.stage("Plan: preserve the coherent contract.\nPivot if the new draw improves it.");
  expect(memory.read(context)).toBeUndefined();
  const trace = turn.finish(context, true);
  expect(trace.outcome).toBe("committed");
  expect(memory.read(context)).toBe(trace.proposed);
  expect(memory.begin(context).before).toBe(trace.proposed);
});

it("isolates games and players without clearing another player's note", () => {
  const memory = new AIHandScratchpad(context.gameId, context.playerId);
  const turn = memory.begin(context);
  turn.stage("Keep the current plan unless the public board changes.");
  turn.finish(context, true);
  expect(memory.read({ ...context, gameId: "game-b" })).toBeUndefined();
  expect(memory.read({ ...context, playerId: "player-b" })).toBeUndefined();
  expect(memory.read(context)).toContain("current plan");
  expect(() => memory.begin({ ...context, playerId: "player-b" })).toThrow();
  expect(JSON.stringify(memory)).not.toContain("current plan");
});

it("resets on the next hand and cannot resurrect an old hand", () => {
  const memory = new AIHandScratchpad(context.gameId, context.playerId);
  const oldTurn = memory.begin(context);
  oldTurn.stage("Old hand intent.");
  oldTurn.finish(context, true);
  const next = { ...context, currentRound: 2 as const };
  expect(memory.read(next)).toBeUndefined();
  expect(memory.read(context)).toBeUndefined();
  expect(() => memory.begin(context)).toThrow();
  const nextTurn = memory.begin(next);
  nextTurn.stage("New hand intent.");
  nextTurn.finish(next, true);
  expect(memory.read(next)).toBe("New hand intent.");
});

it("discards aborted or unfinished intent and preserves the last committed note", () => {
  const memory = new AIHandScratchpad(context.gameId, context.playerId);
  const first = memory.begin(context);
  first.stage("Committed plan.");
  first.finish(context, true);
  const interrupted = memory.begin(context);
  interrupted.stage("Unfinished new plan.");
  expect(interrupted.finish(context, false).outcome).toBe("discarded");
  expect(memory.read(context)).toBe("Committed plan.");
  expect(() => interrupted.stage("Too late.")).toThrow();
});

it("does not let stale invocations overwrite newer intent", () => {
  const memory = new AIHandScratchpad(context.gameId, context.playerId);
  const stale = memory.begin(context);
  stale.stage("Stale intent.");
  const current = memory.begin(context);
  current.stage("Current intent.");
  current.finish(context, true);
  expect(stale.finish(context, true).outcome).toBe("discarded");
  expect(memory.read(context)).toBe("Current intent.");
});

it("expires notes and in-flight proposals when the hand ends", () => {
  const memory = new AIHandScratchpad(context.gameId, context.playerId);
  const turn = memory.begin(context);
  turn.stage("No next turn after the hand ends.");
  expect(turn.finish({ ...context, phase: "ROUND_END" }, true).outcome).toBe("discarded");
  expect(memory.read(context)).toBeUndefined();
  expect(() => memory.begin(context)).toThrow();
  expect(memory.read({ ...context, currentRound: 2 })).toBeUndefined();
});

it("leaves prior intent unchanged when a completed turn supplies no new note", () => {
  const memory = new AIHandScratchpad(context.gameId, context.playerId);
  const first = memory.begin(context);
  first.stage("Still useful.");
  first.finish(context, true);
  expect(memory.begin(context).finish(context, true).outcome).toBe("unchanged");
  expect(memory.read({ ...context, phase: "RESOLVING_MAY_I" })).toBe("Still useful.");
});

it("accepts at most two nonempty lines and 400 characters, with normalized whitespace", () => {
  expect(parseAIStrategyNote("  One line.\r\n  Another line.  ")).toBe("One line.\nAnother line.");
  expect(parseAIStrategyNote("a".repeat(400))).toHaveLength(400);
  for (const invalid of ["", "   ", "one\ntwo\nthree", "one\n\ntwo", "a".repeat(401)]) {
    expect(() => parseAIStrategyNote(invalid)).toThrow();
  }
});

it("restores only committed private notes from the same game, player, and hand", () => {
  const memory = new AIHandScratchpad(context.gameId, context.playerId);
  const turn = memory.begin(context);
  turn.stage("Observed: public pickup. Plan: reconsider after drawing.");
  expect(memory.exportState(context)).toBeUndefined();
  turn.finish(context, true);
  const saved: unknown = JSON.parse(JSON.stringify(memory.exportState(context)));
  expect(AIHandScratchpad.restore(context, saved).read(context)).toContain("public pickup");
  for (const changed of [
    { ...context, currentRound: 2 as const },
    { ...context, gameId: "other-game" },
    { ...context, playerId: "other-player" },
    { ...context, phase: "ROUND_END" as const },
  ]) {
    expect(AIHandScratchpad.restore(changed, saved).read(changed)).toBeUndefined();
  }
  expect(memory.exportState({ ...context, phase: "GAME_END" })).toBeUndefined();
});

it("ignores invalid or obsolete notebook storage without blocking play", () => {
  for (const value of [undefined, null, [], "bad", {},
    { ...context, version: "old", note: "old note" },
    { ...context, version: "private-hand-scratchpad-v1", note: "x".repeat(401) },
  ]) {
    expect(AIHandScratchpad.restore(context, value).read(context)).toBeUndefined();
  }
});
