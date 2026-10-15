"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "ge6:wallet";
const EVENT = "ge6:wallet-change";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** The viewer's own wallet, remembered on this device only so the leaderboard can highlight it. */
export function useSavedWallet() {
  const wallet = useSyncExternalStore(subscribe, read, () => null);
  const save = useCallback((address: string | null) => {
    try {
      if (address) localStorage.setItem(KEY, address.toLowerCase());
      else localStorage.removeItem(KEY);
    } catch {
      // Private mode / blocked storage: highlighting just won't persist.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [wallet, save] as const;
}
