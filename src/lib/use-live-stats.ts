"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PollPolicy } from "./config";
import type { StatsSnapshot } from "./types";

/*
 * Polling budget: every poll is one Vercel CDN request (Hobby includes 1M/month). The server
 * decides the rate (TRAFFIC_MODE → `policy` in every response). Auto-refresh runs for a fixed
 * window (`autoMin`, 5 min by default) after the page opens, then stops by itself so a forgotten
 * tab costs nothing; tapping the status pill refreshes and starts a new window. Polling also
 * pauses while the tab is hidden, and in "surge" mode it's off entirely. A short browser cache
 * on /api/stats makes rapid taps free.
 */
const DEFAULT_POLICY: PollPolicy = { mode: "normal", pollSec: 60, autoMin: 5 };
const MAX_BACKOFF_MS = 5 * 60_000;
const MIN_DELAY_MS = 5_000;

/**
 * "paused" = the auto-refresh window ran out (tap to continue).
 * "manual" = auto-refresh is switched off by the server (surge mode).
 */
export type LiveStatus = "connecting" | "live" | "paused" | "manual" | "error";

export function useLiveStats(initial: StatsSnapshot | null) {
  const initialPolicy = initial?.policy ?? DEFAULT_POLICY;
  const [data, setData] = useState<StatsSnapshot | null>(initial);
  const [policy, setPolicy] = useState<PollPolicy>(initialPolicy);
  const [status, setStatus] = useState<LiveStatus>(
    !initial ? "connecting" : initialPolicy.pollSec > 0 ? "live" : "manual",
  );
  const [refreshing, setRefreshing] = useState(false);
  const resumeRef = useRef<() => void>(() => {});
  const initialUpdatedAt = initial?.updatedAt ?? 0;
  const initialPollSec = initialPolicy.pollSec;
  const initialAutoMin = initialPolicy.autoMin;

  useEffect(() => {
    let current: PollPolicy = { mode: "normal", pollSec: initialPollSec, autoMin: initialAutoMin };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inflight = false;
    let failures = 0;
    let paused = false;
    let disposed = false;
    let latestUpdatedAt = initialUpdatedAt;
    /** Client time when the data we show was last known fresh. */
    let freshAt = initialUpdatedAt ? Math.min(Date.now(), initialUpdatedAt) : 0;
    /** Auto-refresh runs for `autoMin` from here, then waits for the viewer to tap to continue. */
    let windowStartedAt = Date.now();
    // Derived from the latest policy, so switching TRAFFIC_MODE also shortens windows in open tabs.
    const windowEndsAt = () => windowStartedAt + current.autoMin * 60_000;

    const pollMs = () => current.pollSec * 1000;
    const autoStatus = (): LiveStatus => (current.pollSec > 0 ? "live" : "manual");

    async function fetchNow() {
      if (inflight || disposed) return;
      inflight = true;
      setRefreshing(true);
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as StatsSnapshot;
        if (next.policy) {
          current = next.policy;
          setPolicy(next.policy);
        }
        // CDN edges can briefly disagree; never step backwards in time.
        if (!disposed && next.updatedAt >= latestUpdatedAt) {
          latestUpdatedAt = next.updatedAt;
          setData(next);
        }
        freshAt = Date.now();
        failures = 0;
        if (!paused) setStatus(autoStatus());
      } catch {
        failures += 1;
        setStatus("error");
      } finally {
        inflight = false;
        setRefreshing(false);
      }
    }

    function pauseIfWindowOver() {
      if (Date.now() < windowEndsAt()) return false;
      clearTimeout(timer);
      paused = true;
      setStatus("paused");
      return true;
    }

    function schedule(delayMs?: number) {
      clearTimeout(timer);
      if (disposed || paused || current.pollSec <= 0 || document.visibilityState !== "visible") return;
      if (pauseIfWindowOver()) return;
      const base = pollMs();
      const wanted = delayMs ?? (failures ? Math.min(base * 2 ** failures, MAX_BACKOFF_MS) : base);
      // Wake up at the end of the window too, so the pill flips to "paused" on time.
      const delay = Math.min(Math.max(MIN_DELAY_MS, wanted), Math.max(0, windowEndsAt() - Date.now()));
      timer = setTimeout(async () => {
        if (pauseIfWindowOver()) return;
        await fetchNow();
        schedule();
      }, delay);
    }

    /** Poll now if our data is a full interval old, otherwise wait out the remainder. */
    function catchUp() {
      if (current.pollSec <= 0 || pauseIfWindowOver()) return;
      const age = Date.now() - freshAt;
      if (!freshAt || age >= pollMs()) fetchNow().then(() => schedule());
      else schedule(pollMs() - age);
    }

    /** Explicit tap: refresh now and, if auto-refresh is on, start a new window. */
    async function resume() {
      await fetchNow();
      windowStartedAt = Date.now();
      if (paused) {
        paused = false;
        if (!failures) setStatus(autoStatus());
      }
      schedule();
    }
    resumeRef.current = resume;

    // The page HTML already carries a snapshot (regenerated about once a minute), so a new
    // visitor usually doesn't need an extra request until the first scheduled poll.
    if (!latestUpdatedAt) fetchNow().then(() => schedule());
    else catchUp();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return clearTimeout(timer);
      if (!paused) catchUp();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [initialUpdatedAt, initialPollSec, initialAutoMin]);

  const refresh = useCallback(() => resumeRef.current(), []);
  return { data, status, refreshing, refresh, pollSeconds: policy.pollSec, autoMinutes: policy.autoMin };
}

/** Current time, ticking at `granularityMs`. Returns 0 during SSR/hydration so markup matches. */
const subscribers = new Map<number, (cb: () => void) => () => void>();
export function useNow(granularityMs = 1000): number {
  let subscribe = subscribers.get(granularityMs);
  if (!subscribe) {
    subscribe = (cb) => {
      const id = setInterval(cb, granularityMs);
      return () => clearInterval(id);
    };
    subscribers.set(granularityMs, subscribe);
  }
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / granularityMs) * granularityMs,
    () => 0,
  );
}
