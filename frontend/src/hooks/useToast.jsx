import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = "ok") => {
    setToast({ message, type, key: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.key >= 3900 ? null : t)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
