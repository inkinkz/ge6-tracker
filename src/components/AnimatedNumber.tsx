"use client";

import { useEffect, useRef, useState } from "react";

/** Tweens to a new value so live updates are noticeable; jumps straight there with reduced motion. */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 900;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = duration ? Math.min(1, (t - t0) / duration) : 1;
      const eased = 1 - (1 - p) ** 3;
      const v = start + (value - start) * eased;
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{format(shown)}</>;
}
