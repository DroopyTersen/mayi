import * as React from "react";

type MediaQueryOverrides = Record<string, boolean>;

const MediaQueryOverrideContext = React.createContext<MediaQueryOverrides>({});

export function MediaQueryOverrideProvider({
  overrides,
  children,
}: {
  overrides: MediaQueryOverrides;
  children: React.ReactNode;
}) {
  return (
    <MediaQueryOverrideContext.Provider value={overrides}>
      {children}
    </MediaQueryOverrideContext.Provider>
  );
}

export function useMediaQueryOverrides(): MediaQueryOverrides {
  return React.useContext(MediaQueryOverrideContext);
}

