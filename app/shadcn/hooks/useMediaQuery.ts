import { useState, useEffect } from "react";
import { useMediaQueryOverrides } from "./mediaQueryOverrides";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const overrides = useMediaQueryOverrides();
  const overridden = overrides[query];

  useEffect(() => {
    if (overridden !== undefined) return;
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Create listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    media.addEventListener("change", listener);

    // Cleanup
    return () => {
      media.removeEventListener("change", listener);
    };
  }, [query, overridden]);

  return overridden ?? matches;
}
