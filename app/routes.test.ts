import { describe, expect, it } from "bun:test";

import routeConfig from "./routes";

describe("route config", () => {
  it("matches the fresh game route before dynamic room IDs", () => {
    const gameNewIndex = routeConfig.findIndex(
      (route) => "path" in route && route.path === "game/new"
    );
    const gameRoomIndex = routeConfig.findIndex(
      (route) => "path" in route && route.path === "game/:roomId"
    );

    expect(gameNewIndex).toBeGreaterThan(-1);
    expect(gameRoomIndex).toBeGreaterThan(-1);
    expect(gameNewIndex).toBeLessThan(gameRoomIndex);
  });

  it("includes storybook routes in all builds", () => {
    expect(JSON.stringify(routeConfig)).toContain("storybook/*");
  });

  it("includes the mobile May-I repro route for local/ngrok debugging", () => {
    expect(JSON.stringify(routeConfig)).toContain("debug/mayi-mobile-repro");
  });

  it("does not gate storybook on the build environment", async () => {
    const source = await Bun.file(new URL("./routes.ts", import.meta.url)).text();

    expect(source).not.toContain("NODE_ENV");
  });
});
