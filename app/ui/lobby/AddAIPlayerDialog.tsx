import { useState } from "react";
import { Button } from "~/shadcn/components/ui/button";
import { Label } from "~/shadcn/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/shadcn/components/ui/select";
import {
  AI_MODEL_IDS,
  AI_MODEL_DISPLAY_NAMES,
  type AIModelId,
} from "~/party/protocol.types";
import { Bot, Plus } from "lucide-react";
import { CharacterPicker, type Character } from "./CharacterPicker";
import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";

interface AddAIPlayerDialogProps {
  onAdd: (name: string, modelId: AIModelId, avatarId: string) => void;
  takenCharacterIds?: string[];
  disabled?: boolean;
}

export function AddAIPlayerDialog({
  onAdd,
  takenCharacterIds = [],
  disabled,
}: AddAIPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState<AIModelId>("default:grok");

  const handleSelect = (character: Character) => {
    onAdd(character.name, modelId, character.id);
    setModelId("default:grok");
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setModelId("default:grok");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <Bot className="h-4 w-4" />
        <span>Add AI Player</span>
        <Plus className="h-4 w-4" />
      </Button>
      <ResponsiveDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Add AI Player"
        description="Choose a character for the AI opponent."
        className="sm:max-w-2xl"
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-model">AI Model</Label>
            <Select value={modelId} onValueChange={(v) => setModelId(v as AIModelId)}>
              <SelectTrigger id="ai-model">
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODEL_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {AI_MODEL_DISPLAY_NAMES[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CharacterPicker
            mode="ai"
            selectedId={null}
            takenIds={takenCharacterIds}
            onSelect={handleSelect}
          />
        </div>
      </ResponsiveDrawer>
    </>
  );
}
