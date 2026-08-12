"use client";

import { useMemo, useSyncExternalStore } from "react";

function createDelayedVisibilityStore(active: boolean, delayMs: number) {
  let visible = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => active && visible,
    getServerSnapshot: () => false,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (active && !visible && timer === null) {
        timer = setTimeout(() => {
          timer = null;
          visible = true;
          listeners.forEach((notify) => notify());
        }, Math.max(0, delayMs) + 1);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      };
    },
  };
}

export function useDelayedVisibility(active: boolean, delayMs = 300): boolean {
  const store = useMemo(
    () => createDelayedVisibilityStore(active, delayMs),
    [active, delayMs],
  );
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
