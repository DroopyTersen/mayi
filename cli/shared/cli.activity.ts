import type { ActionLogEntry } from "./cli.types";
import {
  formatActivityEntry as formatSharedActivityEntry,
  formatRecentActivity as formatSharedRecentActivity,
  getRecentActivityEntries,
} from "../../core/activity/activity-log.format";

export function formatActivityEntry(entry: ActionLogEntry): string | null {
  return formatSharedActivityEntry(entry);
}

export function getRecentEntries(
  entries: ActionLogEntry[],
  count: number
): ActionLogEntry[] {
  return getRecentActivityEntries(entries, count);
}

export function formatRecentActivity(
  entries: ActionLogEntry[],
  count: number = 6
): string[] {
  return formatSharedRecentActivity(entries, count);
}
