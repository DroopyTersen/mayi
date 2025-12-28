import { describe, it, expect } from "bun:test";
import { parseDrawCommand, parseDiscardCommand } from "./cli.input";

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
  it("'x 3' or '3' returns DISCARD with card at position 3", () => {
    expect(parseDiscardCommand("3", 5)).toEqual({ type: "DISCARD", position: 3 });
    expect(parseDiscardCommand("x 3", 5)).toEqual({ type: "DISCARD", position: 3 });
    expect(parseDiscardCommand("X 3", 5)).toEqual({ type: "DISCARD", position: 3 });
    expect(parseDiscardCommand(" 3 ", 5)).toEqual({ type: "DISCARD", position: 3 });
  });

  it("position is 1-indexed", () => {
    // Position 1 is valid (first card)
    expect(parseDiscardCommand("1", 5)).toEqual({ type: "DISCARD", position: 1 });
    // Position 5 is valid (last card in hand of 5)
    expect(parseDiscardCommand("5", 5)).toEqual({ type: "DISCARD", position: 5 });
  });

  it("validates position is within hand size", () => {
    // Position 0 is invalid
    const result0 = parseDiscardCommand("0", 5);
    expect(result0.type).toBe("error");

    // Position 6 is invalid for hand of 5
    const result6 = parseDiscardCommand("6", 5);
    expect(result6.type).toBe("error");

    // Position -1 is invalid
    const resultNeg = parseDiscardCommand("-1", 5);
    expect(resultNeg.type).toBe("error");
  });

  it("invalid input returns error/null", () => {
    const resultText = parseDiscardCommand("abc", 5);
    expect(resultText.type).toBe("error");

    const resultEmpty = parseDiscardCommand("", 5);
    expect(resultEmpty.type).toBe("error");
  });
});

describe("parseReorderCommand", () => {
  it.todo("'sort rank' returns sort by rank action", () => {});

  it.todo("'sort suit' returns sort by suit action", () => {});

  it.todo("'move 5 1' returns move card from pos 5 to pos 1", () => {});

  it.todo("validates positions are within hand size", () => {});
});
