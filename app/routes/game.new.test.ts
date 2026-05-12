import { describe, expect, it } from "bun:test";
import { loader } from "./game.new";

describe("new game route", () => {
  it("redirects to a freshly generated game room", () => {
    const response = loader({} as never);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toMatch(
      /^\/game\/[A-Z0-9]{6}$/
    );
  });
});
