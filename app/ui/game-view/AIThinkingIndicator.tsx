import { cn } from "~/shadcn/lib/utils";
import { Bot, Loader2 } from "lucide-react";

interface AIThinkingIndicatorProps {
  playerName: string;
  className?: string;
}

export function AIThinkingIndicator({
  playerName,
  className,
}: AIThinkingIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800",
        className
      )}
    >
      <Bot className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium">{playerName} is thinking...</span>
      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
    </div>
  );
}
