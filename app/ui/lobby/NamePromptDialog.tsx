import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";
import { CharacterPicker, type Character } from "./CharacterPicker";

interface NamePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, avatarId?: string) => void;
  isSubmitting?: boolean;
  defaultAvatarId?: string;
  takenCharacterIds?: string[];
}

export function NamePromptDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  defaultAvatarId,
  takenCharacterIds = [],
}: NamePromptDialogProps) {
  function handleSelect(character: Character) {
    onSubmit(character.name, character.id);
  }

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Join the Game"
      description="Choose your character to join the lobby."
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
