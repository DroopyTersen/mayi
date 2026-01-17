import { customAlphabet } from "nanoid";

/**
 * Unambiguous character set for room IDs.
 * Excludes easily confused characters: 0/O, 1/I/l, B/8, S/5, Z/2
 */
export const ROOM_ID_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";

/**
 * Room ID length (6 characters = 26^6 = ~309M combinations)
 */
export const ROOM_ID_LENGTH = 6;

const roomIdGenerator = customAlphabet(ROOM_ID_ALPHABET, ROOM_ID_LENGTH);

/**
 * Generates a room ID using unambiguous characters.
 * IDs are 6 characters long and easy to read aloud or type on mobile.
 */
export function generateRoomId(): string {
  return roomIdGenerator();
}
