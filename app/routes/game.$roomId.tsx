import type { Route } from "./+types/game.$roomId";
import PartySocket from "partysocket";
import { nanoid } from "nanoid";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { LobbyView } from "~/ui/lobby/LobbyView";
import { GameView } from "~/ui/game-view/GameView";
import { MayIPromptDialog } from "~/ui/may-i-request/MayIPromptDialog";
import { RoundEndOverlay } from "~/ui/game-transitions/RoundEndOverlay";
import { GameEndScreen } from "~/ui/game-transitions/GameEndScreen";
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
  ActivityLogEntry,
} from "~/party/protocol.types";
import { decodeAndParseAgentTestState } from "~/party/agent-state.validation";
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

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!params.roomId) {
    throw new Response("Missing roomId", { status: 404 });
  }

  // Check for agent test state in query params
  const url = new URL(request.url);
  const agentStateParam = url.searchParams.get("agentState");

  return {
    roomId: params.roomId,
    agentState: agentStateParam,
  };
}

export default function Game({ loaderData }: Route.ComponentProps) {
  const { roomId, agentState: agentStateEncoded } = loaderData;
  const socketRef = useRef<PartySocket | null>(null);
  const agentStateInjectedRef = useRef(false);

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
  const roomPhaseRef = useRef<RoomPhase>("lobby");
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

  // Phase 3.8: Round/game end state
  const [roundEndData, setRoundEndData] = useState<{
    roundNumber: number;
    scores: Record<string, number>;
    playerNames: Record<string, string>;
  } | null>(null);

  const [gameEndData, setGameEndData] = useState<{
    finalScores: Record<string, number>;
    winnerId: string;
    playerNames: Record<string, string>;
  } | null>(null);

  // Game action error state
  const [gameError, setGameError] = useState<string | null>(null);

  // Activity log state
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // Keep roomPhaseRef in sync with roomPhase state
  useEffect(() => {
    roomPhaseRef.current = roomPhase;
  }, [roomPhase]);

  // Debug: log when gameError changes
  useEffect(() => {
    console.log("[gameError state changed]", gameError);
  }, [gameError]);

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
      console.log("[onGameAction] Called with action:", action, "payload:", payload);
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
          console.log("[onGameAction] discard - extracted cardId:", cardId);
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
          // payload should have cardId, meldId, and optional position for wild cards
          const p = payload as { cardId?: string; meldId?: string; position?: "start" | "end" } | undefined;
          if (p?.cardId && p?.meldId) {
            gameAction = { type: "LAY_OFF", cardId: p.cardId, meldId: p.meldId, position: p.position };
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
        console.log("[onGameAction] Sending game action:", gameAction);
        sendMessage({ type: "GAME_ACTION", action: gameAction });
      } else {
        console.log("[onGameAction] No game action to send (gameAction is null)");
      }
    },
    [sendMessage]
  );

  useEffect(() => {
    // Client-only: sessionStorage + websocket
    let parsedAgentState: ReturnType<typeof decodeAndParseAgentTestState> | null =
      null;
    if (import.meta.env.MODE !== "production" && agentStateEncoded) {
      parsedAgentState = decodeAndParseAgentTestState(agentStateEncoded);
      if (parsedAgentState.success) {
        const injectedHuman = parsedAgentState.data.players.find((p) => !p.isAI);
        if (injectedHuman) {
          sessionStorage.setItem(getPlayerIdKey(roomId), injectedHuman.id);
          sessionStorage.setItem(getPlayerNameKey(roomId), injectedHuman.name);
        }
      }
    }

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

      // Check for agent state injection
      if (
        import.meta.env.MODE !== "production" &&
        agentStateEncoded &&
        !agentStateInjectedRef.current
      ) {
        if (parsedAgentState?.success) {
          // Inject state - this will auto-join us as the first human player
          agentStateInjectedRef.current = true;
          socket.send(JSON.stringify({
            type: "INJECT_STATE",
            state: parsedAgentState.data,
          }));
          setShowNamePrompt(false);
          setJoinStatus("joining");
          return;
        } else {
          const error =
            parsedAgentState && !parsedAgentState.success
              ? parsedAgentState.error
              : "Unknown error";
          console.error("Failed to parse agent state:", error);
        }
      }

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

          // Server is authoritative for playerId. This is critical for agentState
          // injection, where the injected human playerId must persist across reloads.
          setCurrentPlayerId(msg.playerId);
          sessionStorage.setItem(getPlayerIdKey(roomId), msg.playerId);

          // Ensure we persist the final server-accepted name.
          storePlayerName(roomId, msg.playerName);
          return;
        }
        case "ERROR": {
          // Use ref to get current roomPhase (avoids stale closure)
          const currentPhase = roomPhaseRef.current;
          console.log("[ERROR handler] Received error:", msg.error, msg.message, "roomPhase:", currentPhase);
          // Check if we're in game phase - show game error
          if (currentPhase === "playing") {
            console.log("[ERROR handler] Setting game error:", msg.message);
            setGameError(msg.message);
            // Auto-clear error after 5 seconds
            setTimeout(() => setGameError(null), 5000);
            return;
          }
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
          setActivityLog(msg.activityLog ?? []);
          return;
        }
        // Phase 3.4: Game state updates
        case "GAME_STATE": {
          setGameState(msg.state);
          setActivityLog(msg.activityLog ?? []);
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
        // Phase 3.8: Round/game end messages
        case "ROUND_ENDED": {
          setRoundEndData({
            roundNumber: msg.roundNumber,
            scores: msg.scores,
            playerNames: msg.playerNames,
          });
          return;
        }
        case "GAME_ENDED": {
          setGameEndData({
            finalScores: msg.finalScores,
            winnerId: msg.winnerId,
            playerNames: msg.playerNames,
          });
          return;
        }
      }
    };

    socket.reconnect();

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, sendJoin, agentStateEncoded]);

  // Determine if current player can also claim (May I instead)
  // This requires checking if they have May I count remaining
  const canMayIInstead = useMemo(() => {
    if (!gameState) return false;
    // In this simplified version, assume player can always claim if prompted
    // TODO: Check mayICount when it's available in PlayerView
    return true;
  }, [gameState]);

  // Handler for leaving game
  const onLeaveGame = useCallback(() => {
    window.location.href = "/";
  }, []);

  // Format activity log for GameView
  const formattedActivityLog = useMemo(() => {
    return activityLog.map((entry) => {
      // Format: "PlayerName: action details"
      const message = entry.details
        ? `${entry.playerName}: ${entry.action} ${entry.details}`
        : `${entry.playerName}: ${entry.action}`;
      return {
        id: entry.id,
        message,
        // Don't include timestamp - it clutters the UI
      };
    });
  }, [activityLog]);

  // Phase 3.3: Render lobby or game based on room phase
  if (roomPhase === "playing" && gameState) {
    return (
      <>
        <GameView
          gameState={gameState}
          aiThinkingPlayerName={aiThinkingPlayerName}
          activityLog={formattedActivityLog}
          onAction={onGameAction}
          errorMessage={gameError}
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
        {/* Phase 3.8: Round End Overlay */}
        {roundEndData && !gameEndData && (
          <RoundEndOverlay
            roundNumber={roundEndData.roundNumber}
            scores={roundEndData.scores}
            playerNames={roundEndData.playerNames}
            currentPlayerId={currentPlayerId ?? ""}
            onDismiss={() => setRoundEndData(null)}
          />
        )}
        {/* Phase 3.8: Game End Screen */}
        {gameEndData && (
          <GameEndScreen
            finalScores={gameEndData.finalScores}
            winnerId={gameEndData.winnerId}
            playerNames={gameEndData.playerNames}
            currentPlayerId={currentPlayerId ?? ""}
            onLeave={onLeaveGame}
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
