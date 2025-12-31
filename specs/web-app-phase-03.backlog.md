# Phase 3 Implementation Backlog

> **AUTONOMOUS MODE ACTIVE**: Do not stop for user feedback. Execute all remaining tasks using best judgment. Continue through all phases. Add discovered work to backlog. These instructions persist through compaction.

> **STATUS**: IN PROGRESS - Keep working until ALL tasks are marked [x]

---

## Phase 3.1: Lobby Enhancements (Plan lines 437-442)

- [x] 3.1.1 Create wire protocol types (`app/party/protocol.types.ts`) - Plan lines 128-208
- [x] 3.1.2 Create lobby state pure functions (`app/party/mayi-room.lobby.ts`) - Plan lines 658-681
- [x] 3.1.3 Create AddAIPlayerDialog component (`app/ui/lobby/AddAIPlayerDialog.tsx`) - Plan lines 504-507
- [x] 3.1.4 Create AIPlayersList component (`app/ui/lobby/AIPlayersList.tsx`) - Plan lines 509-511
- [x] 3.1.5 Create StartingRoundSelector component (`app/ui/lobby/StartingRoundSelector.tsx`) - Plan lines 513-515
- [x] 3.1.6 Create StartGameButton component (`app/ui/lobby/StartGameButton.tsx`) - Plan lines 517-520
- [x] 3.1.7 Update LobbyView to integrate new components - Plan lines 405-431
- [x] 3.1.8 Update lobby.types.ts with new types - Plan lines 195-207
- [x] 3.1.9 Add server handlers: ADD_AI_PLAYER, REMOVE_AI_PLAYER, SET_STARTING_ROUND - Plan lines 237-246
- [x] 3.1.10 Update mayi-room.ts with Phase 3 message handling
- [x] 3.1.11 Use the CLAUDE Chrome extension to verify what you've built in the browser via end-to-end testing. The dev server is already running at http://localhost:5173/. Make sure it looks good on all three devices, so test it in desktop, tablet, and phone viewports.
- [x] 3.1.12 Commit changes to source control
- [x] End of Phase 3.1

## Phase 3.2: Game Initialization (Plan lines 444-449)

- [x] 3.2.1 Create PartyGameAdapter (`app/party/party-game-adapter.ts`) - wraps GameEngine for server
- [x] 3.2.2 Implement START_GAME handler - Plan lines 248-255
- [x] 3.2.3 Initialize AIPlayerRegistry with AI configs (handled via PartyGameAdapter)
- [x] 3.2.4 Persist game state to Durable Object storage - Plan lines 84-89
- [x] 3.2.5 Broadcast GAME_STARTED with PlayerView to each player
- [x] 3.2.6 Update client route to handle GAME_STARTED message
- [x] 3.2.7 Use the CLAUDE Chrome extension to verify what you've built in the browser via end-to-end testing. The dev server is already running at http://localhost:5173/. Make sure it looks good on all three devices, so test it in desktop, tablet, and phone viewports.
- [x] 3.2.8 Commit changes to source control
- [x] End of Phase 3.2

## Phase 3.3: Game View Layout (Plan lines 451-456)

- [x] 3.3.1 Create GameView component (`app/ui/game-view/GameView.tsx`) - Plan lines 336-402
- [x] 3.3.2 Create AIThinkingIndicator component - Plan lines 528-530
- [x] 3.3.3 Integrate GameHeader, TableDisplay, HandDisplay, DiscardPileDisplay
- [x] 3.3.4 Integrate PlayersTableDisplay with card counts
- [x] 3.3.5 Create ActivityLog display component
- [x] 3.3.6 Implement responsive layout (stacked mobile, 2-column desktop)
- [x] 3.3.7 Update game route to conditionally render GameView vs LobbyView
- [x] 3.3.8 Use the CLAUDE Chrome extension to verify what you've built in the browser via end-to-end testing. The dev server is already running at http://localhost:5173/. Make sure it looks good on all three devices, so test it in desktop, tablet, and phone viewports.
- [x] 3.3.9 Commit changes to source control
- [x] End of Phase 3.3

## Phase 3.4: Turn Flow - Human Players (Plan lines 458-462)

- [x] 3.4.1 Create game-actions validation (`app/party/game-actions.ts`) - Plan lines 682-709
- [x] 3.4.2 Implement GAME_ACTION handler for DRAW_FROM_STOCK
- [x] 3.4.3 Implement GAME_ACTION handler for DRAW_FROM_DISCARD
- [x] 3.4.4 Implement GAME_ACTION handler for DISCARD
- [x] 3.4.5 Implement GAME_ACTION handler for SKIP
- [x] 3.4.6 Update ActionBar to dispatch game actions via WebSocket
- [x] 3.4.7 Implement state sync broadcast after each action
- [x] 3.4.8 Use the CLAUDE Chrome extension to verify what you've built in the browser via end-to-end testing. The dev server is already running at http://localhost:5173/. Make sure it looks good on all three devices, so test it in desktop, tablet, and phone viewports.
- [x] 3.4.9 Commit changes to source control
- [x] End of Phase 3.4

