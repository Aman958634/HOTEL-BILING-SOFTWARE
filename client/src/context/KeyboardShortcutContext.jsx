import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getShortcutKey, isEditableTarget } from "./keyboardShortcuts";

const KeyboardShortcutContext = createContext(null);

const helpRows = [
  ["F1", "Show keyboard shortcuts"], ["F2", "New order"], ["F3", "Focus table selector"], ["F4", "Takeaway order"],
  ["F5", "Focus menu search"], ["F6", "Add highlighted menu item"], ["F7", "Open Kitchen KOT for selected order"],
  ["F8", "Open payment collection for selected unpaid order"], ["F9", "Open receipt for selected paid order"],
  ["F10", "Open Orders"], ["F11", "Open Tables"], ["Ctrl + K", "Global search"], ["Ctrl + Enter", "Create order"],
  ["↑ / ↓ / Enter", "Navigate and add menu results"], ["+ / − / Delete", "Adjust or remove selected cart item"], ["Esc", "Close the topmost panel"],
];

const ShortcutHelp = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="keyboard-shortcuts-title">
      <div className="flex items-start justify-between gap-4"><div><h2 id="keyboard-shortcuts-title" className="text-xl font-bold text-slate-900">Keyboard shortcuts</h2><p className="mt-1 text-sm text-slate-600">Shortcuts are available in the POS without changing payment confirmation safeguards.</p></div><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700">Close</button></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">{helpRows.map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><span className="text-slate-700">{label}</span><kbd className="shrink-0 rounded border border-slate-300 bg-slate-50 px-2 py-1 font-sans text-xs font-semibold text-slate-700">{key}</kbd></div>)}</div>
    </section>
  </div>
);

export const KeyboardShortcutProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const scopesRef = useRef([]);
  const sequenceRef = useRef(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const adminRoute = location.pathname.startsWith("/dashboard/admin");

  const registerScope = useCallback((scope) => {
    const id = ++sequenceRef.current;
    scopesRef.current = [...scopesRef.current, { ...scope, id }];
    return () => { scopesRef.current = scopesRef.current.filter((entry) => entry.id !== id); };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      const shortcut = getShortcutKey(event);
      if (!shortcut || event.altKey) return;

      if (shortcut === "f1" && adminRoute) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setHelpOpen(true);
        return;
      }
      if (helpOpen && shortcut === "escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setHelpOpen(false);
        return;
      }

      const editable = isEditableTarget(event.target);
      const scopes = [...scopesRef.current].sort((a, b) => (b.priority || 0) - (a.priority || 0) || b.id - a.id);
      for (const scope of scopes) {
        const binding = scope.shortcuts?.[shortcut];
        if (!binding || (editable && !binding.allowInEditable)) continue;
        if (binding.when && !binding.when()) continue;
        const handled = binding.handler?.(event);
        if (handled === false) continue;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (!adminRoute || editable) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        if (shortcut === "f2" || shortcut === "f10" || shortcut === "f11") {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (shortcut === "f2") {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigate("/dashboard/admin/orders", { state: { keyboardShortcut: "new-order" } });
      } else if (shortcut === "f10") {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigate("/dashboard/admin/orders");
      } else if (shortcut === "f11") {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigate("/dashboard/admin/tables");
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [adminRoute, helpOpen, navigate]);

  const value = useMemo(() => ({ registerScope }), [registerScope]);
  return <KeyboardShortcutContext.Provider value={value}>{children}{helpOpen ? <ShortcutHelp onClose={() => setHelpOpen(false)} /> : null}</KeyboardShortcutContext.Provider>;
};

export default KeyboardShortcutContext;
