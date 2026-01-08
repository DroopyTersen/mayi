import { useState } from "react";
import { GameView } from "./GameView";
import type { PlayerView } from "~/party/protocol.types";
import type { Meld } from "core/meld/meld.types";
import type { Card } from "core/card/card.types";
import { ViewportSimulator, ViewportComparison } from "~/storybook/ViewportSimulator";
import { DiscardPileDisplay } from "~/ui/game-table/DiscardPileDisplay";
import { StockPileDisplay } from "~/ui/game-table/StockPileDisplay";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { TableDisplay } from "~/ui/game-table/TableDisplay";
import { cn } from "~/shadcn/lib/utils";

// Mock data for a 4-player game where everyone has laid down
const MOCK_PLAYERS = [
  { id: "p1", name: "You" },
  { id: "p2", name: "Alice" },
  { id: "p3", name: "Bob" },
  { id: "p4", name: "Charlie" },
];

// Generate cards helper
function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

// Create extensive melds for all 4 players (simulates late-game scenario)
const MOCK_TABLE_MELDS: Meld[] = [
  // Player 1 (You) - 2 sets
  {
    id: "meld-1",
    type: "set",
    ownerId: "p1",
    cards: [
      card("c1", "Q", "hearts"),
      card("c2", "Q", "diamonds"),
      card("c3", "Q", "clubs"),
      card("c4", "Q", "spades"),
    ],
  },
  {
    id: "meld-2",
    type: "set",
    ownerId: "p1",
    cards: [
      card("c5", "5", "hearts"),
      card("c6", "5", "diamonds"),
      card("c7", "5", "clubs"),
    ],
  },
  // Player 2 (Alice) - 2 sets with extended melds
  {
    id: "meld-3",
    type: "set",
    ownerId: "p2",
    cards: [
      card("c8", "8", "hearts"),
      card("c9", "8", "diamonds"),
      card("c10", "8", "clubs"),
      card("c11", "8", "spades"),
    ],
  },
  {
    id: "meld-4",
    type: "set",
    ownerId: "p2",
    cards: [
      card("c12", "3", "hearts"),
      card("c13", "3", "diamonds"),
      card("c14", "3", "clubs"),
    ],
  },
  // Player 3 (Bob) - 2 sets
  {
    id: "meld-5",
    type: "set",
    ownerId: "p3",
    cards: [
      card("c15", "K", "hearts"),
      card("c16", "K", "diamonds"),
      card("c17", "K", "clubs"),
    ],
  },
  {
    id: "meld-6",
    type: "set",
    ownerId: "p3",
    cards: [
      card("c18", "9", "hearts"),
      card("c19", "9", "diamonds"),
      card("c20", "9", "clubs"),
      card("c21", "9", "spades"),
    ],
  },
  // Player 4 (Charlie) - 2 sets
  {
    id: "meld-7",
    type: "set",
    ownerId: "p4",
    cards: [
      card("c22", "A", "hearts"),
      card("c23", "A", "diamonds"),
      card("c24", "A", "clubs"),
    ],
  },
  {
    id: "meld-8",
    type: "set",
    ownerId: "p4",
    cards: [
      card("c25", "7", "hearts"),
      card("c26", "7", "diamonds"),
      card("c27", "7", "clubs"),
      card("c28", "7", "spades"),
    ],
  },
];

// Mock hand for the viewing player
const MOCK_HAND: Card[] = [
  card("h1", "4", "hearts"),
  card("h2", "6", "spades"),
  card("h3", "10", "diamonds"),
];

