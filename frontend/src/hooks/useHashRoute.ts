import { useState, useEffect, useCallback } from "react";

export interface HashRoute<T extends string> {
  view: T;
  id: string | null;
}

/**
 * Syncs a `{view, id}` route with `window.location.hash` so refresh,
 * Back/Forward, and shareable URLs all "just work" without a real router.
 *
 * Hash shape:
 *   #view          tab-only (e.g. `#home`, `#issues`)
 *   #view/id       drilldown (e.g. `#paper-detail/paper-001`)
 *
 * The view portion is validated against `validViews` — anything else falls
 * back to `defaultView`. The id is opaque to the hook and URL-encoded on
 * write / decoded on read, so slugs containing `/`, spaces, or unicode are
 * safe.
 *
 * Convention for callers: derive per-drilldown ids from the route, gated on
 * the current view, so a stale id from another view can't leak in:
 *
 *     const viewingPaperId = currentView === "paper-detail" ? route.id : null;
 *
 * Limitations to keep in mind:
 *  - Single id slot per view. If a view needs two ids (e.g. team + channel),
 *    encode them as a composite (`team:channel`) and split in the consumer.
 *  - No id type safety: `setRoute("paper-detail", "user001")` compiles fine.
 *    Validate at the render boundary (`papers.find(p => p.id === route.id)`).
 *  - Hash-only — invisible to SSR, OpenGraph crawlers, search engines. If
 *    those ever matter, swap in a path-based router.
 *  - Beware in-page anchors (`<a href="#section">`); they would clobber the
 *    route. No env uses them today.
 *  - Refresh on a deleted entity falls through to the view's not-found
 *    branch — by design.
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
