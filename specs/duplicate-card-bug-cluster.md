# Duplicate Card Bug Cluster - Investigation Notes

## Context
- Reports: #69, #71, #72, #73
- Common symptom: cards with the same rank/suit behave as the same card.
- Round 5 in human-only games; more May-I events later in the game.

## Findings So Far
- Card identity is based on `Card.id` everywhere in core and UI.
- `createDeck` assigns unique `card-*` IDs per round (IDs reset each round).
- UI components use `card.id` as React keys and for selection:
  - Duplicate IDs in a hand would cause stacked visuals and unselectable cards.
- May-I resolution removes the claimed discard via `discard.filter((c) => c.id !== cardBeingClaimed.id)`.
  - If duplicate IDs exist in discard, multiple cards are removed.
- Reorder/organize hand uses card IDs and will fail or behave oddly if duplicate IDs exist.

## Hypotheses
- Duplicate IDs are being introduced post-deal (state sync or persistence).
- Corruption may happen around May-I resolution when round + turn piles are merged.
- Later rounds may amplify the issue due to more state transitions.

## Next Steps
- Add a runtime invariant in GameEngine snapshot extraction to flag duplicate IDs across:
  - all hands, stock, discard, and table.
- Write a failing test that asserts `lastError` is set when a persisted snapshot has duplicate IDs.
- Use this to detect corruption early and pinpoint source during repro attempts.

## Progress
- Added GameEngine snapshot invariant to flag duplicate card IDs.
- Added test to ensure persisted snapshots with duplicate IDs surface `lastError`.
- Added round-5 May-I sequence test to assert no duplicate IDs after multiple resolutions (passes; no repro).
- Manufactured a persisted snapshot after May-I and injected a duplicate ID; invariant flags it as expected.
