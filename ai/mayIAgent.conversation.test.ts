import { describe, expect, it } from "bun:test";
import type { AssistantModelMessage, ToolModelMessage } from "ai";
import { AIHandConversation, type AIHandConversationContext } from "./mayIAgent.conversation";

const owner = { gameId: "game", playerId: "alice", lineageId: "trial-incarnation-1" };
const initial: AIHandConversationContext = {
  ...owner, currentRound: 1, turnNumber: 3, phase: "ROUND_ACTIVE",
  modelId: "default:meta", modelConfigurationSha256: "configuration-low-retained",
  systemPrompt: "Authoritative rules and separate player guidance",
};

// Message values are inputs to the history data structure, not fake model or
// transport implementations. Real provider acceptance is a separate test gate.
function response(id = "call-1"): Array<AssistantModelMessage | ToolModelMessage> {
  return [
    { role: "assistant", content: [{ type: "tool-call", toolCallId: id, toolName: "discard", input: { position: 3 }, providerOptions: { openrouter: { reasoning_details: [{ type: "reasoning.encrypted", format: "meta-responses-v1", data: "opaque-test-value", id: "reasoning-1" }] } } }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: id, toolName: "discard", output: { type: "json", value: { success: true, turnComplete: true, gameState: "Own hand and public table only" } } }] },
  ];
}

function complete(session: AIHandConversation, context = initial, id = "call-1") {
  const ticket = session.begin(context, "Current own observation");
  return ticket.finish({ latestContext: context, responseMessages: response(id), completed: true, aborted: false });
}

