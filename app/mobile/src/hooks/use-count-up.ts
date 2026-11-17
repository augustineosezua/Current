import { useEffect, useRef, useState } from 'react';

import { useReduceMotion } from './use-reduce-motion';

const DURATION_MS = 600;

// eases a displayed integer towards `target`; jumps straight there under Reduce Motion
export function useCountUp(target: number): number {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  // animate from the last shown value whenever the target changes
  useEffect(() => {
    if (reduce || from.current === target) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const startedAt = Date.now();
    let frame = 0;

    // ease-out cubic, rounded so money stays whole cents
    const tick = () => {
      const t = Math.min(1, (Date.now() - startedAt) / DURATION_MS);
      const value = Math.round(start + (target - start) * (1 - (1 - t) ** 3));
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduce]);

  return shown;
}
