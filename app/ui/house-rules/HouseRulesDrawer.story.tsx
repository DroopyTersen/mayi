import { useState } from "react";
import { HouseRulesDrawer } from "./HouseRulesDrawer";
import { HouseRulesContent } from "./HouseRulesContent";
import { Button } from "~/shadcn/components/ui/button";
import { HelpCircle, BookOpen } from "lucide-react";

export function HouseRulesDrawerStory() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">HouseRulesDrawer</h1>
        <p className="text-muted-foreground mt-1">
          Displays house rules as a Dialog on desktop (768px+) or Drawer on
          mobile. Used in GameHeader and home page.
        </p>
      </header>

      {/* Game Header Button Example */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Game Header Button</h2>
        <p className="text-sm text-muted-foreground mb-3">
          In the game header, a HelpCircle icon opens the rules.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDrawerOpen(true)}
          >
            <HelpCircle className="h-5 w-5" />
            <span className="sr-only">View house rules</span>
          </Button>
          <span className="text-sm text-muted-foreground">
            Click the icon to open
          </span>
        </div>
        <HouseRulesDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      </section>

      {/* Home Page Button Example */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Home Page Button</h2>
        <p className="text-sm text-muted-foreground mb-3">
          On the home page, a full button with text opens the rules.
        </p>
        <HomePageButtonExample />
      </section>

      {/* Content Preview */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Content Preview</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Direct preview of HouseRulesContent without the drawer wrapper.
        </p>
        <div className="border rounded-lg p-4 max-w-md">
          <HouseRulesContent />
        </div>
      </section>
    </div>
  );
}

function HomePageButtonExample() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BookOpen className="h-4 w-4 mr-2" />
        View House Rules
      </Button>
      <HouseRulesDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
