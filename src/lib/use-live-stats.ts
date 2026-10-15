"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { StatsSnapshot } from "./types";

/*
 * Polling budget: every poll is one Vercel edge request (served from the CDN cache, so it is
 * not a function invocation). Polling stops while the tab is hidden and after the viewer has
 * been idle for a while; any tap/scroll resumes it immediately.
 */
const POLL_MS = Math.max(10, Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_SEC) || 30) * 1000;
const IDLE_MS = Math.max(1, Number(process.env.NEXT_PUBLIC_IDLE_PAUSE_MIN) || 10) * 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export type LiveStatus = "connecting" | "live" | "paused" | "error";

export function useLiveStats(initial: StatsSnapshot | null) {
  const [data, setData] = useState<StatsSnapshot | null>(initial);
  const [status, setStatus] = useState<LiveStatus>(initial ? "live" : "connecting");
  const [refreshing, setRefreshing] = useState(false);
  const resumeRef = useRef<() => void>(() => {});
  const initialUpdatedAt = initial?.updatedAt ?? 0;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inflight = false;
    let failures = 0;
    let lastFetchAt = 0;
    let lastActivityAt = Date.now();
    let paused = false;
    let disposed = false;
    let latestUpdatedAt = initialUpdatedAt;

    async function fetchNow() {
      if (inflight || disposed) return;
      inflight = true;
      setRefreshing(true);
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as StatsSnapshot;
        // CDN edges can briefly disagree; never step backwards in time.
        if (!disposed && next.updatedAt >= latestUpdatedAt) {
          latestUpdatedAt = next.updatedAt;
          setData(next);
        }
        failures = 0;
        if (!paused) setStatus("live");
      } catch {
        failures += 1;
        setStatus("error");
      } finally {
        lastFetchAt = Date.now();
        inflight = false;
        setRefreshing(false);
      }
    }

    function schedule() {
      clearTimeout(timer);
      if (disposed || paused || document.visibilityState !== "visible") return;
      const delay = failures ? Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS) : POLL_MS;
      timer = setTimeout(async () => {
        if (Date.now() - lastActivityAt > IDLE_MS) {
          paused = true;
          setStatus("paused");
          return;
        }
        await fetchNow();
        schedule();
      }, delay);
    }

    async function resume() {
      lastActivityAt = Date.now();
      if (paused) {
        paused = false;
        setStatus("live");
      }
      await fetchNow();
      schedule();
    }
    resumeRef.current = resume;

    // The HTML may be a couple of minutes old (it is regenerated in the background), so catch up now.
    if (!latestUpdatedAt || Date.now() - latestUpdatedAt > 15_000) fetchNow().then(schedule);
    else schedule();

    const onActivity = () => {
      lastActivityAt = Date.now();
      if (paused) resume();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return clearTimeout(timer);
      if (paused) return;
      if (Date.now() - lastFetchAt > POLL_MS) fetchNow().then(schedule);
      else schedule();
    };

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [initialUpdatedAt]);

  const refresh = useCallback(() => resumeRef.current(), []);
  return { data, status, refreshing, refresh, pollSeconds: POLL_MS / 1000 };
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
