import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { WonderSheet } from './wonder-sheet';

interface WonderSheetContextValue {
  visible: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const WonderSheetContext = createContext<WonderSheetContextValue | null>(null);

/**
 * Singleton mount-point for the create-adventure sheet at the root of
 * the navigation tree. Mounting the sheet here (rather than inside the
 * tab-bar's own container) is what lets the Skia blob extend full-
 * screen — the tab-bar container is itself an absolutely-positioned
 * sliver pinned to the bottom, so any `StyleSheet.absoluteFill` nested
 * inside it would only cover the tab-bar's height. Same trick the
 * sidebar uses (see [[sidebar-host]]).
 */
export function WonderSheetHost({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const toggle = useCallback(() => setVisible((v) => !v), []);

  const value = useMemo<WonderSheetContextValue>(
    () => ({ visible, open, close, toggle }),
    [visible, open, close, toggle],
  );

  return (
    <WonderSheetContext.Provider value={value}>
      {children}
      <WonderSheet open={visible} onClose={close} onToggle={toggle} />
    </WonderSheetContext.Provider>
  );
}

export function useWonderSheet(): WonderSheetContextValue {
  const ctx = useContext(WonderSheetContext);
  if (!ctx) {
    throw new Error('useWonderSheet must be used inside <WonderSheetHost>');
  }
  return ctx;
}
