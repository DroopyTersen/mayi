import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";
import { Button } from "~/shadcn/components/ui/button";
import { Input } from "~/shadcn/components/ui/input";

const MAX_NAME_LEN = 24;

interface NamePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  isSubmitting?: boolean;
  defaultName?: string;
}

export function NamePromptDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  defaultName = "",
}: NamePromptDialogProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get("player-name") as string).trim();
    if (name) {
      onSubmit(name);
    }
  }

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Join the Game"
      description="Enter your name to join the lobby."
      footer={
        <div className="flex gap-2 w-full sm:justify-end">
          <Button
            type="submit"
            form="name-form"
            disabled={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="w-4 h-4 mr-2 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                Joining...
              </>
            ) : (
              "Join Game"
            )}
          </Button>
        </div>
      }
    >
      <form id="name-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="player-name"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Your Name
          </label>
          <Input
            id="player-name"
            name="player-name"
            placeholder="Enter your name"
            defaultValue={defaultName}
            maxLength={MAX_NAME_LEN}
            required
            autoFocus
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Max {MAX_NAME_LEN} characters
          </p>
        </div>
      </form>
    </ResponsiveDrawer>
  );
}
