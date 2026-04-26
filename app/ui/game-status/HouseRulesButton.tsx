import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "~/shadcn/lib/utils";
import { Button } from "~/shadcn/components/ui/button";
import { HouseRulesDrawer } from "~/ui/house-rules/HouseRulesDrawer";

interface HouseRulesButtonProps {
  className?: string;
}

export function HouseRulesButton({ className }: HouseRulesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", className)}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-5 w-5" />
        <span className="sr-only">View house rules</span>
      </Button>
      <HouseRulesDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
