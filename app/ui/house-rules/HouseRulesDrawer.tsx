import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";
import { HouseRulesContent } from "./HouseRulesContent";

interface HouseRulesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A responsive drawer/dialog that displays the house rules cheat sheet.
 * Shows as Dialog on desktop (768px+) and bottom Drawer on mobile.
 */
export function HouseRulesDrawer({ open, onOpenChange }: HouseRulesDrawerProps) {
  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="House Rules"
      description="Grandma Jeanne's complete guide to May I?"
      className="sm:max-w-[640px]"
    >
      <HouseRulesContent />
    </ResponsiveDrawer>
  );
}
