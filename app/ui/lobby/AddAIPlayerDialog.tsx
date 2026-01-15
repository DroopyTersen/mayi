import { useState } from "react";
import { Button } from "~/shadcn/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/shadcn/components/ui/dialog";
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
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [modelId, setModelId] = useState<AIModelId>("default:grok");

  const handleAdd = () => {
    if (!selectedCharacter) return;
    onAdd(selectedCharacter.name, modelId, selectedCharacter.id);
    setSelectedCharacter(null);
    setModelId("default:grok");
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setSelectedCharacter(null);
      setModelId("default:grok");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} className="gap-2">
          <Bot className="h-4 w-4" />
          <span>Add AI Player</span>
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add AI Player</DialogTitle>
          <DialogDescription>
            Choose a character for the AI opponent.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <CharacterPicker
            mode="ai"
            selectedId={selectedCharacter?.id ?? null}
            takenIds={takenCharacterIds}
            onSelect={setSelectedCharacter}
          />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selectedCharacter}>
            Add Player
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