// Full game state for storybook
const MOCK_GAME_STATE: PlayerView = {
  gameId: "story-game",
  viewingPlayerId: "p1",
  yourHand: MOCK_HAND,
  isYourTurn: false,
  youAreDown: true,
  yourTotalScore: 45,
  opponents: [
    { id: "p2", name: "Alice", handCount: 2, isDown: true, totalScore: 30, isDealer: false, isCurrentPlayer: true },
    { id: "p3", name: "Bob", handCount: 4, isDown: true, totalScore: 55, isDealer: false, isCurrentPlayer: false },
    { id: "p4", name: "Charlie", handCount: 1, isDown: true, totalScore: 20, isDealer: true, isCurrentPlayer: false },
  ],
  currentRound: 1,
  contract: { roundNumber: 1, sets: 2, runs: 0 },
  phase: "ROUND_ACTIVE",
  turnPhase: "AWAITING_DISCARD",
  turnNumber: 15,
  awaitingPlayerId: "p2",
  stockCount: 30,
  topDiscard: card("d1", "3", "hearts"),
  discardCount: 12,
  table: MOCK_TABLE_MELDS,
  roundHistory: [],
  mayIContext: null,
  availableActions: {
    canDrawFromStock: false,
    canDrawFromDiscard: false,
    canLayDown: false,
    canLayOff: false,
    canSwapJoker: false,
    canDiscard: false,
    canMayI: true, // Can call May I on Alice's turn
    canAllowMayI: false,
    canClaimMayI: false,
  },
  turnOrder: ["p1", "p2", "p3", "p4"],
};

// Activity log for realistic display
const MOCK_ACTIVITY = [
  { id: "1", message: "Alice: drew from the draw pile" },
  { id: "2", message: "Bob: laid off 9♠ to Bob's set" },
  { id: "3", message: "Bob: discarded 7♦" },
  { id: "4", message: "Charlie: drew from the draw pile" },
  { id: "5", message: "Charlie: discarded 3♥" },
  { id: "6", message: "You: drew from the draw pile" },
];

