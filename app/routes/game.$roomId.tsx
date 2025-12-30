import type { Route } from "./+types/game.$roomId";
import usePartySocket from "partysocket/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Game: ${params.roomId}` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  return { roomId: params.roomId };
}

export default function Game({ loaderData }: Route.ComponentProps) {
  const { roomId } = loaderData;
  const [status, setStatus] = useState("Connecting...");
  const [messages, setMessages] = useState<string[]>([]);

  const socket = usePartySocket({
    host: typeof window !== "undefined" ? window.location.host : "",
    room: roomId,
    party: "may-i-room",

    onOpen() {
      setStatus("Connected");
    },
    onMessage(event) {
      setMessages((prev) => [...prev, event.data]);
    },
    onClose() {
      setStatus("Disconnected");
    },
  });

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Game: {roomId}</CardTitle>
          <CardDescription>
            Status:{" "}
            <span
              className={
                status === "Connected" ? "text-green-600" : "text-yellow-600"
              }
            >
              {status}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Button
            onClick={() =>
              socket?.send(
                JSON.stringify({ type: "TEST", timestamp: Date.now() })
              )
            }
          >
            Send Test Message
          </Button>

          <div>
            <h2 className="text-lg font-semibold mb-3">Messages</h2>
            <ul className="space-y-2">
              {messages.map((msg, i) => (
                <li
                  key={i}
                  className="font-mono text-sm bg-muted p-3 rounded-md break-all"
                >
                  {msg}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
