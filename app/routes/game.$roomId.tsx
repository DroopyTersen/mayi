import type { Route } from "./+types/game.$roomId";
import PartySocket from "partysocket";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LobbyView } from "~/ui/lobby/LobbyView";
import type {
  ConnectionStatus,
  JoinStatus,
  PlayerInfo,
} from "~/ui/lobby/lobby.types";

type ClientMessage = {
  type: "JOIN";
  playerId: string;
  playerName: string;
};

type ServerMessage =
  | { type: "CONNECTED"; roomId: string }
  | { type: "JOINED"; playerId: string; playerName: string }
  | { type: "PLAYERS"; players: PlayerInfo[] }
  | { type: "ERROR"; error: string; message: string };

function getPlayerIdKey(roomId: string) {
  return `mayi:room:${roomId}:playerId`;
}

function getPlayerNameKey(roomId: string) {
  return `mayi:room:${roomId}:playerName`;
}

function getOrCreatePlayerId(roomId: string): string {
  const key = getPlayerIdKey(roomId);
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;

  const playerId = nanoid(12);
  sessionStorage.setItem(key, playerId);
  return playerId;
}

function getStoredPlayerName(roomId: string): string | null {
  return sessionStorage.getItem(getPlayerNameKey(roomId));
}

function storePlayerName(roomId: string, name: string) {
  sessionStorage.setItem(getPlayerNameKey(roomId), name);
}

export function meta({ params }: Route.MetaArgs) {
  return [{ title: params.roomId ? `Game: ${params.roomId}` : "Game" }];
}

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.roomId) {
    throw new Response("Missing roomId", { status: 404 });
  }
  return { roomId: params.roomId };
}

export default function Game({ loaderData }: Route.ComponentProps) {
  const { roomId } = loaderData;
  const socketRef = useRef<PartySocket | null>(null);

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [joinStatus, setJoinStatus] = useState<JoinStatus>("unjoined");
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | undefined>(undefined);

  const sendJoin = useCallback(
    (playerId: string, playerName: string) => {
      const socket = socketRef.current;
      if (!socket) return;

      const msg: ClientMessage = { type: "JOIN", playerId, playerName };
      socket.send(JSON.stringify(msg));
    },
    []
  );

  const onJoin = useCallback(
    (name: string) => {
      const playerId = currentPlayerId ?? getOrCreatePlayerId(roomId);
      if (playerId !== currentPlayerId) {
        setCurrentPlayerId(playerId);
      }
      storePlayerName(roomId, name);

      setShowNamePrompt(false);
      setJoinStatus("joining");
      sendJoin(playerId, name);
    },
    [currentPlayerId, roomId, sendJoin]
  );

  const shareUrlForRoom = useMemo(() => {
    // During SSR this is undefined; it is set on the client in an effect below.
    return shareUrl;
  }, [shareUrl]);

  useEffect(() => {
    // Client-only: sessionStorage + websocket
    const playerId = getOrCreatePlayerId(roomId);
    setCurrentPlayerId(playerId);

    const storedName = getStoredPlayerName(roomId);
    setShareUrl(new URL(`/game/${roomId}`, window.location.origin).toString());

    setConnectionStatus("connecting");

    const socket = new PartySocket({
      host: window.location.host,
      room: roomId,
      party: "may-i-room",
      startClosed: true,
    });
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus("connected");

      if (storedName) {
        setShowNamePrompt(false);
        setJoinStatus("joining");
        sendJoin(playerId, storedName);
      } else {
        setJoinStatus("unjoined");
        setShowNamePrompt(true);
      }
    };

    socket.onclose = () => {
      setConnectionStatus("disconnected");
      // Keep joinStatus as-is (more forgiving UX); we auto-join on reconnect anyway.
    };

    socket.onerror = () => {
      // Treat errors like a disconnect from a UI perspective.
      setConnectionStatus("disconnected");
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;

      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case "CONNECTED": {
          // no-op for Phase 2 (we already know roomId)
          return;
        }
        case "PLAYERS": {
          setPlayers(msg.players);
          return;
        }
        case "JOINED": {
          setJoinStatus("joined");
          setShowNamePrompt(false);

          // Ensure we persist the final server-accepted name.
          storePlayerName(roomId, msg.playerName);
          return;
        }
        case "ERROR": {
          // Reset join flow; allow the user to retry.
          setJoinStatus("unjoined");
          setShowNamePrompt(true);
          return;
        }
      }
    };

    socket.reconnect();

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, sendJoin]);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <LobbyView
        roomId={roomId}
        shareUrl={shareUrlForRoom}
        connectionStatus={connectionStatus}
        joinStatus={joinStatus}
        players={players}
        currentPlayerId={currentPlayerId}
        showNamePrompt={showNamePrompt}
        onNamePromptChange={setShowNamePrompt}
        onJoin={onJoin}
      />
    </main>
  );
}
