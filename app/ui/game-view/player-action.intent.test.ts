import { describe, expect, it } from "bun:test";
import {
  createDiscardIntent,
  createLayDownIntent,
  createLayOffIntent,
  createReorderHandIntent,
  createSwapJokerIntent,
  resolvePlayerActionIntent,
  type PlayerActionIntent,
} from "./player-action.intent";

describe("resolvePlayerActionIntent", () => {
  it("maps immediate action bar intents to shared game commands", () => {
    expect(resolvePlayerActionIntent({ type: "drawStock" }, new Set())).toEqual({
      kind: "command",
      action: { type: "DRAW_FROM_STOCK" },
    });
    expect(resolvePlayerActionIntent({ type: "pickUpDiscard" }, new Set())).toEqual({
      kind: "command",
      action: { type: "DRAW_FROM_DISCARD" },
    });
    expect(resolvePlayerActionIntent({ type: "mayI" }, new Set())).toEqual({
      kind: "command",
      action: { type: "CALL_MAY_I" },
    });
    expect(resolvePlayerActionIntent({ type: "skip" }, new Set())).toEqual({
      kind: "command",
      action: { type: "SKIP" },
    });
    expect(resolvePlayerActionIntent({ type: "allowMayI" }, new Set())).toEqual({
      kind: "command",
      action: { type: "ALLOW_MAY_I" },
    });
    expect(resolvePlayerActionIntent({ type: "claimMayI" }, new Set())).toEqual({
      kind: "command",
      action: { type: "CLAIM_MAY_I" },
    });
  });

  it("maps action bar drawer intents to local drawer transitions", () => {
    expect(resolvePlayerActionIntent({ type: "layDown" }, new Set())).toEqual({
      kind: "openDrawer",
      drawer: "layDown",
    });
    expect(resolvePlayerActionIntent({ type: "layOff" }, new Set())).toEqual({
      kind: "openDrawer",
      drawer: "layOff",
    });
    expect(resolvePlayerActionIntent({ type: "swapJoker" }, new Set())).toEqual({
      kind: "openDrawer",
      drawer: "swapJoker",
    });
    expect(resolvePlayerActionIntent({ type: "organize" }, new Set())).toEqual({
      kind: "openDrawer",
      drawer: "organize",
    });
  });

  it("uses the only selected card for action bar discard", () => {
    expect(resolvePlayerActionIntent({ type: "discard" }, new Set(["card-7"]))).toEqual({
      kind: "command",
      action: { type: "DISCARD", cardId: "card-7" },
    });
    expect(resolvePlayerActionIntent({ type: "discard" }, new Set())).toEqual({
      kind: "openDrawer",
      drawer: "discard",
    });
    expect(
      resolvePlayerActionIntent({ type: "discard" }, new Set(["card-7", "card-9"]))
    ).toEqual({
      kind: "openDrawer",
      drawer: "discard",
    });
  });

  it("maps hand drawer draw, discard, and reorder intents to shared commands", () => {
    expect(resolvePlayerActionIntent(createDiscardIntent("card-7"), new Set())).toEqual({
      kind: "command",
      action: { type: "DISCARD", cardId: "card-7" },
    });
    expect(
      resolvePlayerActionIntent(createReorderHandIntent([{ id: "c" }, { id: "a" }]), new Set())
    ).toEqual({
      kind: "command",
      action: { type: "REORDER_HAND", cardIds: ["c", "a"] },
    });
  });

  it("maps lay down, lay off, and swap intents to shared commands", () => {
    expect(
      resolvePlayerActionIntent(
        createLayDownIntent([
          { type: "set", cardIds: ["a", "b", "c"] },
          { type: "run", cardIds: ["d", "e", "f", "g"] },
        ]),
        new Set()
      )
    ).toEqual({
      kind: "command",
      action: {
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: ["a", "b", "c"] },
          { type: "run", cardIds: ["d", "e", "f", "g"] },
        ],
      },
    });
    expect(resolvePlayerActionIntent(createLayOffIntent("card-7", "meld-1", "start"), new Set())).toEqual({
      kind: "command",
      action: {
        type: "LAY_OFF",
        cardId: "card-7",
        meldId: "meld-1",
        position: "start",
      },
    });
    expect(
      resolvePlayerActionIntent(createSwapJokerIntent("meld-1", "joker-1", "card-7"), new Set())
    ).toEqual({
      kind: "command",
      action: {
        type: "SWAP_JOKER",
        meldId: "meld-1",
        jokerCardId: "joker-1",
        swapCardId: "card-7",
      },
    });
  });

  it("rejects invalid payloads at the intent seam", () => {
    expect(resolvePlayerActionIntent(createLayDownIntent([]), new Set())).toEqual({
      kind: "invalid",
      error: "LAY_DOWN_REQUIRES_MELDS",
    });
    expect(
      resolvePlayerActionIntent(
        { type: "layOff", cardId: "", meldId: "meld-1" } as PlayerActionIntent,
        new Set()
      )
    ).toEqual({
      kind: "invalid",
      error: "LAY_OFF_REQUIRES_CARD_AND_MELD",
    });
    expect(
      resolvePlayerActionIntent(
        { type: "swapJoker", meldId: "meld-1", jokerCardId: "", swapCardId: "card-7" } as PlayerActionIntent,
        new Set()
      )
    ).toEqual({
      kind: "invalid",
      error: "SWAP_JOKER_REQUIRES_MELD_JOKER_AND_SWAP_CARD",
    });
    expect(resolvePlayerActionIntent(createReorderHandIntent([]), new Set())).toEqual({
      kind: "invalid",
      error: "REORDER_HAND_REQUIRES_CARD_IDS",
    });
  });
});
