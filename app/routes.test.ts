import { describe, expect, it } from "bun:test";

import routeConfig from "./routes";

describe("route config", () => {
  it("includes storybook routes in all builds", () => {
    expect(JSON.stringify(routeConfig)).toContain("storybook/*");
  });

  it("does not gate storybook on the build environment", async () => {
    const source = await Bun.file(new URL("./routes.ts", import.meta.url)).text();

    expect(source).not.toContain("NODE_ENV");
  });
});
