import { describe, it, expect } from "bun:test";
import {
  generateRoomId,
  ROOM_ID_ALPHABET,
  ROOM_ID_LENGTH,
} from "./room-id.utils";

describe("generateRoomId", () => {
  it("generates IDs of correct length", () => {
    const id = generateRoomId();
    expect(id.length).toBe(ROOM_ID_LENGTH);
  });

  it("only uses unambiguous characters", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateRoomId();
      for (const char of id) {
        expect(ROOM_ID_ALPHABET).toContain(char);
      }
    }
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateRoomId());
    }
    expect(ids.size).toBe(1000);
  });

  it("excludes ambiguous characters", () => {
    const ambiguousChars = ["0", "O", "1", "I", "l", "B", "8", "S", "5", "Z", "2"];
    for (let i = 0; i < 100; i++) {
      const id = generateRoomId();
      for (const char of id) {
        expect(ambiguousChars).not.toContain(char);
      }
    }
  });
});

describe("ROOM_ID_ALPHABET", () => {
  it("has expected length of 26 characters", () => {
    expect(ROOM_ID_ALPHABET.length).toBe(26);
  });

  it("does not contain ambiguous characters", () => {
    expect(ROOM_ID_ALPHABET).not.toContain("0");
    expect(ROOM_ID_ALPHABET).not.toContain("O");
    expect(ROOM_ID_ALPHABET).not.toContain("1");
    expect(ROOM_ID_ALPHABET).not.toContain("I");
    expect(ROOM_ID_ALPHABET).not.toContain("l");
    expect(ROOM_ID_ALPHABET).not.toContain("B");
    expect(ROOM_ID_ALPHABET).not.toContain("8");
    expect(ROOM_ID_ALPHABET).not.toContain("S");
    expect(ROOM_ID_ALPHABET).not.toContain("5");
    expect(ROOM_ID_ALPHABET).not.toContain("Z");
    expect(ROOM_ID_ALPHABET).not.toContain("2");
  });
});

describe("ROOM_ID_LENGTH", () => {
  it("is 6 characters", () => {
    expect(ROOM_ID_LENGTH).toBe(6);
  });
});
