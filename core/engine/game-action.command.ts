import { z } from "zod";

export const meldSpecSchema = z.object({
  type: z.enum(["set", "run"]),
  cardIds: z.array(z.string()),
});

export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("DRAW_FROM_STOCK") }),
  z.object({ type: z.literal("DRAW_FROM_DISCARD") }),
  z.object({ type: z.literal("LAY_DOWN"), melds: z.array(meldSpecSchema) }),
  z.object({
    type: z.literal("LAY_OFF"),
    cardId: z.string(),
    meldId: z.string(),
    position: z.enum(["start", "end"]).optional(),
  }),
  z.object({
    type: z.literal("SWAP_JOKER"),
    meldId: z.string(),
    jokerCardId: z.string(),
    swapCardId: z.string(),
  }),
  z.object({ type: z.literal("DISCARD"), cardId: z.string() }),
  z.object({ type: z.literal("SKIP") }),
  z.object({ type: z.literal("REORDER_HAND"), cardIds: z.array(z.string()) }),
  z.object({ type: z.literal("CALL_MAY_I") }),
  z.object({ type: z.literal("ALLOW_MAY_I") }),
  z.object({ type: z.literal("CLAIM_MAY_I") }),
]);

export type GameAction = z.infer<typeof gameActionSchema>;
