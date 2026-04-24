import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { Player } from "./engine.types";
import type { GameSnapshot } from "./game-engine.types";

export interface CardZone {
  id: string;
  label: string;
  cards: Card[];
}

export interface CardInvariantViolation {
  type: "duplicate-card-id";
  cardId: string;
  zones: string[];
}

export interface CardInvariantReport {
  ok: boolean;
  violations: CardInvariantViolation[];
}

export interface RoundCardZonesInput {
  players: Player[];
  stock: Card[];
  discard: Card[];
  table: Meld[];
}

export function validateCardZones(zones: CardZone[]): CardInvariantReport {
  const zonesByCardId = new Map<string, string[]>();

  for (const zone of zones) {
    for (const card of zone.cards) {
      if (!card.id) continue;
      const zonesForCard = zonesByCardId.get(card.id) ?? [];
      zonesForCard.push(zone.id);
      zonesByCardId.set(card.id, zonesForCard);
    }
  }

  const violations = [...zonesByCardId.entries()]
    .filter(([, zonesForCard]) => zonesForCard.length > 1)
    .sort(([leftCardId], [rightCardId]) => leftCardId.localeCompare(rightCardId))
    .map(([cardId, zonesForCard]) => ({
      type: "duplicate-card-id" as const,
      cardId,
      zones: zonesForCard,
    }));

  return {
    ok: violations.length === 0,
    violations,
  };
}

export function zonesFromRoundState(input: RoundCardZonesInput): CardZone[] {
  return [
    ...input.players.map((player) => ({
      id: `hand:${player.id}`,
      label: `${player.name} hand`,
      cards: player.hand,
    })),
    {
      id: "stock",
      label: "Stock",
      cards: input.stock,
    },
    {
      id: "discard",
      label: "Discard",
      cards: input.discard,
    },
    ...input.table.map((meld) => ({
      id: `table:${meld.id}`,
      label: `Table meld ${meld.id}`,
      cards: meld.cards,
    })),
  ];
}

export function zonesFromGameSnapshot(snapshot: GameSnapshot): CardZone[] {
  return zonesFromRoundState({
    players: snapshot.players,
    stock: snapshot.stock,
    discard: snapshot.discard,
    table: snapshot.table,
  });
}

export function duplicateCardIdsFromReport(report: CardInvariantReport): string[] {
  return report.violations.map((violation) => violation.cardId);
}
