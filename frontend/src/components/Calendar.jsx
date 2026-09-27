import { BookOpen, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Calendar({ selectedDate, events, notes, flashcards, onSelect, subjectLabel = 'Предмет не выбран', calendarMode = 'subject', onCalendarModeChange }) {
  const selected = new Date(`${selectedDate}T00:00:00`);
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const today = toISO(new Date());
  const cells = [];

  for (let i = offset; i > 0; i -= 1) cells.push({ date: new Date(year, month, 1 - i), outside: true });
  for (let day = 1; day <= last.getDate(); day += 1) cells.push({ date: new Date(year, month, day), outside: false });
  for (let nextDay = 1; cells.length % 7 !== 0; nextDay += 1) cells.push({ date: new Date(year, month + 1, nextDay), outside: true });

  const moveMonth = (step) => {
    const next = new Date(year, month + step, Math.min(selected.getDate(), 28));
    onSelect(toISO(next));
  };

  return (
    <section className="calendar-panel">
      <div className="calendar-head">
        <button className="icon-button" onClick={() => moveMonth(-1)} aria-label="Предыдущий месяц">
          <ChevronLeft size={18} />
        </button>
        <div className="calendar-title">
          <h1>{selected.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h1>
          <span>{subjectLabel}</span>
        </div>
        <div className="calendar-head-actions">
          <div className="calendar-scope-actions" aria-label="Режим календаря">
            <button type="button" className={`scope-button ${calendarMode === 'subject' ? 'active' : ''}`} title="По предмету" aria-label="Показывать материалы выбранного предмета" onClick={() => onCalendarModeChange?.('subject')}>
              <BookOpen size={16} />
            </button>
            <button type="button" className={`scope-button ${calendarMode === 'all' ? 'active' : ''}`} title="Суммарно" aria-label="Показывать материалы всех предметов" onClick={() => onCalendarModeChange?.('all')}>
              <Layers size={16} />
            </button>
          </div>
          <button className="icon-button" onClick={() => moveMonth(1)} aria-label="Следующий месяц">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="calendar-grid weekday-grid">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid days-grid">
        {cells.map((cell) => {
          const iso = toISO(cell.date);
          const dayEvents = events.filter((item) => item.date === iso);
          const dayNotes = notes.filter((item) => item.date === iso);
          const dayCards = flashcards.filter((item) => item.date === iso);
          const highEvent = dayEvents.some((item) => (item.importance || item.priority) === 'high');

          return (
            <button
              key={iso}
              className={`calendar-day ${cell.outside ? 'outside' : ''} ${dayEvents.length ? 'has-events' : ''} ${highEvent ? 'has-high-event' : ''} ${iso === selectedDate ? 'selected' : ''} ${iso === today ? 'today' : ''}`}
              onClick={() => onSelect(iso)}
            >
              <span className="day-number">{cell.date.getDate()}</span>
              <div className="day-markers">
                {dayEvents.length > 0 && <i className="marker event" />}
                {dayNotes.length > 0 && <i className="marker note" />}
                {dayCards.length > 0 && <i className="marker card" />}
              </div>
              <div className="day-counts">
                {dayEvents.length > 0 && <span>{dayEvents.length} соб.</span>}
                {dayNotes.length > 0 && <span>{dayNotes.length} зам.</span>}
                {dayCards.length > 0 && <span>{dayCards.length} кар.</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
