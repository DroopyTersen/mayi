import { describe, it, expect } from "bun:test";
import { parseDrawCommand } from "./cli.input";

describe("parseDrawCommand", () => {
  it("'d' or '1' returns DRAW_FROM_STOCK", () => {
    expect(parseDrawCommand("d")).toEqual({ type: "DRAW_FROM_STOCK" });
    expect(parseDrawCommand("1")).toEqual({ type: "DRAW_FROM_STOCK" });
    expect(parseDrawCommand("D")).toEqual({ type: "DRAW_FROM_STOCK" });
    expect(parseDrawCommand(" d ")).toEqual({ type: "DRAW_FROM_STOCK" });
  });

  it("'t' or '2' returns DRAW_FROM_DISCARD", () => {
    expect(parseDrawCommand("t")).toEqual({ type: "DRAW_FROM_DISCARD" });
    expect(parseDrawCommand("2")).toEqual({ type: "DRAW_FROM_DISCARD" });
    expect(parseDrawCommand("T")).toEqual({ type: "DRAW_FROM_DISCARD" });
    expect(parseDrawCommand(" t ")).toEqual({ type: "DRAW_FROM_DISCARD" });
  });

  it("invalid input returns error/null", () => {
    const result = parseDrawCommand("x");
    expect(result.type).toBe("error");

    const result2 = parseDrawCommand("3");
    expect(result2.type).toBe("error");

    const result3 = parseDrawCommand("");
    expect(result3.type).toBe("error");
  });
});

describe("parseDiscardCommand", () => {
  it.todo("'x 3' or '3' returns DISCARD with card at position 3", () => {});

  it.todo("position is 1-indexed", () => {});

  it.todo("validates position is within hand size", () => {});

  it.todo("invalid input returns error/null", () => {});
});

describe("parseReorderCommand", () => {
  it.todo("'sort rank' returns sort by rank action", () => {});

  it.todo("'sort suit' returns sort by suit action", () => {});

  it.todo("'move 5 1' returns move card from pos 5 to pos 1", () => {});

  it.todo("validates positions are within hand size", () => {});
});
