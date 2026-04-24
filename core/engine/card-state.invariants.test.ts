import { describe, expect, it } from "bun:test";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { Player } from "./engine.types";
import {
  validateCardZones,
  zonesFromRoundState,
} from "./card-state.invariants";

function card(id: string, rank: Card["rank"] = "7", suit: Card["suit"] = "clubs"): Card {
  return { id, rank, suit };
}

describe("card-state invariants", () => {
  describe("validateCardZones", () => {
    it("allows same rank and suit from multiple decks when card IDs differ", () => {
      const firstSeven = card("deck-1-7-clubs");
      const secondSeven = card("deck-2-7-clubs");

      const report = validateCardZones([
        { id: "hand:player-1", label: "Player 1 hand", cards: [firstSeven] },
        { id: "hand:player-2", label: "Player 2 hand", cards: [secondSeven] },
      ]);

      expect(report).toEqual({ ok: true, violations: [] });
    });

    it("reports a physical card ID in two player hands", () => {
      const duplicate = card("physical-7-clubs");

      const report = validateCardZones([
        { id: "hand:player-1", label: "Player 1 hand", cards: [duplicate] },
        { id: "hand:player-2", label: "Player 2 hand", cards: [{ ...duplicate }] },
      ]);

      expect(report).toEqual({
        ok: false,
        violations: [
          {
            type: "duplicate-card-id",
            cardId: "physical-7-clubs",
            zones: ["hand:player-1", "hand:player-2"],
          },
        ],
      });
    });

    it("reports a physical card ID in a hand and discard", () => {
      const duplicate = card("claimed-discard-card", "Q", "hearts");

      const report = validateCardZones([
        { id: "hand:player-1", label: "Player 1 hand", cards: [duplicate] },
        { id: "discard", label: "Discard", cards: [{ ...duplicate }] },
      ]);

      expect(report.ok).toBe(false);
      expect(report.violations).toEqual([
        {
          type: "duplicate-card-id",
          cardId: "claimed-discard-card",
          zones: ["hand:player-1", "discard"],
        },
      ]);
    });

    it("reports a physical card ID in stock and a table meld", () => {
      const duplicate = card("stock-table-card", "9", "spades");

      const report = validateCardZones([
        { id: "stock", label: "Stock", cards: [duplicate] },
        { id: "table:meld-1", label: "Meld 1", cards: [{ ...duplicate }] },
      ]);

      expect(report.violations).toEqual([
        {
          type: "duplicate-card-id",
          cardId: "stock-table-card",
          zones: ["stock", "table:meld-1"],
        },
      ]);
    });

    it("reports a physical card ID duplicated inside one hand", () => {
      const duplicate = card("same-hand-card", "A", "diamonds");

      const report = validateCardZones([
        { id: "hand:player-1", label: "Player 1 hand", cards: [duplicate, { ...duplicate }] },
      ]);

      expect(report.violations).toEqual([
        {
          type: "duplicate-card-id",
          cardId: "same-hand-card",
          zones: ["hand:player-1", "hand:player-1"],
        },
      ]);
    });

    it("reports multiple violations deterministically by card ID", () => {
      const zCard = card("z-card");
      const aCard = card("a-card");

      const report = validateCardZones([
        { id: "stock", label: "Stock", cards: [zCard, aCard] },
        { id: "discard", label: "Discard", cards: [{ ...zCard }, { ...aCard }] },
      ]);

      expect(report.violations).toEqual([
        {
          type: "duplicate-card-id",
          cardId: "a-card",
          zones: ["stock", "discard"],
        },
        {
          type: "duplicate-card-id",
          cardId: "z-card",
          zones: ["stock", "discard"],
        },
      ]);
    });

    it("does not mutate input zones", () => {
      const zones = [
        { id: "stock", label: "Stock", cards: [card("stock-card")] },
      ];
      const before = structuredClone(zones);

      validateCardZones(zones);

      expect(zones).toEqual(before);
    });
  });

  describe("zonesFromRoundState", () => {
    it("builds zones for hands, stock, discard, and table melds", () => {
      const players: Player[] = [
        {
          id: "player-1",
          name: "Alice",
          hand: [card("alice-card")],
          isDown: false,
          totalScore: 0,
        },
        {
          id: "player-2",
          name: "Bob",
          hand: [card("bob-card")],
          isDown: false,
          totalScore: 0,
        },
      ];
      const table: Meld[] = [
        {
          id: "meld-1",
          ownerId: "player-1",
          type: "set",
          cards: [card("meld-card")],
        },
      ];

      const zones = zonesFromRoundState({
        players,
        stock: [card("stock-card")],
        discard: [card("discard-card")],
        table,
      });

      expect(zones.map((zone) => zone.id)).toEqual([
        "hand:player-1",
        "hand:player-2",
        "stock",
        "discard",
        "table:meld-1",
      ]);
      expect(validateCardZones(zones)).toEqual({ ok: true, violations: [] });
    });
  });
});