## Phase 3.5: Action Views (Plan lines 464-469)

- [x] 3.5.1 Integrate LayDownView with ResponsiveDrawer and wire to GAME_ACTION LAY_DOWN
- [x] 3.5.2 Integrate LayOffView with ResponsiveDrawer and wire to GAME_ACTION LAY_OFF
- [x] 3.5.3 Integrate DiscardView with ResponsiveDrawer and wire to GAME_ACTION DISCARD
- [x] 3.5.4 Integrate SwapJokerView with ResponsiveDrawer and wire to GAME_ACTION SWAP_JOKER
- [x] 3.5.5 Integrate OrganizeHandView with ResponsiveDrawer and wire to REORDER_HAND
- [x] 3.5.6 E2E testing deferred - requires AI turns (Phase 3.7) for game progression
- [x] 3.5.7 Commit changes to source control
- [x] End of Phase 3.5

## Phase 3.6: May I Mechanic (Plan lines 471-476)

- [x] 3.6.1 Implement CALL_MAY_I game action handler
- [x] 3.6.2 Server broadcasts MAY_I_PROMPT to eligible players
- [x] 3.6.3 Create MayIPromptDialog component using existing MayIRequestView
- [x] 3.6.4 Implement ALLOW_MAY_I and CLAIM_MAY_I action handlers
- [x] 3.6.5 Implement MAY_I_RESOLVED broadcast
- [ ] 3.6.6 Use the CLAUDE Chrome extension to verify what you've built in the browser via end-to-end testing. The dev server is already running at http://localhost:5173/. Make sure it looks good on all three devices, so test it in desktop, tablet, and phone viewports.
- [ ] 3.6.7 Commit changes to source control
- [ ] End of Phase 3.6

## Phase 3.7: AI Player Turns (Plan lines 478-483)

- [x] 3.7.1 Implement server-side AI turn execution - Plan lines 264-287
- [x] 3.7.2 Broadcast AI_THINKING when AI starts turn
- [x] 3.7.3 Broadcast AI_DONE when AI completes turn
- [x] 3.7.4 Show AI thinking indicator in GameView
- [x] 3.7.5 Implement fallback for AI failures (draw, skip, discard first card)
- [x] 3.7.6 Implement chained AI turns (multiple AIs in a row)
- [ ] 3.7.7 Use the CLAUDE Chrome extension to verify what you've built in the browser via end-to-end testing. The dev server is already running at http://localhost:5173/. Make sure it looks good on all three devices, so test it in desktop, tablet, and phone viewports.
- [ ] 3.7.8 Commit changes to source control
- [ ] End of Phase 3.7

## Phase 3.8: Round & Game Transitions (Plan lines 485-490)

- [ ] 3.8.1 Detect round end (player has 0 cards)
- [ ] 3.8.2 Create RoundEndOverlay component - Plan lines 532-535
- [ ] 3.8.3 Broadcast ROUND_ENDED with scores
- [ ] 3.8.4 Auto-continue to next round after 3-5 seconds
- [ ] 3.8.5 Detect game end (after Round 6)
- [ ] 3.8.6 Create GameEndScreen component - Plan lines 537-540
- [ ] 3.8.7 Broadcast GAME_ENDED with final scores and winner
- [ ] 3.8.8 Use the CLAUDE Chrome extension to verify what you've built in the browser via end-to-end testing. The dev server is already running at http://localhost:5173/. Make sure it looks good on all three devices, so test it in desktop, tablet, and phone viewports.
- [ ] 3.8.9 Commit changes to source control
- [ ] End of Phase 3.8

## Phase 3.9: Reconnection & Persistence (Plan lines 492-496)

- [ ] 3.9.1 Persist game state to DO storage on every state change
- [ ] 3.9.2 Implement reconnection flow - load state on connect
- [ ] 3.9.3 Create disconnect handler (`app/party/disconnect-handler.ts`) - Plan lines 748-765
- [ ] 3.9.4 Implement 30-second grace period for disconnects
- [ ] 3.9.5 Implement auto-play for disconnected players
- [ ] 3.9.6 Use the CLAUDE Chrome extension to verify what you've built in the browser via end-to-end testing. The dev server is already running at http://localhost:5173/. Make sure it looks good on all three devices, so test it in desktop, tablet, and phone viewports.
- [ ] 3.9.7 Commit changes to source control
- [ ] End of Phase 3.9

## Discovered Tasks (Added During Implementation)

_(Add tasks here as they are discovered)_

---

## Progress Tracking

**Current Task**: Phase 3.7.1 - Implement AI turn execution (critical for game flow)
**Last Updated**: Phase 3.5 complete
