import { useEffect } from 'react';
import { AppState } from 'react-native';

import { notifyChange } from '@/db/live';

// recalculate everything on screen when the app comes back to the front, so the daily number follows the date
export function ForegroundRefresh() {
  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (previous !== 'active' && next === 'active') notifyChange();
      previous = next;
    });
    return () => sub.remove();
  }, []);
  return null;
}
