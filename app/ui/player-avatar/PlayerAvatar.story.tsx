import { useState } from "react";
import { Link } from "react-router";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";
import { TableDisplay } from "~/ui/game-table/TableDisplay";
import { PlayersTableDisplay } from "~/ui/game-status/PlayersTableDisplay";
import type { ActivityEntry } from "~/ui/game-view/game-view.types";
import { PlayerAvatar } from "./PlayerAvatar";
import { useAvatarReaction } from "./useAvatarReaction";

const FAMILY = [
  { id: "andrew", name: "Andrew", avatarId: "andrew", cardCount: 11, isDown: false, score: 0 },
  { id: "jane", name: "Jane", avatarId: "jane", cardCount: 11, isDown: false, score: 0 },
];

export function PlayerAvatarStory() {
  const [selectedId, setSelectedId] = useState("andrew");
  const [activeId, setActiveId] = useState<string | undefined>("andrew");
  const [entries, setEntries] = useState<ActivityEntry[]>([{ id: "ready", message: "Ready to play" }]);
  const reaction = useAvatarReaction(entries);
  const selected = FAMILY.find((player) => player.id === selectedId) ?? FAMILY[0];
  if (!selected) return null;

  function play(action: "laid down contract" | "laid off") {
    setEntries((previous) => [...previous, {
      id: crypto.randomUUID(), playerId: selectedId, action,
      message: `${selected?.name} ${action}`,
    }]);
  }

  return (
    <main className="min-h-screen bg-[#faf8f3] text-slate-900 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <Link to="/" className="text-sm text-slate-500 hover:underline">← Back to May I?</Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">A little more personality</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Family avatars, in motion.</h1>
          <p className="text-slate-600 max-w-xl">A quiet moment while it’s your turn. A little celebration when your cards hit the table.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <section className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7 space-y-6">
            <div className="flex gap-2" aria-label="Choose a family avatar">
              {FAMILY.map((player) => (
                <Button key={player.id} variant={selectedId === player.id ? "default" : "outline"}
                  aria-pressed={selectedId === player.id} onClick={() => setSelectedId(player.id)}>
                  {player.name}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 py-4">
              <figure className="flex flex-col items-center gap-3">
                <img src={`/avatars/${selected.avatarId}.svg`} alt={`${selected.name}'s original avatar`} className="w-32 h-32 rounded-full" />
                <figcaption className="text-xs text-slate-500">Original</figcaption>
              </figure>
              <figure className="flex flex-col items-center gap-3">
                <PlayerAvatar name={selected.name} avatarId={selected.avatarId} size="preview"
                  isActiveTurn={activeId === selected.id} reaction={reaction?.playerId === selected.id ? reaction : null} />
                <figcaption className="text-xs text-slate-500">{reaction?.playerId === selected.id ? "Nice move" : activeId === selected.id ? "Your turn" : "At rest"}</figcaption>
              </figure>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setActiveId(activeId === selectedId ? undefined : selectedId)} variant="outline">
                  {activeId === selectedId ? "Pause turn" : "Start turn"}
                </Button>
                <Button onClick={() => play("laid down contract")} variant="outline">Play lay-down</Button>
                <Button onClick={() => play("laid off")} variant="outline">Play lay-off</Button>
              </div>
              <p className="text-xs text-slate-500">2 seconds · 8 fps · 16 frames per animation</p>
              <p className="text-xs text-slate-500">Reactions play once, then return to the turn loop or rest. Your device’s reduced-motion preference is respected.</p>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7 space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">At the table</h2>
              <span className="text-xs text-slate-500">Actual game sizes</span>
            </div>
            <TableDisplay players={FAMILY} melds={[]} currentPlayerId={activeId} viewingPlayerId="andrew" avatarReaction={reaction} />
            <div className="-mx-5 sm:mx-0">
              <PlayersTableDisplay players={FAMILY} activePlayerId={activeId} viewingPlayerId="andrew" avatarReaction={reaction} />
            </div>
            <p aria-live="polite" className={cn("text-sm min-h-5", reaction ? "text-amber-700" : "text-slate-500")}>
              {entries.at(-1)?.message}
            </p>
          </section>
        </div>
        <p className="text-sm text-slate-500">Try these in a local game by choosing Andrew or Jane in the character picker.</p>
      </div>
    </main>
  );
}
