import { nanoid } from "nanoid";

// Global key for player name - persists across all rooms
const PLAYER_NAME_KEY = "mayi:playerName";

// Room-specific key for player ID - each room has its own identity
export function getPlayerIdKey(roomId: string): string {
  return `mayi:room:${roomId}:playerId`;
}

// Room-specific key for player name override (used by agent harness)
export function getPlayerNameKey(roomId: string): string {
  return `mayi:room:${roomId}:playerName`;
}

/**
 * Get stored player name from localStorage (persists across all rooms)
 */
export function getStoredPlayerName(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(PLAYER_NAME_KEY);
}

/**
 * Store player name in localStorage (persists across all rooms)
 */
export function storePlayerName(name: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

/**
 * Get or create a room-specific player ID from sessionStorage
 */
export function getOrCreatePlayerId(roomId: string): string {
  if (typeof sessionStorage === "undefined") {
    return nanoid(12);
  }
  const key = getPlayerIdKey(roomId);
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;

  const playerId = nanoid(12);
  sessionStorage.setItem(key, playerId);
  return playerId;
}
