import { describe, expect, it } from "bun:test";
import { Button } from "./button";

describe("Button", () => {
  it("is a forwardRef component", () => {
    const forwardRefSymbol = Symbol.for("react.forward_ref");
    const buttonSymbol = (Button as { $$typeof?: symbol }).$$typeof;

    expect(buttonSymbol).toBe(forwardRefSymbol);
  });
});
