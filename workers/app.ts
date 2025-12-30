import { createRequestHandler } from "react-router";
import { routePartykitRequest } from "partyserver";

export { MayIRoom } from "../party/mayi-room";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: { env: Env; ctx: ExecutionContext };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    // Try PartyServer first (WebSocket upgrades)
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;

    // Fall through to React Router
    return requestHandler(request, { cloudflare: { env, ctx } });
  },
} satisfies ExportedHandler<Env>;
