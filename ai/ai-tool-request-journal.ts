/** Observer-only capture of SDK requests, including results rejected before the engine. */
export interface AIToolRequest {
  stepNumber: number;
  toolCallId: string;
  toolName: string;
  input: unknown;
  status: "unresolved" | "succeeded" | "rejected" | "error";
  output?: unknown;
  error?: string;
}

// A structural subset of SDK content: no dependency on the particular tool set.
interface AIToolContentPart {
  type: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  invalid?: boolean;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class AIToolRequestJournal {
  private stepNumber = 0;
  private readonly entries = new Map<string, AIToolRequest>();

  get requests(): AIToolRequest[] {
    return Array.from(this.entries.values());
  }

  startStep(stepNumber: number): void {
    this.stepNumber = stepNumber;
  }

  recordModelResponse(event: { content: readonly AIToolContentPart[] }): void {
    for (const part of event.content) this.recordPart(part);
  }

  recordToolOutput(part: AIToolContentPart): void {
    this.recordPart(part);
  }

  recordStep(event: { content: readonly AIToolContentPart[] }): void {
    this.recordModelResponse(event);
    this.stepNumber++;
  }

  private recordPart(part: AIToolContentPart): void {
    if (!["tool-call", "tool-result", "tool-error"].includes(part.type) ||
      part.toolCallId === undefined || part.toolName === undefined) return;
    const key = `${this.stepNumber}:${part.toolCallId}`;
    const request = this.entries.get(key) ?? {
      stepNumber: this.stepNumber,
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      input: part.input,
      status: "unresolved",
    };
    if (part.type === "tool-error" || part.invalid) {
      request.status = "error";
      request.error = errorText(part.error ?? "Invalid tool request");
    } else if (part.type === "tool-result") {
      request.output = part.output;
      // All May I tools have an explicit success flag. Unknown output shapes
      // cannot certify a request; preserve them for review instead.
      if (typeof part.output === "object" && part.output !== null && "success" in part.output) {
        if (part.output.success === true) {
          request.status = "succeeded";
        } else if (part.output.success === false) {
          request.status = "rejected";
          request.error = "message" in part.output
            ? errorText(part.output.message)
            : "Tool rejected request";
        }
      }
    }
    this.entries.set(key, request);
  }
}

export function summarizeAIToolRequests(requests: readonly AIToolRequest[]) {
  const succeeded = requests.filter(r => r.status === "succeeded").length;
  return {
    total: requests.length,
    succeeded,
    rejected: requests.filter(r => r.status === "rejected").length,
    errors: requests.filter(r => r.status === "error").length,
    unresolved: requests.filter(r => r.status === "unresolved").length,
    successRate: requests.length === 0 ? undefined : succeeded / requests.length,
  };
}
