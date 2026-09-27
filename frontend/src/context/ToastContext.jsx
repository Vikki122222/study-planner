import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const toastMeta = {
  success: { title: 'Готово', Icon: CheckCircle2 },
  warn: { title: 'Внимание', Icon: AlertTriangle },
  error: { title: 'Ошибка', Icon: XCircle },
  info: { title: 'Информация', Icon: Info },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((items) => items.map((item) => item.id === id ? { ...item, closing: true } : item));
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 260);
  }, []);

  const show = useCallback((message, options = {}) => {
    const type = toastMeta[options.type] ? options.type : 'info';
    const duration = options.duration ?? 4500;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((items) => [...items, { id, message, type, duration, title: options.title || toastMeta[type].title }]);
    window.setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  const value = useMemo(() => ({
    show,
    success: (message, options) => show(message, { ...options, type: 'success' }),
    warn: (message, options) => show(message, { ...options, type: 'warn' }),
    error: (message, options) => show(message, { ...options, type: 'error' }),
    info: (message, options) => show(message, { ...options, type: 'info' }),
    remove,
  }), [show, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onClose }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions removals">
      {toasts.map((toast) => {
        const Icon = toastMeta[toast.type].Icon;
        return (
          <article
            className={`toast-card toast-${toast.type} ${toast.closing ? 'closing' : ''}`}
            key={toast.id}
            style={{ '--toast-duration': `${toast.duration}ms` }}
            onClick={() => onClose(toast.id)}
          >
            <Icon size={20} />
            <div>
              <strong>{toast.title}</strong>
              <span>{toast.message}</span>
            </div>
            <button type="button" aria-label="Закрыть уведомление" onClick={(event) => { event.stopPropagation(); onClose(toast.id); }}>
              <X size={16} />
            </button>
          </article>
        );
      })}
    </div>
  );
}

export const useToast = () => useContext(ToastContext);
