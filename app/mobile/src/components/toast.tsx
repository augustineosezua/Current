import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

const VISIBLE_MS = 5000;

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const ToastContext = createContext<(toast: ToastOptions) => void>(() => {});

// show a confirmation pill, e.g. "Logged $45.00 from Phone" with Undo
export function useToast(): (toast: ToastOptions) => void {
  return use(ToastContext);
}

// holds the current toast and draws it above the tab bar
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const show = useCallback((next: ToastOptions) => setToast({ ...next, key: Date.now() }), []);

  // hide after a few seconds; a newer toast restarts the clock
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" className="absolute bottom-32 left-5 right-5 items-center">
          <View
            accessibilityLiveRegion="polite"
            className="min-h-12 flex-row items-center gap-4 rounded-full border-2 border-edge bg-cta px-5 py-2">
            <Text className="shrink font-sans-medium text-base text-on-cta">{toast.message}</Text>
            {toast.actionLabel ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
                accessibilityRole="button"
                hitSlop={12}>
                <Text className="font-sans-bold text-base text-on-cta underline">{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ToastContext>
  );
}
