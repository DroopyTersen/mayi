import { useState } from "react";
import { CharacterPicker } from "./CharacterPicker";
import { ViewportComparison } from "~/storybook/ViewportSimulator";
import type { Character } from "./character.data";

function InteractiveCharacterPicker({
  mode,
  takenIds = [],
}: {
  mode: "human" | "ai";
  takenIds?: string[];
}) {
  const [selected, setSelected] = useState<Character | null>(null);

  return (
    <div className="space-y-4">
      <CharacterPicker
        mode={mode}
        selectedId={selected?.id ?? null}
        takenIds={takenIds}
        onSelect={setSelected}
      />
      {selected && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm">
            Selected: <strong>{selected.name}</strong>
          </p>
          <p className="text-xs text-muted-foreground">{selected.description}</p>
        </div>
      )}
    </div>
  );
}

export function CharacterPickerStory() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-2xl font-bold">Character Picker</h1>
        <p className="text-muted-foreground mt-1">
          Grid picker for selecting player avatars. Family characters for humans,
          Hoyle characters for AI.
        </p>
      </header>

      {/* Human Mode */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Human Player Mode</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Family avatars shown first, Hoyle characters below.
        </p>
        <div className="max-w-2xl">
          <InteractiveCharacterPicker mode="human" />
        </div>
      </section>

      {/* AI Mode */}
      <section>
        <h2 className="text-lg font-semibold mb-3">AI Player Mode</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Hoyle characters shown first, family avatars below.
        </p>
        <div className="max-w-2xl">
          <InteractiveCharacterPicker mode="ai" />
        </div>
      </section>

      {/* With Taken Characters */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Taken Characters</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Some characters already selected by other players (ethel, bart, curt).
        </p>
        <div className="max-w-2xl">
          <InteractiveCharacterPicker
            mode="ai"
            takenIds={["ethel", "bart", "curt"]}
          />
        </div>
      </section>

      {/* Responsive Comparison */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Behavior</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Grid uses auto-fill with ~140px minimum tile size via container query.
        </p>
        <ViewportComparison>
          <div className="p-4">
            <InteractiveCharacterPicker mode="human" />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
