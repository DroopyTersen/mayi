import { cn } from "~/shadcn/lib/utils";
import {
  type Character,
  FAMILY_CHARACTERS,
  HOYLE_CHARACTERS,
} from "./character.data";

export type { Character };
export type CharacterPickerMode = "human" | "ai";

interface CharacterPickerProps {
  mode: CharacterPickerMode;
  selectedId: string | null;
  takenIds?: string[];
  onSelect: (character: Character) => void;
  className?: string;
}

export function CharacterPicker({
  mode,
  selectedId,
  takenIds = [],
  onSelect,
  className,
}: CharacterPickerProps) {
  const primaryCharacters =
    mode === "human" ? FAMILY_CHARACTERS : HOYLE_CHARACTERS;
  const secondaryCharacters =
    mode === "human" ? HOYLE_CHARACTERS : FAMILY_CHARACTERS;

  const primaryLabel = mode === "human" ? "Family" : "Classic Characters";
  const secondaryLabel = mode === "human" ? "Classic Characters" : "Family";

  return (
    <div className={cn("space-y-8", className)}>
      <CharacterGrid
        label={primaryLabel}
        characters={primaryCharacters}
        selectedId={selectedId}
        takenIds={takenIds}
        onSelect={onSelect}
      />
      <CharacterGrid
        label={secondaryLabel}
        characters={secondaryCharacters}
        selectedId={selectedId}
        takenIds={takenIds}
        onSelect={onSelect}
        secondary
      />
    </div>
  );
}

interface CharacterGridProps {
  label: string;
  characters: Character[];
  selectedId: string | null;
  takenIds: string[];
  onSelect: (character: Character) => void;
  secondary?: boolean;
}

function CharacterGrid({
  label,
  characters,
  selectedId,
  takenIds,
  onSelect,
  secondary,
}: CharacterGridProps) {
  return (
    <div className={cn(secondary && "opacity-80")}>
      <h3
        className={cn(
          "text-xs font-semibold uppercase tracking-wider mb-3 pb-1.5 border-b",
          secondary ? "text-muted-foreground/80 border-border/60" : "text-muted-foreground border-border"
        )}
      >
        {label}
      </h3>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(115px, 1fr))",
        }}
      >
        {characters.map((character) => {
          const isTaken = takenIds.includes(character.id);
          const isSelected = selectedId === character.id;

          return (
            <button
              key={character.id}
              type="button"
              disabled={isTaken}
              onClick={() => onSelect(character)}
              className={cn(
                "group relative flex flex-col items-center p-2.5 rounded-xl border-2 transition-all h-[155px]",
                "hover:border-primary hover:bg-accent/50 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "border-primary bg-accent shadow-sm",
                !isSelected && "border-border bg-card",
                isTaken && "opacity-40 cursor-not-allowed hover:border-border hover:bg-card hover:shadow-none"
              )}
            >
              <div className="relative w-full flex-1 min-h-0">
                <img
                  src={character.avatarPath}
                  alt={character.name}
                  className={cn(
                    "w-full h-full object-contain",
                    isTaken && "grayscale"
                  )}
                />
                {isTaken && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-md">
                    <span className="text-xs font-medium text-muted-foreground">
                      Taken
                    </span>
                  </div>
                )}
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-primary-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <span className="font-semibold text-sm mt-1">{character.name}</span>
              <span className="text-[10px] text-muted-foreground text-center line-clamp-1 leading-tight">
                {character.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
