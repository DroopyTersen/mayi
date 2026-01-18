import { Lightbulb, X } from "lucide-react";
import { cn } from "~/shadcn/lib/utils";

interface InactivityHintBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function InactivityHintBanner({
  message,
  onDismiss,
  className,
}: InactivityHintBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800",
        className
      )}
      role="status"
    >
      <Lightbulb className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto inline-flex items-center justify-center rounded-md p-1 text-amber-700 hover:text-amber-900"
          aria-label="Dismiss hint"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
