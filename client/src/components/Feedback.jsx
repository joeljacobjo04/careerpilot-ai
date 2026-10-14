import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

/**
 * App-wide confirmation dialog and toast messages.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete this?", message: "...", confirmText: "Delete", tone: "danger" }))) return;
 *
 *   const toast = useToast();
 *   toast("Saved");  toast("Something went wrong", "error");
 */
const ConfirmCtx = createContext(async () => window.confirm("Are you sure?"));
const ToastCtx = createContext(() => {});
export const useConfirm = () => useContext(ConfirmCtx);
export const useToast = () => useContext(ToastCtx);

const TOAST_STYLE = {
  ok: ["border-ok/30 bg-white text-ink", CheckCircle2, "text-ok"],
  error: ["border-bad/30 bg-white text-ink", XCircle, "text-bad"],
  info: ["border-line bg-white text-ink", Info, "text-brand"],
};

function ConfirmDialog({ dialog, onClose }) {
  const confirmBtn = useRef(null);
  const { title, message, confirmText = "Confirm", cancelText = "Cancel", tone = "primary" } = dialog;

  useEffect(() => {
    confirmBtn.current?.focus();
    const key = (e) => e.key === "Escape" && onClose(false);
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);

  const danger = tone === "danger";
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/50 p-4 backdrop-blur-[2px] animate-fade sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop animate-pop">
        <div className="flex gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${danger ? "bg-bad-soft text-bad" : "bg-brand-soft text-brand"}`}>
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-bold leading-snug">{title}</h2>
            {message && <p id="confirm-msg" className="mt-1.5 text-sm leading-relaxed text-ink-soft">{message}</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={() => onClose(false)} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{cancelText}</button>
          <button ref={confirmBtn} onClick={() => onClose(true)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 ${danger ? "bg-bad hover:opacity-90 focus-visible:outline-bad" : "bg-brand hover:bg-brand-dark focus-visible:outline-brand"}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FeedbackProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const resolver = useRef(null);

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    resolver.current?.(false); // a second dialog replaces the first one
    resolver.current = resolve;
    setDialog(opts);
  }), []);

  const close = useCallback((value) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog(null);
  }, []);

  const toast = useCallback((message, tone = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={toast}>
        {children}
        {dialog && <ConfirmDialog dialog={dialog} onClose={close} />}
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center gap-2 p-4 safe-bottom sm:items-end">
          {toasts.map((t) => {
            const [box, Icon, color] = TOAST_STYLE[t.tone] || TOAST_STYLE.ok;
            return (
              <div key={t.id} role="status" className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-pop animate-slide-up ${box}`}>
                <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
                <p className="min-w-0 flex-1">{t.message}</p>
                <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="shrink-0 text-ink-soft hover:text-ink"><X size={15} aria-hidden="true" /></button>
              </div>
            );
          })}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}
