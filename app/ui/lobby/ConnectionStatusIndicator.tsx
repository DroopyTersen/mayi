import { cn } from "~/shadcn/lib/utils";
import type { ConnectionStatus } from "./lobby.types";

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  className?: string;
}

const STATUS_CONFIG = {
  connecting: {
    label: "Connecting...",
    dotClass: "bg-yellow-500 animate-pulse",
    textClass: "text-yellow-600",
  },
  connected: {
    label: "Connected",
    dotClass: "bg-green-500",
    textClass: "text-green-600",
  },
  disconnected: {
    label: "Disconnected",
    dotClass: "bg-red-500",
    textClass: "text-red-600",
  },
} as const;

export function ConnectionStatusIndicator({
  status,
  className,
}: ConnectionStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      <span className={cn("w-2 h-2 rounded-full", config.dotClass)} />
      <span className={config.textClass}>{config.label}</span>
    </div>
  );
}
