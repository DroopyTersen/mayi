export interface TapDiagnosticTarget {
  label: string;
  tagName: string;
  disabled: boolean;
  pointerEvents: string;
}

export interface TapDiagnosticViewport {
  innerWidth: number;
  innerHeight: number;
  visualWidth: number;
  visualHeight: number;
  visualOffsetTop: number;
}

export interface TapDiagnosticSnapshot {
  eventType: string;
  x: number;
  y: number;
  target: TapDiagnosticTarget;
  hit: TapDiagnosticTarget;
  viewport: TapDiagnosticViewport;
}

export type HitTestProbeStatus =
  | "pass"
  | "blocked"
  | "disabled"
  | "missing"
  | "off-viewport";

export interface HitTestProbePoint {
  x: number;
  y: number;
}

export interface HitTestProbeResult {
  label: string;
  center: HitTestProbePoint | null;
  target: TapDiagnosticTarget | null;
  hit: TapDiagnosticTarget | null;
  hitMatchesTarget: boolean;
}

function formatTarget(target: TapDiagnosticTarget): string {
  const availability = target.disabled ? "disabled" : "enabled";

  return `${target.label} <${target.tagName}> ${availability} pe:${target.pointerEvents}`;
}

export function truncateLabel(text: string, max = 60): string {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1)}…`;
}

export function formatTapDiagnosticSnapshot(
  snapshot: TapDiagnosticSnapshot
): string {
  const { viewport } = snapshot;

  return [
    `${snapshot.eventType} @ ${snapshot.x},${snapshot.y}`,
    `target: ${formatTarget(snapshot.target)}`,
    `hit: ${formatTarget(snapshot.hit)}`,
    `viewport: ${viewport.innerWidth}x${viewport.innerHeight} visual ${viewport.visualWidth}x${viewport.visualHeight} offsetTop ${viewport.visualOffsetTop}`,
  ].join(" | ");
}

export function getHitTestProbeStatus(
  result: HitTestProbeResult
): HitTestProbeStatus {
  if (!result.center || !result.target) {
    return "missing";
  }

  // pointer-events:none is intentionally NOT disabled — an overlay making a
  // button inert must surface as blocked, not disabled.
  if (result.target.disabled) {
    return "disabled";
  }

  if (result.hit === null) {
    return "off-viewport";
  }

  return result.hitMatchesTarget ? "pass" : "blocked";
}

export function formatHitTestProbeResult(
  result: HitTestProbeResult,
  status: HitTestProbeStatus
): string {
  const center = result.center
    ? `${result.center.x},${result.center.y}`
    : "missing";
  const target = result.target ? formatTarget(result.target) : "missing";
  const hit = result.hit ? formatTarget(result.hit) : "none";

  return `${result.label}: ${status.toUpperCase()} center ${center} target ${target} hit ${hit}`;
}
