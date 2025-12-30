import { useState } from "react";
import { ResponsiveDrawer, DialogClose, DrawerClose } from "./ResponsiveDrawer";
import { Button } from "~/shadcn/components/ui/button";
import { useMediaQuery } from "~/shadcn/hooks/useMediaQuery";

function ExampleContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This content is shared between the Dialog (desktop) and Drawer (mobile) views.
      </p>
      <div className="grid gap-2">
        <label className="text-sm font-medium">Player Name</label>
        <input
          type="text"
          placeholder="Enter name..."
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium">Starting Score</label>
        <input
          type="number"
          placeholder="0"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

function ResponsiveFooter({ onSave }: { onSave: () => void }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const CloseButton = isDesktop ? DialogClose : DrawerClose;

  return (
    <>
      <CloseButton asChild>
        <Button variant="outline">Cancel</Button>
      </CloseButton>
      <Button onClick={onSave}>Save Changes</Button>
    </>
  );
}

export function ResponsiveDrawerStory() {
  const [basicOpen, setBasicOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const handleSave = () => {
    alert("Saved!");
    setFormOpen(false);
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">ResponsiveDrawer</h1>
        <p className="text-muted-foreground mt-1">
          Shows as Dialog on desktop (768px+) and Drawer on mobile.
        </p>
      </header>

      {/* Basic Usage */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Basic Usage</h2>
        <Button onClick={() => setBasicOpen(true)}>Open Basic</Button>
        <ResponsiveDrawer
          open={basicOpen}
          onOpenChange={setBasicOpen}
          title="Basic Example"
          description="This is a basic responsive drawer/dialog."
        >
          <p>Hello! This content appears in both desktop and mobile views.</p>
        </ResponsiveDrawer>
        <p className="text-xs text-muted-foreground mt-2">
          Resize window below 768px to see Drawer, above to see Dialog.
        </p>
      </section>

      {/* With Trigger */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Trigger</h2>
        <ResponsiveDrawer
          open={triggerOpen}
          onOpenChange={setTriggerOpen}
          title="Triggered Example"
          trigger={<Button variant="outline">Open with Trigger</Button>}
        >
          <p>This example uses the built-in trigger prop.</p>
        </ResponsiveDrawer>
      </section>

      {/* With Form */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Form Content</h2>
        <Button onClick={() => setFormOpen(true)}>Edit Player</Button>
        <ResponsiveDrawer
          open={formOpen}
          onOpenChange={setFormOpen}
          title="Edit Player"
          description="Update player information for the game."
          footer={<ResponsiveFooter onSave={handleSave} />}
        >
          <ExampleContent />
        </ResponsiveDrawer>
      </section>

      {/* Current Mode Indicator */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Current Mode</h2>
        <CurrentModeIndicator />
      </section>
    </div>
  );
}

function CurrentModeIndicator() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return (
    <div className="p-4 rounded-lg border">
      <p className="text-sm">
        Current viewport:{" "}
        <span className="font-medium">
          {isDesktop ? "Desktop (Dialog mode)" : "Mobile (Drawer mode)"}
        </span>
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Breakpoint: 768px
      </p>
    </div>
  );
}
