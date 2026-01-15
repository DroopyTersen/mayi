import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";
import { CharacterPicker, type Character } from "./CharacterPicker";

interface NamePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, avatarId?: string) => void;
  isSubmitting?: boolean;
  mode?: "join" | "change";
  defaultAvatarId?: string;
  takenCharacterIds?: string[];
}

export function NamePromptDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  mode = "join",
  defaultAvatarId,
  takenCharacterIds = [],
}: NamePromptDialogProps) {
  function handleSelect(character: Character) {
    onSubmit(character.name, character.id);
  }

  const title = mode === "change" ? "Change Character" : "Choose Character";
  const description =
    mode === "change"
      ? "Choose a character to update your lobby identity."
      : "Choose your character to join the lobby.";

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="sm:max-w-2xl"
    >
      {isSubmitting ? (
        <div className="flex items-center justify-center py-12">
          <svg
            className="w-8 h-8 animate-spin text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <CharacterPicker
          mode="human"
          selectedId={defaultAvatarId ?? null}
          takenIds={takenCharacterIds}
          onSelect={handleSelect}
        />
      )}
    </ResponsiveDrawer>
  );
}
