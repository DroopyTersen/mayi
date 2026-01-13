/**
 * ConnectionBanner component
 *
 * Displays a non-intrusive banner when the WebSocket connection is
 * disconnected or reconnecting. Hidden when connected.
 */

import { cn } from "~/shadcn/lib/utils";
import { WifiOff, RefreshCw } from "lucide-react";
import type { ConnectionStatus } from "~/ui/lobby/lobby.types";

interface ConnectionBannerProps {
  /** Current connection status */
  status: ConnectionStatus;
  /** Additional CSS classes */
  className?: string;
}

export function ConnectionBanner({ status, className }: ConnectionBannerProps) {
  // Don't show banner when connected or initially connecting
  if (status === "connected" || status === "connecting") {
    return null;
  }

  const isReconnecting = status === "reconnecting";

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium",
        isReconnecting
          ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-b border-yellow-500/30"
          : "bg-destructive/15 text-destructive border-b border-destructive/30",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {isReconnecting ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Reconnecting...</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Disconnected</span>
        </>
      )}
    </div>
  );
}