describe("private per-hand conversation boundary", () => {
  it("accepts a structurally compatible context as owner without retaining extra fields", () => {
    const context = { ...initial, stock: [{ id: "hidden-stock-card" }], opponentHand: "hidden-opponent-hand" };
    const session = new AIHandConversation(context);
    const ticket = session.begin(context, "Only the public observation");
    expect(JSON.stringify(session)).toBe("{}");
    expect(ticket.messages).toEqual([{ role: "user", content: "Only the public observation" }]);
    ticket.cancel();
  });

  it("starts empty and replays the exact completed observation, assistant and terminal tool result once", () => {
    const session = new AIHandConversation(owner);
    const first = session.begin(initial, "turn 1 observation");
    expect(first.messages).toEqual([{ role: "user", content: "turn 1 observation" }]);
    const outputs = response();
    expect(first.finish({ latestContext: initial, responseMessages: outputs, completed: true, aborted: false })).toMatchObject({ outcome: "committed", suppliedHistoryMessageCount: 0, committedHistoryMessageCount: 3 });
    const second = session.begin({ ...initial, turnNumber: 6 }, "turn 2 observation");
    expect(second.messages).toEqual([{ role: "user", content: "turn 1 observation" }, ...outputs, { role: "user", content: "turn 2 observation" }]);
    expect(second.cancel().outcome).toBe("discarded");
  });

  it("defensively copies observations and nested returned provider metadata", () => {
    const session = new AIHandConversation(owner);
    const first = session.begin(initial, "immutable observation");
    first.messages[0]!.content = "mutated caller copy";
    const outputs = response();
    const original = structuredClone(outputs);
    first.finish({ latestContext: initial, responseMessages: outputs, completed: true, aborted: false });
    outputs[0]!.content = "changed assistant";
    const second = session.begin(initial, "next");
    const messages = second.messages;
    expect(messages.slice(0, 3)).toEqual([{ role: "user", content: "immutable observation" }, ...original]);
    const assistant = messages[1] as AssistantModelMessage;
    const part = (assistant.content as Array<{ providerOptions?: { openrouter?: { reasoning_details?: Array<{ data: string }> } } }>)[0]!;
    part.providerOptions!.openrouter!.reasoning_details![0]!.data = "mutated encrypted copy";
    expect(second.messages[1]).toEqual(original[0]);
    second.cancel();
  });

  for (const field of ["gameId", "playerId", "lineageId"] as const) {
    it(`rejects a different ${field} without destroying the owner's history`, () => {
      const session = new AIHandConversation(owner);
      complete(session);
      expect(() => session.begin({ ...initial, [field]: "other" }, "foreign")).toThrow("owner");
      const own = session.begin(initial, "own");
      expect(own.messages).toHaveLength(4);
      own.cancel();
    });
  }

  it("does not share history between separately instantiated repetitions", () => {
    const first = new AIHandConversation(owner);
    complete(first);
    const second = new AIHandConversation(owner).begin(initial, "fresh trial");
    expect(second.messages).toHaveLength(1);
    second.cancel();
  });

  for (const [field, value] of [["modelId", "new-meta-model"], ["modelConfigurationSha256", "same-alias-new-effort"], ["systemPrompt", "changed exact prompt text"]] as const) {
    it(`resets on changed ${field}`, () => {
      const session = new AIHandConversation(owner);
      complete(session);
      const next = session.begin({ ...initial, [field]: value }, "new configuration");
      expect(next.messages).toHaveLength(1);
      next.cancel();
    });
  }

  it("keeps ordinary, May I, and claim-resolution messages in one hand", () => {
    const session = new AIHandConversation(owner);
    complete(session);
    const mayI = session.begin({ ...initial, phase: "RESOLVING_MAY_I" }, "claim-or-allow observation");
    expect(mayI.messages).toHaveLength(4);
    mayI.finish({ latestContext: initial, responseMessages: response("claim-2"), completed: true, aborted: false });
    const ordinary = session.begin({ ...initial, turnNumber: 6 }, "ordinary turn");
    expect(ordinary.messages).toHaveLength(7);
    ordinary.cancel();
  });

  it("resets at a new hand and rejects old hand/turn contexts", () => {
    const session = new AIHandConversation(owner);
    complete(session);
    const nextContext: AIHandConversationContext = { ...initial, currentRound: 2, turnNumber: 1 };
    complete(session, nextContext, "new-hand-call");
    expect(() => session.begin(initial, "old hand")).toThrow("stale");
    const next = session.begin({ ...nextContext, turnNumber: 4 }, "new hand");
    expect(next.messages).toHaveLength(4);
    next.cancel();
    expect(() => session.begin(nextContext, "old turn")).toThrow("stale");
  });

  for (const phase of ["ROUND_END", "GAME_END"] as const) {
    it(`clears on ${phase} without resurrecting that hand`, () => {
      const session = new AIHandConversation(owner);
      complete(session);
      const ticket = session.begin(initial, "winning move");
      expect(ticket.finish({ latestContext: { ...initial, phase }, responseMessages: response("win"), completed: true, aborted: false }).outcome).toBe("reset");
      expect(() => session.begin(initial, "stale active hand")).toThrow("ended");
    });
  }

  it("rejects overlap, cancels safely, and ignores a stale finish after reset", () => {
    const session = new AIHandConversation(owner);
    const first = session.begin(initial, "first");
    expect(() => session.begin(initial, "overlap")).toThrow("in flight");
    session.reset();
    complete(session, initial, "new-generation");
    expect(first.finish({ latestContext: initial, responseMessages: response("stale"), completed: true, aborted: false }).outcome).toBe("discarded");
    const next = session.begin(initial, "latest");
    expect(JSON.stringify(next.messages)).not.toContain("stale");
    expect(next.messages).toHaveLength(4);
    next.cancel();
  });

  it("a duplicate finish cannot append the same response twice", () => {
    const session = new AIHandConversation(owner);
    const ticket = session.begin(initial, "one decision");
    const finish = { latestContext: initial, responseMessages: response(), completed: true, aborted: false };
    ticket.finish(finish);
    expect(ticket.finish(finish).outcome).toBe("discarded");
    const next = session.begin(initial, "next");
    expect(next.messages).toHaveLength(4);
    next.cancel();
  });

  for (const failure of ["incomplete", "aborted", "missing-snapshot"] as const) {
    it(`does not append ${failure} decisions and preserves prior completed history`, () => {
      const session = new AIHandConversation(owner);
      complete(session);
      const ticket = session.begin(initial, "partial observation");
      const trace = ticket.finish({ latestContext: failure === "missing-snapshot" ? undefined : initial, responseMessages: response("partial"), completed: failure !== "incomplete", aborted: failure === "aborted" });
      expect(trace.outcome).toBe("discarded");
      expect(JSON.stringify(trace)).not.toContain("opaque-test-value");
      const next = session.begin(initial, "fresh observation after partial actions");
      expect(next.messages).toHaveLength(4);
      expect(JSON.stringify(next.messages)).not.toContain("partial observation");
      next.cancel();
    });
  }

  it("refuses unresolved or mismatched terminal tool exchanges instead of fabricating results", () => {
    for (const malformed of [response().slice(0, 1), [response()[1]!], [{ ...response()[0]! }, { role: "tool" as const, content: [{ type: "tool-result" as const, toolCallId: "wrong-id", toolName: "discard", output: { type: "text" as const, value: "ok" } }] }]]) {
      const session = new AIHandConversation(owner);
      const ticket = session.begin(initial, "input");
      expect(ticket.finish({ latestContext: initial, responseMessages: malformed, completed: true, aborted: false }).outcome).toBe("discarded");
      const next = session.begin(initial, "retry");
      expect(next.messages).toHaveLength(1);
      next.cancel();
    }
  });

  it("requires pending tool results before a new assistant response", () => {
    const a = response("a");
    const b = response("b");
    const session = new AIHandConversation(owner);
    const ticket = session.begin(initial, "input");
    expect(ticket.finish({ latestContext: initial, responseMessages: [a[0]!, b[0]!, a[1]!, b[1]!], completed: true, aborted: false }).outcome).toBe("discarded");
    const next = session.begin(initial, "next");
    expect(next.messages).toHaveLength(1);
    next.cancel();
  });

  it("preserves parallel calls and their matching results in their original order", () => {
    const a = response("parallel-a");
    const b = response("parallel-b");
    const assistantA = a[0] as AssistantModelMessage;
    const assistantB = b[0] as AssistantModelMessage;
    if (typeof assistantA.content === "string" || typeof assistantB.content === "string") throw new Error("Expected call parts");
    const outputs: Array<AssistantModelMessage | ToolModelMessage> = [
      { role: "assistant", content: [...assistantA.content, ...assistantB.content] }, b[1]!, a[1]!,
    ];
    const session = new AIHandConversation(owner);
    const ticket = session.begin(initial, "input");
    expect(ticket.finish({ latestContext: initial, responseMessages: outputs, completed: true, aborted: false }).outcome).toBe("committed");
    const next = session.begin(initial, "next");
    expect(next.messages.slice(1, -1)).toEqual(outputs);
    next.cancel();
  });

  it("does not confuse a text answer with a terminal game decision", () => {
    const session = new AIHandConversation(owner);
    const ticket = session.begin(initial, "input");
    expect(ticket.finish({ latestContext: initial, responseMessages: [{ role: "assistant", content: "I discarded a card" }], completed: true, aborted: false }).outcome).toBe("discarded");
    const next = session.begin(initial, "next");
    expect(next.messages).toHaveLength(1);
    next.cancel();
  });

  it("retains a rejected tool result followed by a completed recovery", () => {
    const failed = response("rejected");
    failed[1] = { role: "tool", content: [{ type: "tool-result", toolCallId: "rejected", toolName: "discard", output: { type: "json", value: { success: false, turnComplete: false, message: "Invalid position" } } }] };
    const outputs = [...failed, ...response("recovered")];
    const session = new AIHandConversation(owner);
    const ticket = session.begin(initial, "input");
    expect(ticket.finish({ latestContext: initial, responseMessages: outputs, completed: true, aborted: false }).outcome).toBe("committed");
    const next = session.begin(initial, "next");
    expect(next.messages.slice(1, -1)).toEqual(outputs);
    next.cancel();
  });
});
