// Type declarations for Vite virtual modules used by React Router
declare module "virtual:react-router/server-build" {
  import type { ServerBuild } from "react-router";
  const build: ServerBuild;
  export = build;
}
