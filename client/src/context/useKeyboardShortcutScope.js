import { useContext, useEffect, useRef } from "react";
import KeyboardShortcutContext from "./KeyboardShortcutContext";

export const useKeyboardShortcutScope = (shortcuts, { enabled = true, priority = 0 } = {}) => {
  const context = useContext(KeyboardShortcutContext);
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;
  useEffect(() => {
    if (!context || !enabled) return undefined;
    return context.registerScope({ priority, shortcuts: new Proxy({}, { get: (_, key) => shortcutsRef.current?.[key] }) });
  }, [context, enabled, priority]);
};
