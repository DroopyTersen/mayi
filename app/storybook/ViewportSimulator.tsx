import { useState } from "react";
import { cn } from "~/shadcn/lib/utils";

type Viewport = "phone" | "tablet" | "desktop" | "full";

interface ViewportConfig {
  label: string;
  width: string;
  description: string;
}

const VIEWPORTS: Record<Viewport, ViewportConfig> = {
  phone: {
    label: "Phone",
    width: "375px",
    description: "iPhone SE/Mini size",
  },
  tablet: {
    label: "Tablet",
    width: "768px",
    description: "iPad Mini/Small tablet",
  },
  desktop: {
    label: "Desktop",
    width: "1024px",
    description: "Small laptop",
  },
  full: {
    label: "Full",
    width: "100%",
    description: "Full width",
  },
};

interface ViewportSimulatorProps {
  children: React.ReactNode;
  defaultViewport?: Viewport;
  showControls?: boolean;
  className?: string;
}

/**
 * Wraps content in a container that simulates different viewport sizes.
 * Uses container queries, so child components using @container will respond.
 */
export function ViewportSimulator({
  children,
  defaultViewport = "full",
  showControls = true,
  className,
}: ViewportSimulatorProps) {
  const [viewport, setViewport] = useState<Viewport>(defaultViewport);
  const config = VIEWPORTS[viewport];

  return (
    <div className={cn("space-y-4", className)}>
      {showControls && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Viewport:</span>
          {(Object.keys(VIEWPORTS) as Viewport[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewport(v)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                viewport === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {VIEWPORTS[v].label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            ({config.width} - {config.description})
          </span>
        </div>
      )}

      {/* Container with @container query support */}
      <div
        className={cn(
          "border border-dashed border-muted-foreground/30 rounded-lg overflow-hidden transition-all duration-300",
          viewport !== "full" && "mx-auto"
        )}
        style={{
          maxWidth: config.width,
          containerType: "inline-size",
        }}
      >
        <div className="bg-background">{children}</div>
      </div>
    </div>
  );
}

/**
 * Shows the same content at all viewport sizes side by side for comparison.
 */
interface ViewportComparisonProps {
  children: React.ReactNode;
  viewports?: Viewport[];
  className?: string;
}

export function ViewportComparison({
  children,
  viewports = ["phone", "tablet", "desktop"],
  className,
}: ViewportComparisonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {viewports.map((viewport) => {
        const config = VIEWPORTS[viewport];
        return (
          <div key={viewport} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{config.label}</span>
              <span className="text-xs text-muted-foreground">
                ({config.width})
              </span>
            </div>
            <div
              className="border border-dashed border-muted-foreground/30 rounded-lg overflow-hidden"
              style={{
                maxWidth: config.width,
                containerType: "inline-size",
              }}
            >
              <div className="bg-background">{children}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
