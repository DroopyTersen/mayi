import type { Route } from "./+types/game.$roomId";
import PartySocket from "partysocket";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LobbyView } from "~/ui/lobby/LobbyView";
import { GameView } from "~/ui/game-view/GameView";
import { MayIPromptDialog } from "~/ui/may-i-request/MayIPromptDialog";
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
  PlayerView,
  GameAction,
} from "~/party/protocol.types";
import type { Card } from "core/card/card.types";

type RoomPhase = "lobby" | "playing";

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

  // Phase 3.2: Room phase and game state
  const [roomPhase, setRoomPhase] = useState<RoomPhase>("lobby");
  const [gameState, setGameState] = useState<PlayerView | null>(null);

  // Phase 3.3: AI thinking indicator
  const [aiThinkingPlayerName, setAiThinkingPlayerName] = useState<
    string | undefined
  >(undefined);

  // Phase 3.6: May I prompt state
  const [mayIPrompt, setMayIPrompt] = useState<{
    callerId: string;
    callerName: string;
    card: Card;
  } | null>(null);

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

  // Phase 3.6: May I prompt actions
  const onAllowMayI = useCallback(() => {
    sendMessage({ type: "GAME_ACTION", action: { type: "ALLOW_MAY_I" } });
    setMayIPrompt(null);
  }, [sendMessage]);

  const onClaimMayI = useCallback(() => {
    sendMessage({ type: "GAME_ACTION", action: { type: "CLAIM_MAY_I" } });
    setMayIPrompt(null);
  }, [sendMessage]);

  // Phase 3.3: Handle game actions from GameView
  const onGameAction = useCallback(
    (action: string, payload?: unknown) => {
      // Map UI action strings to wire protocol actions
      let gameAction: GameAction | null = null;

      switch (action) {
        case "drawStock":
          gameAction = { type: "DRAW_FROM_STOCK" };
          break;
        case "pickUpDiscard":
          gameAction = { type: "DRAW_FROM_DISCARD" };
          break;
        case "discard": {
          // payload should have selectedCardIds
          const p = payload as { selectedCardIds?: string[] } | undefined;
          const cardId = p?.selectedCardIds?.[0];
          if (cardId) {
            gameAction = { type: "DISCARD", cardId };
          }
          break;
        }
        case "mayI":
          gameAction = { type: "CALL_MAY_I" };
          break;
        case "skip":
          gameAction = { type: "SKIP" };
          break;
        case "layDown": {
          // payload should have melds array
          const p = payload as { melds?: Array<{ type: "set" | "run"; cardIds: string[] }> } | undefined;
          if (p?.melds && p.melds.length > 0) {
            gameAction = { type: "LAY_DOWN", melds: p.melds };
          }
          break;
        }
        case "layOff": {
          // payload should have cardId and meldId
          const p = payload as { cardId?: string; meldId?: string } | undefined;
          if (p?.cardId && p?.meldId) {
            gameAction = { type: "LAY_OFF", cardId: p.cardId, meldId: p.meldId };
          }
          break;
        }
        case "swapJoker": {
          // payload should have meldId, jokerCardId, swapCardId
          const p = payload as { meldId?: string; jokerCardId?: string; swapCardId?: string } | undefined;
          if (p?.meldId && p?.jokerCardId && p?.swapCardId) {
            gameAction = { type: "SWAP_JOKER", meldId: p.meldId, jokerCardId: p.jokerCardId, swapCardId: p.swapCardId };
          }
          break;
        }
        case "reorderHand": {
          // payload should have cardIds array
          const p = payload as { cardIds?: string[] } | undefined;
          if (p?.cardIds && p.cardIds.length > 0) {
            gameAction = { type: "REORDER_HAND", cardIds: p.cardIds };
          }
          break;
        }
        default:
          console.log("Unhandled action:", action, payload);
          return;
      }

      if (gameAction) {
        sendMessage({ type: "GAME_ACTION", action: gameAction });
      }
    },
    [sendMessage]
  );

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
        // Phase 3: Game started
        case "GAME_STARTED": {
          setIsStartingGame(false);
          setRoomPhase("playing");
          setGameState(msg.state);
          return;
        }
        // Phase 3.4: Game state updates
        case "GAME_STATE": {
          setGameState(msg.state);
          return;
        }
        // Phase 3.3: AI thinking indicator
        case "AI_THINKING": {
          setAiThinkingPlayerName(msg.playerName);
          return;
        }
        case "AI_DONE": {
          setAiThinkingPlayerName(undefined);
          return;
        }
        // Phase 3.6: May I messages
        case "MAY_I_PROMPT": {
          setMayIPrompt({
            callerId: msg.callerId,
            callerName: msg.callerName,
            card: msg.card,
          });
          return;
        }
        case "MAY_I_RESOLVED": {
          setMayIPrompt(null);
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

  // Determine if current player can also claim (May I instead)
  // This requires checking if they have May I count remaining
  const canMayIInstead = useMemo(() => {
    if (!gameState) return false;
    // In this simplified version, assume player can always claim if prompted
    // TODO: Check mayICount when it's available in PlayerView
    return true;
  }, [gameState]);

  // Phase 3.3: Render lobby or game based on room phase
  if (roomPhase === "playing" && gameState) {
    return (
      <>
        <GameView
          gameState={gameState}
          aiThinkingPlayerName={aiThinkingPlayerName}
          onAction={onGameAction}
        />
        {/* Phase 3.6: May I Prompt Dialog */}
        {mayIPrompt && (
          <MayIPromptDialog
            open={true}
            callerName={mayIPrompt.callerName}
            card={mayIPrompt.card}
            canMayIInstead={canMayIInstead}
            onAllow={onAllowMayI}
            onMayIInstead={onClaimMayI}
            onOpenChange={(open) => {
              if (!open) setMayIPrompt(null);
            }}
          />
        )}
      </>
    );
  }

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
