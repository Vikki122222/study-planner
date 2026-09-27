import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, footer, error }) {
  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </section>
    </div>
  );
}
