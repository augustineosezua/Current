import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// true while the system Reduce Motion setting is on
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  // read once, then follow changes
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
