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
import { Input } from "~/shadcn/components/ui/input";
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

interface AddAIPlayerDialogProps {
  onAdd: (name: string, modelId: AIModelId) => void;
  disabled?: boolean;
}

export function AddAIPlayerDialog({ onAdd, disabled }: AddAIPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState<AIModelId>("xai:grok-4-1-fast-reasoning");

  const handleAdd = () => {
    if (name.trim().length === 0) return;
    onAdd(name.trim(), modelId);
    setName("");
    setModelId("xai:grok-4-1-fast-reasoning");
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setName("");
      setModelId("xai:grok-4-1-fast-reasoning");
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add AI Player</DialogTitle>
          <DialogDescription>
            Add an AI opponent to the game. Choose a name and select which AI
            model to use.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-name">Name</Label>
            <Input
              id="ai-name"
              placeholder="Enter AI player name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              autoFocus
            />
          </div>
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
          <Button onClick={handleAdd} disabled={name.trim().length === 0}>
            Add Player
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
