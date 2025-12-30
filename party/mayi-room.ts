import { Server, type Connection, type ConnectionContext } from "partyserver";

export class MayIRoom extends Server {
  static override options = { hibernate: true };

  override onConnect(conn: Connection, ctx: ConnectionContext) {
    conn.send(
      JSON.stringify({
        type: "CONNECTED",
        roomId: this.name,
        message: "Phase 1 stub - no game logic yet",
      })
    );
  }

  override onMessage(conn: Connection, message: string) {
    // Broadcast to all connected clients
    this.broadcast(
      JSON.stringify({
        type: "BROADCAST",
        from: conn.id,
        received: message,
      })
    );
  }
}
