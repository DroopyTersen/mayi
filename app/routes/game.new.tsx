import { redirect } from "react-router";
import type { Route } from "./+types/game.new";
import { generateRoomId } from "../../core/room/room-id.utils";

export function loader({}: Route.LoaderArgs) {
  return redirect(`/game/${generateRoomId()}`);
}
