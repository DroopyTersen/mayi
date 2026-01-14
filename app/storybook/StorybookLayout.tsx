import { useParams, Link } from "react-router";

import { PlayingCardStory } from "~/ui/playing-card/PlayingCard.story";
import { HandDisplayStory } from "~/ui/player-hand/HandDisplay.story";
import { MeldDisplayStory } from "~/ui/game-table/MeldDisplay.story";
import { DiscardPileDisplayStory } from "~/ui/game-table/DiscardPileDisplay.story";
import { PlayerMeldsDisplayStory } from "~/ui/game-table/PlayerMeldsDisplay.story";
import { TableDisplayStory } from "~/ui/game-table/TableDisplay.story";
import { PlayersTableDisplayStory } from "~/ui/game-status/PlayersTableDisplay.story";
import { GameHeaderStory } from "~/ui/game-status/GameHeader.story";
import { ActivityLogStory } from "~/ui/game-status/ActivityLog.story";
import { ActionBarStory } from "~/ui/action-bar/ActionBar.story";
import { ResponsiveDrawerStory } from "~/ui/responsive-drawer/ResponsiveDrawer.story";
import { LayDownViewStory } from "~/ui/lay-down-view/LayDownView.story";
import { LayDownBug34ReproStory } from "~/ui/lay-down-view/LayDownBug34Repro.story";
import { LayOffViewStory } from "~/ui/lay-off-view/LayOffView.story";
import { DiscardViewStory } from "~/ui/discard-view/DiscardView.story";
import { OrganizeHandViewStory } from "~/ui/organize-hand/OrganizeHandView.story";
import { SwapJokerViewStory } from "~/ui/swap-joker-view/SwapJokerView.story";
import { MayIRequestViewStory } from "~/ui/may-i-request/MayIRequestView.story";
import { LobbyViewStory } from "~/ui/lobby/LobbyView.story";
import { GameViewStory } from "~/ui/game-view/GameView.story";
import { HandDrawerStory, HandDrawerFullscreenTest } from "~/ui/hand-drawer/HandDrawer.story";

const STORIES: Array<{ path: string; label: string; component: React.ComponentType; fullscreen?: boolean }> = [
  { path: "game-view", label: "GameView (Layout)", component: GameViewStory },
  { path: "hand-drawer", label: "HandDrawer (Mobile)", component: HandDrawerStory },
  { path: "hand-drawer-fullscreen", label: "HandDrawer (Fullscreen)", component: HandDrawerFullscreenTest, fullscreen: true },
  { path: "lobby-view", label: "LobbyView", component: LobbyViewStory },
  { path: "playing-card", label: "PlayingCard", component: PlayingCardStory },
  { path: "hand-display", label: "HandDisplay", component: HandDisplayStory },
  { path: "meld-display", label: "MeldDisplay", component: MeldDisplayStory },
  { path: "discard-pile", label: "DiscardPileDisplay", component: DiscardPileDisplayStory },
  { path: "player-melds", label: "PlayerMeldsDisplay", component: PlayerMeldsDisplayStory },
  { path: "table-display", label: "TableDisplay", component: TableDisplayStory },
  { path: "players-table", label: "PlayersTableDisplay", component: PlayersTableDisplayStory },
  { path: "game-header", label: "GameHeader", component: GameHeaderStory },
  { path: "activity-log", label: "ActivityLog", component: ActivityLogStory },
  { path: "action-bar", label: "ActionBar", component: ActionBarStory },
  { path: "responsive-drawer", label: "ResponsiveDrawer", component: ResponsiveDrawerStory },
  { path: "lay-down-view", label: "LayDownView", component: LayDownViewStory },
  { path: "bug-34-lay-down", label: "Bug #34 Lay Down Repro", component: LayDownBug34ReproStory },
  { path: "lay-off-view", label: "LayOffView", component: LayOffViewStory },
  { path: "discard-view", label: "DiscardView", component: DiscardViewStory },
  { path: "organize-hand-view", label: "OrganizeHandView", component: OrganizeHandViewStory },
  { path: "swap-joker-view", label: "SwapJokerView", component: SwapJokerViewStory },
  { path: "may-i-request-view", label: "MayIRequestView", component: MayIRequestViewStory },
];

export function StorybookLayout() {
  const params = useParams();
  const currentPath = params["*"] || "";
  const currentStory = STORIES.find((s) => s.path === currentPath);
  const StoryComponent = currentStory?.component;

  // Fullscreen stories render without the sidebar layout
  if (currentStory?.fullscreen && StoryComponent) {
    return <StoryComponent />;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <nav className="w-64 border-r border-border p-4 overflow-y-auto flex-shrink-0">
        <Link to="/" className="text-muted-foreground text-sm hover:underline">
          ← Back to App
        </Link>
        <h1 className="font-bold text-lg mt-4 mb-4">Component Showcase</h1>
        <ul className="space-y-1">
          {STORIES.map((story) => (
            <li key={story.path}>
              <Link
                to={`/storybook/${story.path}`}
                className={`block px-2 py-1 rounded text-sm ${
                  currentPath === story.path
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted"
                }`}
              >
                {story.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {!currentPath && (
          <div className="text-center text-muted-foreground mt-20">
            <h2 className="text-xl font-semibold mb-2">Select a component</h2>
            <p>Choose a component from the sidebar to view its variations.</p>
          </div>
        )}

        {currentPath && !StoryComponent && (
          <div className="text-center mt-20">
            <p className="text-destructive">Story not found: {currentPath}</p>
          </div>
        )}

        {StoryComponent && <StoryComponent />}
      </main>
    </div>
  );
}

export default StorybookLayout;
