import { useMediaQuery } from "~/shadcn/hooks/useMediaQuery";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "~/shadcn/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/shadcn/components/ui/drawer";
import { cn } from "~/shadcn/lib/utils";

interface ResponsiveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Optional trigger element - if not provided, must control open/close externally */
  trigger?: React.ReactNode;
  /** Footer content (buttons, etc) */
  footer?: React.ReactNode;
  /** Custom class for the content container */
  className?: string;
}

/**
 * A responsive component that renders as a Dialog on desktop (>=768px)
 * and as a bottom Drawer on mobile (<768px).
 */
export function ResponsiveDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
  footer,
  className,
}: ResponsiveDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className={cn("sm:max-w-[425px] max-h-[85vh] flex flex-col", className)}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="py-4 flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
          {footer && <DialogFooter className="flex-shrink-0">{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
      <DrawerContent className={cn("flex flex-col", className)}>
        <DrawerHeader className="text-left flex-shrink-0">
          <DrawerTitle>{title}</DrawerTitle>
          {description && (
            <DrawerDescription>{description}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="px-4 pb-4 flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
        {footer && <DrawerFooter className="pt-2 flex-shrink-0">{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}

// Re-export close buttons for convenience
export { DialogClose, DrawerClose };
