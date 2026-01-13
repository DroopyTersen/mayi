import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // Agent testing routes
  route("game/agent/new", "routes/game.agent.new.tsx"),
  route("game/agent/state/:state", "routes/game.agent.state.$state.tsx"),
  route("game/:roomId", "routes/game.$roomId.tsx"),
  route("storybook/*", "storybook/StorybookLayout.tsx"),
] satisfies RouteConfig;