export function GameViewStory() {
  const [selectedState] = useState<PlayerView>(MOCK_GAME_STATE);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">GameView - Layout Experiments</h1>
        <p className="text-muted-foreground mt-1">
          Testing layout improvements for 4-player games with many melds.
        </p>
        <p className="text-sm text-amber-600 mt-2">
          Problem: When 4 players have melds laid down, the Table section takes too much vertical space.
          The discard/draw piles at the top push melds down, requiring scrolling.
        </p>
      </header>

      {/* Current Layout - Full width to show the problem */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Current Layout (Desktop)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          The draw piles are at the top of the Table section. With 4 players having melds,
          you need to scroll to see all the melds.
        </p>
        <div className="border rounded-lg overflow-hidden" style={{ height: "700px" }}>
          <GameView
            gameState={selectedState}
            activityLog={MOCK_ACTIVITY}
            onAction={(action) => console.log("Action:", action)}
          />
        </div>
      </section>

      {/* Viewport Comparison */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the current layout behaves at different viewport sizes.
        </p>
        <ViewportComparison viewports={["phone", "tablet", "desktop"]}>
          <div style={{ height: "600px", overflow: "auto" }}>
            <GameView
              gameState={selectedState}
              activityLog={MOCK_ACTIVITY}
              onAction={(action) => console.log("Action:", action)}
            />
          </div>
        </ViewportComparison>
      </section>

      {/* Interactive viewport switcher */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive Viewport</h2>
        <ViewportSimulator defaultViewport="desktop">
          <div style={{ height: "700px", overflow: "auto" }}>
            <GameView
              gameState={selectedState}
              activityLog={MOCK_ACTIVITY}
              onAction={(action) => console.log("Action:", action)}
            />
          </div>
        </ViewportSimulator>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LAYOUT EXPERIMENTS */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div className="border-t-4 border-primary pt-10 mt-10">
        <h1 className="text-2xl font-bold text-primary mb-2">Layout Experiments</h1>
        <p className="text-muted-foreground mb-8">
          Below are mockups of proposed layout changes where the piles are moved next to the hand.
        </p>
      </div>

      {/* Option A: Piles Left of Hand (Desktop) */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Option A: Piles Left of Hand</h2>
        <p className="text-sm text-muted-foreground mb-4">
          On desktop, the discard/draw piles appear to the left of your hand in the bottom section.
          This frees up vertical space in the Table section for melds.
        </p>

        <div className="border rounded-lg bg-background">
          {/* Simulated Table Section WITHOUT piles */}
          <div className="p-4 border-b">
            <div className="text-xs text-muted-foreground mb-2 font-medium">Table (melds only - no piles)</div>
            <TableDisplay
              melds={MOCK_TABLE_MELDS}
              players={MOCK_PLAYERS}
              currentPlayerId="p2"
              viewingPlayerId="p1"
            />
          </div>

          {/* Bottom section with piles + hand */}
          <div className="sticky bottom-0 bg-background border-t p-4">
            <div className="text-xs text-muted-foreground mb-2 font-medium">Your Hand + Piles (desktop layout)</div>
            <div className="flex items-end gap-6">
              {/* Piles on the left */}
              <div className="flex gap-2 shrink-0">
                <DiscardPileDisplay
                  topCard={card("d1", "3", "hearts")}
                  size="md"
                  interactiveLabel="may-i"
                />
                <StockPileDisplay size="md" />
              </div>

              {/* Hand takes remaining space */}
              <div className="flex-1 min-w-0">
                <HandDisplay
                  cards={MOCK_HAND}
                  size="lg"
                  className="justify-center"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Responsive versions */}
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-3">Responsive Behavior</h3>
          <ViewportComparison viewports={["phone", "tablet", "desktop"]}>
            <div className="bg-background p-3">
              {/* Phone/Tablet: Piles above hand */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-6">
                <div className="flex gap-2 justify-center lg:justify-start shrink-0">
                  <DiscardPileDisplay
                    topCard={card("d1", "3", "hearts")}
                    size="sm"
                    interactiveLabel="may-i"
                  />
                  <StockPileDisplay size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <HandDisplay
                    cards={MOCK_HAND}
                    size="auto"
                    className="justify-center"
                  />
                </div>
              </div>
            </div>
          </ViewportComparison>
        </div>
      </section>

      {/* Option B: Compact Inline Layout */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-2">Option B: Compact Inline with Separator</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Piles and hand on the same row with a visual separator. More compact but may feel cramped.
        </p>

        <div className="border rounded-lg bg-background p-4">
          <div className="flex items-end gap-4">
            {/* Piles */}
            <div className="flex gap-2 shrink-0">
              <DiscardPileDisplay
                topCard={card("d1", "3", "hearts")}
                size="md"
                interactiveLabel="may-i"
              />
              <StockPileDisplay size="md" />
            </div>

            {/* Separator */}
            <div className="w-px h-24 bg-border shrink-0" />

            {/* Hand */}
            <div className="flex-1 min-w-0">
              <HandDisplay
                cards={MOCK_HAND}
                size="lg"
                className="justify-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Option C: Stacked Mobile Layout */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-2">Option C: Mobile - Piles Above Hand</h2>
        <p className="text-sm text-muted-foreground mb-4">
          On mobile, piles stack above the hand. Clean and simple.
        </p>

        <ViewportSimulator defaultViewport="phone">
          <div className="bg-background p-3 space-y-3">
            {/* Turn status */}
            <div className="text-sm text-muted-foreground text-center">
              Waiting for Alice
            </div>

            {/* Piles centered above */}
            <div className="flex gap-3 justify-center">
              <DiscardPileDisplay
                topCard={card("d1", "3", "hearts")}
                size="sm"
                interactiveLabel="may-i"
              />
              <StockPileDisplay size="sm" />
            </div>

            {/* Hand below */}
            <HandDisplay
              cards={MOCK_HAND}
              size="auto"
              className="justify-center"
            />
          </div>
        </ViewportSimulator>
      </section>

      {/* Summary */}
      <section className="mt-10 p-6 bg-muted/50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Summary of Options</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <strong>Option A:</strong> Piles left of hand on desktop, above on mobile.
            <span className="text-green-600 ml-2">✓ Recommended</span>
          </li>
          <li>
            <strong>Option B:</strong> Compact inline with separator. May feel cramped.
          </li>
          <li>
            <strong>Option C:</strong> Mobile-only stacked layout (can combine with A for responsive).
          </li>
        </ul>
        <p className="text-muted-foreground mt-4 text-sm">
          The key benefit: Moving piles out of the Table section frees ~120px of vertical space
          for melds, reducing or eliminating scrolling when all 4 players have laid down.
        </p>
      </section>
    </div>
  );
}
