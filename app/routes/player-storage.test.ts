import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  getStoredPlayerName,
  storePlayerName,
  getOrCreatePlayerId,
  getStoredAvatarId,
  storeAvatarId,
  clearStoredAvatarId,
} from "./player-storage";

// Mock localStorage and sessionStorage for testing
const createMockStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

describe("player-storage", () => {
  let originalLocalStorage: Storage;
  let originalSessionStorage: Storage;
  let mockLocalStorage: ReturnType<typeof createMockStorage>;
  let mockSessionStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    // Save originals
    originalLocalStorage = globalThis.localStorage;
    originalSessionStorage = globalThis.sessionStorage;

    // Create mocks
    mockLocalStorage = createMockStorage();
    mockSessionStorage = createMockStorage();

    // Install mocks
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore originals
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: originalSessionStorage,
      writable: true,
      configurable: true,
    });
  });

  describe("getStoredPlayerName / storePlayerName", () => {
    it("returns null when no name is stored", () => {
      expect(getStoredPlayerName()).toBeNull();
    });

    it("stores and retrieves player name globally (not room-specific)", () => {
      storePlayerName("Drew");
      expect(getStoredPlayerName()).toBe("Drew");
    });

    it("persists the same name for all rooms", () => {
      // Store name once
      storePlayerName("Alice");

      // Name should be available for any room lookup
      // (This verifies the name is stored globally, not per-room)
      expect(getStoredPlayerName()).toBe("Alice");

      // Even if we "join" different rooms, the name is the same
      // (player ID is per-room, but name is global)
      expect(getStoredPlayerName()).toBe("Alice");
    });

    it("overwrites previous name when storing new name", () => {
      storePlayerName("FirstName");
      expect(getStoredPlayerName()).toBe("FirstName");

      storePlayerName("SecondName");
      expect(getStoredPlayerName()).toBe("SecondName");
    });
  });

  describe("getOrCreatePlayerId", () => {
    it("creates a new player ID for a room", () => {
      const playerId = getOrCreatePlayerId("room-1");
      expect(playerId).toBeDefined();
      expect(playerId.length).toBe(12); // nanoid(12)
    });

    it("returns the same player ID for the same room", () => {
      const first = getOrCreatePlayerId("room-1");
      const second = getOrCreatePlayerId("room-1");
      expect(first).toBe(second);
    });

    it("returns different player IDs for different rooms", () => {
      const roomA = getOrCreatePlayerId("room-a");
      const roomB = getOrCreatePlayerId("room-b");
      expect(roomA).not.toBe(roomB);
    });

    it("uses room-specific keys in sessionStorage", () => {
      getOrCreatePlayerId("room-1");
      getOrCreatePlayerId("room-2");

      // Check that room-specific keys are used
      expect(mockSessionStorage.getItem("mayi:room:room-1:playerId")).toBeDefined();
      expect(mockSessionStorage.getItem("mayi:room:room-2:playerId")).toBeDefined();
    });
  });

  describe("name persistence across rooms (integration)", () => {
    it("remembers user name when switching rooms", () => {
      // User joins room 1 and enters their name
      const room1PlayerId = getOrCreatePlayerId("room-1");
      storePlayerName("Drew");

      // User joins room 2 - name should be remembered, but player ID is different
      const room2PlayerId = getOrCreatePlayerId("room-2");
      const storedName = getStoredPlayerName();

      expect(room1PlayerId).not.toBe(room2PlayerId); // Different player IDs per room
      expect(storedName).toBe("Drew"); // Same name across rooms
    });
  });

  describe("getStoredAvatarId / storeAvatarId", () => {
    it("returns null when no avatar is stored", () => {
      expect(getStoredAvatarId()).toBeNull();
    });

    it("stores and retrieves avatar ID globally (not room-specific)", () => {
      storeAvatarId("ethel");
      expect(getStoredAvatarId()).toBe("ethel");
    });

    it("persists the same avatar for all rooms", () => {
      storeAvatarId("bart");

      // Avatar should be available globally, not per-room
      expect(getStoredAvatarId()).toBe("bart");
    });

    it("overwrites previous avatar when storing new avatar", () => {
      storeAvatarId("ethel");
      expect(getStoredAvatarId()).toBe("ethel");

      storeAvatarId("curt");
      expect(getStoredAvatarId()).toBe("curt");
    });

    it("clears stored avatar ID", () => {
      storeAvatarId("ethel");
      expect(getStoredAvatarId()).toBe("ethel");

      clearStoredAvatarId();
      expect(getStoredAvatarId()).toBeNull();
    });
  });

  describe("avatar persistence across rooms (integration)", () => {
    it("remembers user avatar when switching rooms", () => {
      // User joins room 1 and picks their avatar
      const room1PlayerId = getOrCreatePlayerId("room-1");
      storeAvatarId("ethel");
      storePlayerName("Ethel");

      // User joins room 2 - avatar should be remembered, but player ID is different
      const room2PlayerId = getOrCreatePlayerId("room-2");
      const storedAvatar = getStoredAvatarId();
      const storedName = getStoredPlayerName();

      expect(room1PlayerId).not.toBe(room2PlayerId); // Different player IDs per room
      expect(storedAvatar).toBe("ethel"); // Same avatar across rooms
      expect(storedName).toBe("Ethel"); // Same name across rooms
    });
  });
});
