import { describe, it, expect } from "bun:test";

describe("parseDrawCommand", () => {
  it.todo("'d' or '1' returns DRAW_FROM_STOCK", () => {});

  it.todo("'t' or '2' returns DRAW_FROM_DISCARD", () => {});

  it.todo("invalid input returns error/null", () => {});
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
