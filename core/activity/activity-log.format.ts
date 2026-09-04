import type { RoundNumber } from "../engine/engine.types";

export interface ActivityLogPlayer {
  id: string;
  name: string;
}

export interface ActivityLogContext {
  roundNumber: RoundNumber;
  turnNumber: number;
  players: readonly ActivityLogPlayer[];
}

export interface BaseActivityLogEntry {
  timestamp: string;
  roundNumber: RoundNumber;
  turnNumber: number;
  playerId: string;
  playerName: string;
  action: string;
  details?: string;
}

export interface ActivityLogEntryWithId extends BaseActivityLogEntry {
  id: string;
}

interface CreateActivityLogEntryInput {
  context: ActivityLogContext;
  playerId: string;
  action: string;
  details?: string;
  timestamp?: string;
}

interface CreateActivityLogEntryWithIdInput extends CreateActivityLogEntryInput {
  id: string;
}

export interface FormatActivityEntryOptions {
  humanPlayerId?: string | null;
  humanLabel?: string;
}

const DEFAULT_HUMAN_PLAYER_ID = "player-0";
const DEFAULT_HUMAN_LABEL = "You";

const SKIPPED_ACTIVITY_ACTIONS = [
  "skipped laying down",
  "passed on May I",
  "May I window closed",
  "GAME_STARTED",
  "started round",
  "reshuffled stock",
];

export function createActivityLogEntry(
  input: CreateActivityLogEntryWithIdInput
): ActivityLogEntryWithId;
export function createActivityLogEntry(
  input: CreateActivityLogEntryInput
): BaseActivityLogEntry;
export function createActivityLogEntry(
  input: CreateActivityLogEntryInput | CreateActivityLogEntryWithIdInput
): BaseActivityLogEntry | ActivityLogEntryWithId {
  const playerName =
    input.playerId === "system"
      ? "System"
      : input.context.players.find((player) => player.id === input.playerId)
          ?.name ?? input.playerId;

  const entry: BaseActivityLogEntry = {
    timestamp: input.timestamp ?? new Date().toISOString(),
    roundNumber: input.context.roundNumber,
    turnNumber: input.context.turnNumber,
    playerId: input.playerId,
    playerName,
    action: input.action,
    ...(input.details ? { details: input.details } : {}),
  };

  if ("id" in input) {
    return {
      id: input.id,
      ...entry,
    };
  }

  return entry;
}

export function isDisplayableActivityEntry(
  entry: Pick<BaseActivityLogEntry, "playerId" | "action">
): boolean {
  if (entry.playerId === "system") {
    return false;
  }

  return !SKIPPED_ACTIVITY_ACTIONS.some((skipped) =>
    entry.action.includes(skipped)
  );
}

export function formatActivityEntry(
  entry: BaseActivityLogEntry,
  options: FormatActivityEntryOptions = {}
): string | null {
  if (!isDisplayableActivityEntry(entry)) {
    return null;
  }

  const humanPlayerId =
    options.humanPlayerId === undefined
      ? DEFAULT_HUMAN_PLAYER_ID
      : options.humanPlayerId;
  const humanLabel = options.humanLabel ?? DEFAULT_HUMAN_LABEL;
  const name =
    humanPlayerId !== null && entry.playerId === humanPlayerId
      ? humanLabel
      : entry.playerName;

  switch (entry.action) {
    case "drew from stock":
      return `${name}: drew from stock`;

    case "drew from the draw pile":
      return `${name}: drew from the draw pile`;

    case "drew from discard":
    case "took from discard":
      return entry.details
        ? `${name}: took ${entry.details} from discard`
        : `${name}: took from discard`;

    case "discarded":
      return entry.details
        ? `${name}: discarded ${entry.details}`
        : `${name}: discarded`;

    case "laid down contract":
      return entry.details
        ? `${name}: laid down contract — ${entry.details}`
        : `${name}: laid down contract`;

    case "laid down":
      return entry.details
        ? `${name}: laid down ${entry.details}`
        : `${name}: laid down`;

    case "laid off":
    case "laid off at start":
      return entry.details
        ? `${name}: ${entry.action} ${entry.details}`
        : `${name}: ${entry.action}`;

    case "called May I":
      return entry.details
        ? `${name}: called May I on ${entry.details}`
        : `${name}: called May I`;

    case "allowed May I":
      return `${name}: allowed May I`;

    case "claimed May I":
      return entry.details
        ? `${name}: claimed May I on ${entry.details}`
        : `${name}: claimed May I`;

    case "won May I":
      return entry.details
        ? `${name}: won May I (${entry.details})`
        : `${name}: won May I`;

    case "took the May I card":
      return entry.details
        ? `${name}: took the May I card ${entry.details}`
        : `${name}: took the May I card`;

    case "swapped Joker":
      return entry.details
        ? `${name}: swapped ${entry.details}`
        : `${name}: swapped Joker`;

    case "went out":
    case "went out!":
      return `${name}: went out!`;

    default: {
      const details = entry.details ? ` ${entry.details}` : "";
      return `${name}: ${entry.action}${details}`;
    }
  }
}

export function getRecentActivityEntries<
  TEntry extends Pick<BaseActivityLogEntry, "playerId" | "action">,
>(entries: readonly TEntry[], count: number): TEntry[] {
  const interesting = entries.filter(isDisplayableActivityEntry);
  return interesting.slice(-count);
}

export function formatRecentActivity(
  entries: readonly BaseActivityLogEntry[],
  count: number = 6,
  options: FormatActivityEntryOptions = {}
): string[] {
  return getRecentActivityEntries(entries, count)
    .map((entry) => formatActivityEntry(entry, options))
    .filter((line): line is string => line !== null);
}
