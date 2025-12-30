import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("game/:roomId", "routes/game.$roomId.tsx"),
] satisfies RouteConfig;
