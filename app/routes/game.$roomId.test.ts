import { describe, expect, it } from "bun:test";
import { loader } from "./game.$roomId";

describe("game room loader", () => {
  it("redirects mixed-case room IDs to the canonical uppercase URL", async () => {
    const response = await loader({
      params: { roomId: "hnpxr6" },
      request: new Request("http://localhost/game/hnpxr6?agent=true"),
    } as never);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "/game/HNPXR6?agent=true"
    );
  });

  it("returns canonical room data for uppercase room IDs", async () => {
    const data = await loader({
      params: { roomId: "HNPXR6" },
      request: new Request("http://localhost/game/HNPXR6?agent=true"),
    } as never);

    expect(data).toEqual({
      roomId: "HNPXR6",
      agentState: null,
      agentQuickStart: true,
    });
  });
});
