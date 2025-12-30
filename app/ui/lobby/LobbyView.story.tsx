import { useState } from "react";
import { LobbyView } from "./LobbyView";
import { LobbyPlayersList } from "./LobbyPlayersList";
import { ShareLinkCard } from "./ShareLinkCard";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { NamePromptDialog } from "./NamePromptDialog";
import { ViewportComparison } from "~/storybook/ViewportSimulator";
import type { PlayerInfo, ConnectionStatus } from "./lobby.types";

const SAMPLE_PLAYERS: PlayerInfo[] = [
  {
    playerId: "player-1",
    name: "Alice",
    isConnected: true,
    disconnectedAt: null,
  },
  {
    playerId: "player-2",
    name: "Bob",
    isConnected: true,
    disconnectedAt: null,
  },
  {
    playerId: "player-3",
    name: "Charlie",
    isConnected: false,
    disconnectedAt: Date.now() - 2 * 60 * 1000, // 2 minutes ago
  },
  {
    playerId: "player-4",
    name: "Diana",
    isConnected: false,
    disconnectedAt: Date.now() - 30 * 1000, // 30 seconds ago
  },
];

function InteractiveLobby() {
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [players, setPlayers] = useState<PlayerInfo[]>(SAMPLE_PLAYERS);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  const handleJoin = (name: string) => {
    const newPlayer: PlayerInfo = {
      playerId: `player-${Date.now()}`,
      name,
      isConnected: true,
      disconnectedAt: null,
    };
    setPlayers((prev) => [...prev, newPlayer]);
    setCurrentPlayerId(newPlayer.playerId);
    setShowNamePrompt(false);
  };

  return (
    <div className="max-w-md space-y-4">
      <LobbyView
        roomId="abc-123"
        shareUrl="https://mayi.example.com/game/abc-123"
        connectionStatus="connected"
        joinStatus={currentPlayerId ? "joined" : "unjoined"}
        players={players}
        currentPlayerId={currentPlayerId}
        showNamePrompt={showNamePrompt}
        onNamePromptChange={setShowNamePrompt}
        onJoin={handleJoin}
      />
      {!currentPlayerId && (
        <button
          onClick={() => setShowNamePrompt(true)}
          className="text-sm text-primary underline"
        >
          Open name prompt
        </button>
      )}
    </div>
  );
}

function NamePromptDemo() {
  const [open, setOpen] = useState(false);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
      >
        Open Name Prompt
      </button>
      <NamePromptDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(name) => {
          setSubmittedName(name);
          setOpen(false);
        }}
      />
      {submittedName && (
        <p className="text-sm text-muted-foreground">
          Submitted: <strong>{submittedName}</strong>
        </p>
      )}
    </div>
  );
}

export function LobbyViewStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">Lobby Components</h1>
        <p className="text-muted-foreground mt-1">
          Components for the game lobby / waiting room.
        </p>
      </header>

      {/* Connection Status Indicator */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Connection Status Indicator</h2>
        <div className="flex gap-6">
          <div className="text-center">
            <ConnectionStatusIndicator status="connecting" />
            <p className="text-xs text-muted-foreground mt-1">Connecting</p>
          </div>
          <div className="text-center">
            <ConnectionStatusIndicator status="connected" />
            <p className="text-xs text-muted-foreground mt-1">Connected</p>
          </div>
          <div className="text-center">
            <ConnectionStatusIndicator status="disconnected" />
            <p className="text-xs text-muted-foreground mt-1">Disconnected</p>
          </div>
        </div>
      </section>

      {/* Lobby Players List */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Lobby Players List</h2>
        <div className="max-w-md space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              With current player highlighted
            </p>
            <LobbyPlayersList
              players={SAMPLE_PLAYERS}
              currentPlayerId="player-1"
            />
          </div>
        </div>
      </section>

      {/* Empty Players List */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Empty Lobby</h2>
        <div className="max-w-md">
          <LobbyPlayersList players={[]} />
        </div>
      </section>

      {/* Share Link Card */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Share Link Card</h2>
        <div className="max-w-md">
          <ShareLinkCard
            roomId="abc-123"
            shareUrl="https://mayi.example.com/game/abc-123"
          />
        </div>
      </section>

      {/* Name Prompt Dialog */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Name Prompt Dialog</h2>
        <NamePromptDemo />
      </section>

      {/* Full Lobby View */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Full Lobby View</h2>
        <InteractiveLobby />
      </section>

      {/* Lobby States */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Lobby States</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Connecting</p>
            <LobbyView
              roomId="test-1"
              connectionStatus="connecting"
              joinStatus="unjoined"
              players={[]}
              currentPlayerId={null}
              showNamePrompt={false}
              onNamePromptChange={() => {}}
              onJoin={() => {}}
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Disconnected</p>
            <LobbyView
              roomId="test-2"
              connectionStatus="disconnected"
              joinStatus="unjoined"
              players={SAMPLE_PLAYERS}
              currentPlayerId="player-1"
              showNamePrompt={false}
              onNamePromptChange={() => {}}
              onJoin={() => {}}
            />
          </div>
        </div>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the lobby adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="p-4">
            <LobbyView
              roomId="responsive-test"
              shareUrl="https://mayi.example.com/game/responsive-test"
              connectionStatus="connected"
              joinStatus="joined"
              players={SAMPLE_PLAYERS}
              currentPlayerId="player-1"
              showNamePrompt={false}
              onNamePromptChange={() => {}}
              onJoin={() => {}}
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
