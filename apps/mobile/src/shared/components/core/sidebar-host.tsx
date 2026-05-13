import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Sidebar, type SidebarItem } from './sidebar';

/**
 * Configuration the caller hands to the sidebar at open time. The sidebar
 * doesn't keep this between sessions — closing clears the config.
 */
export interface SidebarOpenConfig {
  side?: 'left' | 'right';
  items: SidebarItem[];
  /** Custom React node rendered above the items (e.g. avatar + name + actions). */
  header?: ReactNode;
}

interface SidebarContextValue {
  /** Whether the sidebar is currently visible. */
  visible: boolean;
  /** Open the sidebar with a fresh config. Replaces any previous config. */
  open: (config: SidebarOpenConfig) => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Singleton sidebar mounted near the root of the app, ABOVE the rest of
 * the navigation tree but INSIDE the `ColorSchemeProvider`'s captured
 * view. Any screen can trigger it via `useSidebar().open(...)`. The
 * benefit of mounting once at root: tabs/screens don't each carry their
 * own `<Sidebar>` — and the animated theme transition captures the
 * sidebar in its snapshot so the reveal looks right when the menu is open.
 */
export function SidebarHost({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SidebarOpenConfig | null>(null);
  const visible = config !== null;

  const open = useCallback((next: SidebarOpenConfig) => {
    setConfig(next);
  }, []);

  const close = useCallback(() => {
    setConfig(null);
  }, []);

  const value = useMemo<SidebarContextValue>(
    () => ({ visible, open, close }),
    [visible, open, close],
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
      {/* `key` ties the sidebar's animation lifecycle to a specific open
          config; closing nulls out config and the Sidebar handles its own
          exit animation before unmounting. */}
      <Sidebar
        visible={visible}
        onClose={close}
        side={config?.side ?? 'left'}
        items={config?.items ?? []}
        header={config?.header}
      />
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used inside <SidebarHost>');
  }
  return ctx;
}
