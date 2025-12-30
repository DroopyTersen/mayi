import type { Route } from "./+types/game.$roomId";
import PartySocket from "partysocket";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LobbyView } from "~/ui/lobby/LobbyView";
import type {
  ConnectionStatus,
  JoinStatus,
  PlayerInfo,
  LobbyGameSettings,
  AIModelId,
  RoundNumber,
} from "~/ui/lobby/lobby.types";
import type {
  ClientMessage,
  ServerMessage,
} from "~/party/protocol.types";

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

  // Phase 3: Game settings state
  const [gameSettings, setGameSettings] = useState<LobbyGameSettings>({
    aiPlayers: [],
    startingRound: 1,
    canStart: false,
  });
  const [isStartingGame, setIsStartingGame] = useState(false);

  // Check if current player is the host (first player to join)
  const isHost = useMemo(() => {
    if (!currentPlayerId || players.length === 0) return false;
    // The first player in the list is the host
    return players[0]?.playerId === currentPlayerId;
  }, [currentPlayerId, players]);

  const sendMessage = useCallback((msg: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.send(JSON.stringify(msg));
  }, []);

  const sendJoin = useCallback(
    (playerId: string, playerName: string) => {
      sendMessage({ type: "JOIN", playerId, playerName });
    },
    [sendMessage]
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

  // Phase 3: Callbacks for game setup
  const onAddAIPlayer = useCallback(
    (name: string, modelId: AIModelId) => {
      sendMessage({ type: "ADD_AI_PLAYER", name, modelId });
    },
    [sendMessage]
  );

  const onRemoveAIPlayer = useCallback(
    (playerId: string) => {
      sendMessage({ type: "REMOVE_AI_PLAYER", playerId });
    },
    [sendMessage]
  );

  const onSetStartingRound = useCallback(
    (round: RoundNumber) => {
      sendMessage({ type: "SET_STARTING_ROUND", round });
    },
    [sendMessage]
  );

  const onStartGame = useCallback(() => {
    setIsStartingGame(true);
    sendMessage({ type: "START_GAME" });
  }, [sendMessage]);

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
          setIsStartingGame(false);
          return;
        }
        // Phase 3: Lobby state updates
        case "LOBBY_STATE": {
          setGameSettings({
            aiPlayers: msg.lobbyState.aiPlayers,
            startingRound: msg.lobbyState.startingRound,
            canStart: msg.lobbyState.canStart,
          });
          return;
        }
        // Phase 3: Game started (to be fully implemented in Phase 3.2)
        case "GAME_STARTED": {
          setIsStartingGame(false);
          // TODO: Navigate to game view
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
        // Phase 3: Game settings and callbacks
        gameSettings={gameSettings}
        isHost={isHost}
        onAddAIPlayer={onAddAIPlayer}
        onRemoveAIPlayer={onRemoveAIPlayer}
        onSetStartingRound={onSetStartingRound}
        onStartGame={onStartGame}
        isStartingGame={isStartingGame}
      />
    </main>
  );
}
