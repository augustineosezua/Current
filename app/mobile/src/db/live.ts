// Tiny change signal: writes call notifyChange, screens re-read. No React or Expo imports, so vitest can load it.
const listeners = new Set<() => void>();
let version = 0;

// tell every mounted query that local data changed
export function notifyChange(): void {
  version++;
  for (const listener of listeners) listener();
}

// subscribe/getSnapshot pair for useSyncExternalStore
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getVersion(): number {
  return version;
}
