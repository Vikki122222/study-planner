import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, FileText, Layers, Sparkles } from 'lucide-react';

export default function AuthForm({ title, subtitle, fields, submitLabel, loadingLabel = 'Загрузка...', isSubmitting = false, error, onSubmit, footer }) {
  return (
    <main className="auth-page">
      <section className="auth-layout">
        <form className="auth-box" onSubmit={onSubmit}>
          <div className="auth-brand">
            <BookOpen size={28} />
            <span>Study Planner</span>
          </div>
          <div className="auth-heading">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="auth-fields">
            {fields}
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className={`primary-button auth-submit ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting} type="submit">
            {isSubmitting && <span className="button-spinner" aria-hidden="true" />}
            {isSubmitting ? loadingLabel : submitLabel}
          </button>
          <div className="auth-footer">
            {footer}
          </div>
        </form>

        <aside className="auth-showcase" aria-label="Описание Study Planner">
          <div className="auth-showcase-copy">
            <span><Sparkles size={16} />Учебный ритм на одном экране</span>
            <h2>Планируйте, записывайте и повторяйте без хаоса.</h2>
          </div>

          <div className="auth-visual">
            <div className="auth-calendar-widget">
              <div className="auth-widget-head">
                <CalendarDays size={18} />
                <strong>Май</strong>
              </div>
              <div className="auth-mini-calendar">
                {Array.from({ length: 14 }).map((_, index) => <i key={index} className={index === 8 ? 'active' : index === 10 ? 'event' : ''} />)}
              </div>
            </div>

            <div className="auth-floating-card auth-note-card">
              <FileText size={17} />
              <div>
                <strong>Заметка</strong>
                <span>Краткий конспект после пары</span>
              </div>
            </div>

            <div className="auth-floating-card auth-card-card">
              <Layers size={17} />
              <div>
                <strong>Карточка</strong>
                <span>Вопрос → ответ → повторение</span>
              </div>
            </div>

            <div className="auth-floating-card auth-event-card">
              <CalendarDays size={17} />
              <div>
                <strong>Событие</strong>
                <span>Контрольная · 16:00</span>
              </div>
            </div>
          </div>

          <div className="auth-feature-row">
            <span>Календарь</span>
            <span>Заметки</span>
            <span>Карточки</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

export function AuthLink({ to, children }) {
  return <Link to={to}>{children}</Link>;
}
