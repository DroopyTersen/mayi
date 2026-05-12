import { describe, expect, it } from "bun:test";
import { action } from "./home";

function createJoinRequest(roomId: string) {
  const formData = new FormData();
  formData.set("intent", "join");
  formData.set("roomId", roomId);

  return new Request("http://localhost/", {
    method: "POST",
    body: formData,
  });
}

describe("home action", () => {
  it("normalizes joined room IDs before redirecting", async () => {
    const response = await action({
      request: createJoinRequest(" hnpxr6 "),
    } as never);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe("/game/HNPXR6");
  });
});
