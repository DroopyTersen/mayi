import { describe, expect, it } from "bun:test";
import type { Snapshot } from "xstate";
import type { Card } from "../card/card.types";
import { GameEngine } from "./game-engine";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

function getPersistedRoundContext(engine: GameEngine) {
  const persisted = engine.getPersistedSnapshot() as {
    children?: {
      round?: {
        snapshot?: {
          context?: {
            players?: Array<{ id: string; hand: Array<{ id: string }> }>;
            stock?: Array<{ id: string }>;
            discard?: Array<{ id: string }>;
          };
        };
      };
    };
  };

  const roundContext = persisted.children?.round?.snapshot?.context;
  if (!roundContext) {
    throw new Error("Expected persisted round context");
  }
  return roundContext;
}

describe("RoundMachine card ownership", () => {
  it("updates persisted round stock immediately when current player draws from stock", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const before = engine.getSnapshot();
    const currentPlayerId = before.awaitingPlayerId;
    const drawnCard = before.stock[0];
    if (!drawnCard) {
      throw new Error("Expected stock card");
    }

    engine.drawFromStock(currentPlayerId);

    const roundContext = getPersistedRoundContext(engine);
    const roundPlayer = roundContext.players?.find((player) => player.id === currentPlayerId);
    if (!roundPlayer || !roundContext.stock) {
      throw new Error("Expected round player and stock");
    }

    expect(roundPlayer.hand.map((card) => card.id)).toContain(drawnCard.id);
    expect(roundContext.stock.map((card) => card.id)).not.toContain(drawnCard.id);

    engine.stop();
  });

  it("updates persisted round discard immediately when current player draws from discard", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const before = engine.getSnapshot();
    const currentPlayerId = before.awaitingPlayerId;
    const claimedDiscard = before.discard[0];
    if (!claimedDiscard) {
      throw new Error("Expected discard card");
    }

    engine.drawFromDiscard(currentPlayerId);

    const roundContext = getPersistedRoundContext(engine);
    const roundPlayer = roundContext.players?.find((player) => player.id === currentPlayerId);
    if (!roundPlayer || !roundContext.discard) {
      throw new Error("Expected round player and discard");
    }

    expect(roundPlayer.hand.map((card) => card.id)).toContain(claimedDiscard.id);
    expect(roundContext.discard.map((card) => card.id)).not.toContain(claimedDiscard.id);

    engine.stop();
  });

  it("updates persisted round hand and table immediately when current player lays down", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const currentPlayerId = engine.getSnapshot().awaitingPlayerId;
    const knownHand = [
      card("set-3-hearts", "3", "hearts"),
      card("set-3-diamonds", "3", "diamonds"),
      card("set-3-clubs", "3", "clubs"),
      card("set-4-hearts", "4", "hearts"),
      card("set-4-diamonds", "4", "diamonds"),
      card("set-4-clubs", "4", "clubs"),
      card("filler-5-hearts", "5", "hearts"),
      card("filler-6-hearts", "6", "hearts"),
      card("filler-7-hearts", "7", "hearts"),
      card("filler-8-hearts", "8", "hearts"),
      card("filler-9-hearts", "9", "hearts"),
    ];

    const persisted = engine.getPersistedSnapshot() as Snapshot<unknown> & {
      children?: {
        round?: {
          snapshot?: {
            context?: {
              players?: Array<{ id: string; hand: Card[] }>;
            };
            children?: {
              turn?: {
                snapshot?: {
                  context?: { hand?: Card[] };
                };
              };
            };
          };
        };
      };
    };
    const roundSnapshot = persisted.children?.round?.snapshot;
    const roundPlayer = roundSnapshot?.context?.players?.find(
      (player) => player.id === currentPlayerId
    );
    const turnContext = roundSnapshot?.children?.turn?.snapshot?.context;
    if (!roundPlayer || !turnContext) {
      throw new Error("Expected round player and turn context");
    }
    roundPlayer.hand = knownHand;
    turnContext.hand = knownHand;

    engine.stop();
    const restored = GameEngine.fromPersistedSnapshot(persisted);

    restored.drawFromStock(currentPlayerId);
    restored.layDown(currentPlayerId, [
      { type: "set", cardIds: ["set-3-hearts", "set-3-diamonds", "set-3-clubs"] },
      { type: "set", cardIds: ["set-4-hearts", "set-4-diamonds", "set-4-clubs"] },
    ]);

    const roundContext = getPersistedRoundContext(restored);
    const roundPlayerAfter = roundContext.players?.find(
      (player) => player.id === currentPlayerId
    );
    if (!roundPlayerAfter) {
      throw new Error("Expected round player after laydown");
    }

    const laidDownIds = [
      "set-3-hearts",
      "set-3-diamonds",
      "set-3-clubs",
      "set-4-hearts",
      "set-4-diamonds",
      "set-4-clubs",
    ];
    const roundHandIds = roundPlayerAfter.hand.map((card) => card.id);
    const tableIds = restored.getSnapshot().table.flatMap((meld) =>
      meld.cards.map((tableCard) => tableCard.id)
    );
    const persistedTableIds = (roundContext as { table?: Array<{ cards: Card[] }> }).table
      ?.flatMap((meld) => meld.cards.map((tableCard) => tableCard.id)) ?? [];

    for (const id of laidDownIds) {
      expect(roundHandIds).not.toContain(id);
      expect(tableIds).toContain(id);
      expect(persistedTableIds).toContain(id);
    }

    restored.stop();
  });

  it("updates persisted round hand and table immediately when current player lays off", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const currentPlayerId = engine.getSnapshot().awaitingPlayerId;
    const layoffCard = card("layoff-3-spades", "3", "spades");
    const tableCards = [
      card("table-3-hearts", "3", "hearts"),
      card("table-3-diamonds", "3", "diamonds"),
      card("table-3-clubs", "3", "clubs"),
    ];

    engine.drawFromStock(currentPlayerId);

    const persisted = engine.getPersistedSnapshot() as Snapshot<unknown> & {
      children?: {
        round?: {
          snapshot?: {
            context?: {
              players?: Array<{ id: string; hand: Card[]; isDown: boolean }>;
              table?: Array<{ id: string; type: "set" | "run"; cards: Card[]; ownerId: string }>;
            };
            children?: {
              turn?: {
                snapshot?: {
                  context?: {
                    hand?: Card[];
                    table?: Array<{ id: string; type: "set" | "run"; cards: Card[]; ownerId: string }>;
                    isDown?: boolean;
                    hasDrawn?: boolean;
                    laidDownThisTurn?: boolean;
                  };
                };
              };
            };
          };
        };
      };
    };
    const roundSnapshot = persisted.children?.round?.snapshot;
    const roundPlayer = roundSnapshot?.context?.players?.find(
      (player) => player.id === currentPlayerId
    );
    const turnContext = roundSnapshot?.children?.turn?.snapshot?.context;
    const meld = {
      id: "existing-set",
      type: "set" as const,
      cards: tableCards,
      ownerId: "player-other",
    };
    if (!roundPlayer || !turnContext) {
      throw new Error("Expected round player and turn context");
    }
    roundPlayer.hand = [layoffCard, card("keep-5-hearts", "5", "hearts")];
    roundPlayer.isDown = true;
    roundSnapshot.context!.table = [meld];
    turnContext.hand = roundPlayer.hand;
    turnContext.table = [meld];
    turnContext.isDown = true;
    turnContext.hasDrawn = true;
    turnContext.laidDownThisTurn = false;

    engine.stop();
    const restored = GameEngine.fromPersistedSnapshot(persisted);

    restored.layOff(currentPlayerId, layoffCard.id, meld.id);

    const roundContext = getPersistedRoundContext(restored);
    const roundPlayerAfter = roundContext.players?.find(
      (player) => player.id === currentPlayerId
    );
    const persistedTableIds = (roundContext as { table?: Array<{ cards: Card[] }> }).table
      ?.flatMap((tableMeld) => tableMeld.cards.map((tableCard) => tableCard.id)) ?? [];

    expect(roundPlayerAfter?.hand.map((handCard) => handCard.id)).not.toContain(layoffCard.id);
    expect(persistedTableIds).toContain(layoffCard.id);

    restored.stop();
  });

  it("updates persisted round hand and table immediately when current player swaps a joker", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const currentPlayerId = engine.getSnapshot().awaitingPlayerId;
    const joker = card("run-joker", "Joker", null);
    const swapCard = card("swap-5-hearts", "5", "hearts");
    const runMeld = {
      id: "existing-run",
      type: "run" as const,
      cards: [
        card("run-3-hearts", "3", "hearts"),
        card("run-4-hearts", "4", "hearts"),
        joker,
      ],
      ownerId: "player-other",
    };

    engine.drawFromStock(currentPlayerId);

    const persisted = engine.getPersistedSnapshot() as Snapshot<unknown> & {
      children?: {
        round?: {
          snapshot?: {
            context?: {
              players?: Array<{ id: string; hand: Card[]; isDown: boolean }>;
              table?: Array<{ id: string; type: "set" | "run"; cards: Card[]; ownerId: string }>;
            };
            children?: {
              turn?: {
                snapshot?: {
                  context?: {
                    hand?: Card[];
                    table?: Array<{ id: string; type: "set" | "run"; cards: Card[]; ownerId: string }>;
                    isDown?: boolean;
                  };
                };
              };
            };
          };
        };
      };
    };
    const roundSnapshot = persisted.children?.round?.snapshot;
    const roundPlayer = roundSnapshot?.context?.players?.find(
      (player) => player.id === currentPlayerId
    );
    const turnContext = roundSnapshot?.children?.turn?.snapshot?.context;
    if (!roundPlayer || !turnContext) {
      throw new Error("Expected round player and turn context");
    }
    roundPlayer.hand = [swapCard, card("keep-9-clubs", "9", "clubs")];
    roundPlayer.isDown = false;
    roundSnapshot.context!.table = [runMeld];
    turnContext.hand = roundPlayer.hand;
    turnContext.table = [runMeld];
    turnContext.isDown = false;

    engine.stop();
    const restored = GameEngine.fromPersistedSnapshot(persisted);

    restored.swapJoker(currentPlayerId, runMeld.id, joker.id, swapCard.id);

    const roundContext = getPersistedRoundContext(restored);
    const roundPlayerAfter = roundContext.players?.find(
      (player) => player.id === currentPlayerId
    );
    const persistedTableIds = (roundContext as { table?: Array<{ cards: Card[] }> }).table
      ?.flatMap((tableMeld) => tableMeld.cards.map((tableCard) => tableCard.id)) ?? [];

    expect(roundPlayerAfter?.hand.map((handCard) => handCard.id)).toContain(joker.id);
    expect(roundPlayerAfter?.hand.map((handCard) => handCard.id)).not.toContain(swapCard.id);
    expect(persistedTableIds).toContain(swapCard.id);
    expect(persistedTableIds).not.toContain(joker.id);

    restored.stop();
  });

  it("uses round-owned card zones when restored turn card copies are stale", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const before = engine.getSnapshot();
    const currentPlayerId = before.awaitingPlayerId;
    const drawnCard = before.stock[0];
    if (!drawnCard) {
      throw new Error("Expected stock card");
    }

    engine.drawFromStock(currentPlayerId);

    const persisted = engine.getPersistedSnapshot() as Snapshot<unknown> & {
      children?: {
        round?: {
          snapshot?: {
            children?: {
              turn?: {
                snapshot?: {
                  context?: {
                    hand?: Card[];
                    stock?: Card[];
                  };
                };
              };
            };
          };
        };
      };
    };

    const turnContext = persisted.children?.round?.snapshot?.children?.turn?.snapshot?.context;
    if (!turnContext?.hand || !turnContext.stock) {
      throw new Error("Expected turn context hand and stock");
    }

    turnContext.hand = turnContext.hand.filter((card) => card.id !== drawnCard.id);
    turnContext.stock = [drawnCard, ...turnContext.stock];

    engine.stop();
    const restored = GameEngine.fromPersistedSnapshot(persisted);
    const snapshot = restored.getSnapshot();
    const currentPlayer = snapshot.players.find((player) => player.id === currentPlayerId);

    expect(currentPlayer?.hand.map((card) => card.id)).toContain(drawnCard.id);
    expect(snapshot.stock.map((card) => card.id)).not.toContain(drawnCard.id);

    restored.stop();
  });

  it("discards from the round-owned hand when restored turn hand copy is stale", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const before = engine.getSnapshot();
    const currentPlayerId = before.awaitingPlayerId;
    const drawnCard = before.stock[0];
    if (!drawnCard) {
      throw new Error("Expected stock card");
    }

    engine.drawFromStock(currentPlayerId);

    const persisted = engine.getPersistedSnapshot() as Snapshot<unknown> & {
      children?: {
        round?: {
          snapshot?: {
            children?: {
              turn?: {
                snapshot?: {
                  context?: {
                    hand?: Card[];
                  };
                };
              };
            };
          };
        };
      };
    };

    const turnContext = persisted.children?.round?.snapshot?.children?.turn?.snapshot?.context;
    if (!turnContext?.hand) {
      throw new Error("Expected turn context hand");
    }

    turnContext.hand = turnContext.hand.filter((card) => card.id !== drawnCard.id);

    engine.stop();
    const restored = GameEngine.fromPersistedSnapshot(persisted);

    const afterDiscard = restored.discard(currentPlayerId, drawnCard.id);
    const currentPlayer = afterDiscard.players.find((player) => player.id === currentPlayerId);

    expect(afterDiscard.awaitingPlayerId).not.toBe(currentPlayerId);
    expect(afterDiscard.discard[0]?.id).toBe(drawnCard.id);
    expect(currentPlayer?.hand.map((card) => card.id)).not.toContain(drawnCard.id);

    restored.stop();
  });
});
