import { useState, useEffect, useCallback } from "react";

export interface HashRoute<T extends string> {
  view: T;
  id: string | null;
}

/**
 * Syncs a view + optional entity id with window.location.hash. Hash format
 * is `#view` for top-level tabs or `#view/id` for drilldown pages, so a URL
 * fully describes "which page, which entity" and refreshes / shares survive.
 */
export function useHashRoute<T extends string>(
  validViews: readonly T[],
  defaultView: T,
): [HashRoute<T>, (view: T, id?: string | null) => void] {
  const parse = (): HashRoute<T> => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return { view: defaultView, id: null };
    const slash = raw.indexOf("/");
    const viewPart = slash === -1 ? raw : raw.slice(0, slash);
    const idPart = slash === -1 ? "" : raw.slice(slash + 1);
    const view = (validViews as readonly string[]).includes(viewPart)
      ? (viewPart as T)
      : defaultView;
    const id = idPart ? decodeURIComponent(idPart) : null;
    return { view, id };
  };

  const [route, setRouteRaw] = useState<HashRoute<T>>(parse);

  const setRoute = useCallback((view: T, id: string | null = null) => {
    const encoded = id ? `${view}/${encodeURIComponent(id)}` : view;
    if (window.location.hash.replace(/^#/, "") !== encoded) {
      window.location.hash = encoded;
    }
    setRouteRaw({ view, id });
  }, []);

  useEffect(() => {
    const onHash = () => setRouteRaw(parse());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [route, setRoute];
}
