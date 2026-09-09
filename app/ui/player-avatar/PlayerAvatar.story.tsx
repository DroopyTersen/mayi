import { useRef, useState } from "react";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";
import { TableDisplay } from "~/ui/game-table/TableDisplay";
import { PlayersTableDisplay } from "~/ui/game-status/PlayersTableDisplay";
import type { ActivityEntry } from "~/ui/game-view/game-view.types";
import { CharacterPicker } from "~/ui/lobby/CharacterPicker";
import { getCharacterById, type Character } from "~/ui/lobby/character.data";
import { PlayerAvatar } from "./PlayerAvatar";
import { AVATAR_ANIMATIONS } from "./avatar-animation.data";
import { useAvatarReaction } from "./useAvatarReaction";

export function PlayerAvatarStory() {
  const [selectedId, setSelectedId] = useState("andrew");
  const picker = useRef<HTMLDetailsElement>(null);
  const selected = getCharacterById(selectedId);
  if (!selected) return null;

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold">PlayerAvatar</h1>
        <p className="text-muted-foreground mt-1">
          Preview turn, lay-down, and lay-off animations for every player as they become available.
        </p>
      </header>

      <details ref={picker} className="rounded-lg border bg-card p-4">
        <summary className="cursor-pointer font-medium">Choose player: {selected.name}</summary>
        <CharacterPicker mode="human" selectedId={selected.id} className="mt-6"
          onSelect={(character) => {
            setSelectedId(character.id);
            if (picker.current) picker.current.open = false;
          }} />
      </details>

      <AvatarAnimationPreview key={selected.id} character={selected} />
    </div>
  );
}

function AvatarAnimationPreview({ character }: { character: Character }) {
  const animations = AVATAR_ANIMATIONS.get(character.id) ?? [];
  const [isActiveTurn, setIsActiveTurn] = useState(animations.includes("turn"));
  const [entries, setEntries] = useState<ActivityEntry[]>([{ id: "ready", message: "" }]);
  const reaction = useAvatarReaction(entries);
  const activeId = isActiveTurn ? character.id : undefined;
  const player = { id: character.id, name: character.name, avatarId: character.id, cardCount: 11, isDown: false, score: 0 };

  function play(action: "laid down contract" | "laid off") {
    setEntries((previous) => [...previous, {
      id: crypto.randomUUID(), playerId: character.id, action,
      message: `${character.name} ${action}`,
    }]);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="min-w-0 rounded-lg border bg-card p-5 space-y-6">
        <header>
          <h2 className="text-lg font-semibold">{character.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {animations.length ? `${animations.length} of 3 animations available` : "Animations haven't been added for this player yet."}
          </p>
        </header>
        <div className="flex flex-wrap justify-around gap-4">
          <figure className="flex flex-col items-center gap-3">
            <img src={character.avatarPath} alt={`${character.name}'s original avatar`} className="w-32 h-32 rounded-full" />
            <figcaption className="text-xs text-muted-foreground">Original</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-3">
            <PlayerAvatar name={character.name} avatarId={character.id} size="preview"
              isActiveTurn={isActiveTurn} reaction={reaction} />
            <figcaption className="text-xs text-muted-foreground">{reaction ? "Nice move" : isActiveTurn ? "Your turn" : "At rest"}</figcaption>
          </figure>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIsActiveTurn(!isActiveTurn)} variant="outline" disabled={!animations.includes("turn")}>
              {isActiveTurn ? "Pause turn" : "Start turn"}
            </Button>
            <Button onClick={() => play("laid down contract")} variant="outline" disabled={!animations.includes("lay-down")}>Play lay-down</Button>
            <Button onClick={() => play("laid off")} variant="outline" disabled={!animations.includes("lay-off")}>Play lay-off</Button>
          </div>
          <p className="text-xs text-muted-foreground">2 seconds · 8 fps · 16 frames per animation</p>
          <p className="text-xs text-muted-foreground">
            Reactions play once, then return to the turn loop or rest. Reduced-motion preferences are respected.
          </p>
        </div>
      </section>

      <section className="min-w-0 rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">At the table</h2>
          <span className="text-xs text-muted-foreground">Actual game sizes</span>
        </div>
        <TableDisplay players={[player]} melds={[]} currentPlayerId={activeId} viewingPlayerId={character.id} avatarReaction={reaction} />
        <div className="-mx-5 sm:mx-0">
          <PlayersTableDisplay players={[player]} activePlayerId={activeId} viewingPlayerId={character.id} avatarReaction={reaction} />
        </div>
        <p aria-live="polite" className={cn("text-sm min-h-5", reaction ? "text-amber-700" : "text-muted-foreground")}>
          {entries.at(-1)?.message}
        </p>
      </section>
    </div>
  );
}
