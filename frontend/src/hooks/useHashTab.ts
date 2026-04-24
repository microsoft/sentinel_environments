import { useState, useEffect, useCallback } from "react";

/**
 * Syncs a tab/view state variable with window.location.hash so the active tab
 * persists across page refreshes and supports browser back/forward navigation.
 *
 * @param validValues - The set of allowed hash values (used to ignore invalid hashes)
 * @param defaultValue - Fallback when the hash is empty or invalid
 * @returns [currentValue, setValue] — drop-in replacement for useState
 */
export function useHashTab<T extends string>(
  validValues: readonly T[],
  defaultValue: T,
): [T, (value: T) => void] {
  const read = (): T => {
    const h = window.location.hash.replace(/^#/, "");
    return (validValues as readonly string[]).includes(h) ? (h as T) : defaultValue;
  };

  const [value, setValueRaw] = useState<T>(read);

  const setValue = useCallback(
    (next: T) => {
      window.location.hash = next;
      setValueRaw(next);
    },
    [],
  );

  useEffect(() => {
    const onHash = () => setValueRaw(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [value, setValue];
}
