import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, FileText, Image, Layers, Paperclip, Plus, Search, SquarePen, Trash2 } from 'lucide-react';
import Calendar from '../components/Calendar.jsx';
import Modal from '../components/Modal.jsx';
import TopBar from '../components/TopBar.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, normalizeId } from '../services/api.js';

const toLocalISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const todayISO = () => toLocalISO(new Date());
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace('/api', '');
const fmtDate = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU') : '';
const fmtDateTime = (date, time) => `${fmtDate(date)} ${time || ''}`.trim();
const saveMessages = {
  subject: { create: 'Предмет создан', edit: 'Предмет обновлен' },
  note: { create: 'Заметка создана', edit: 'Заметка обновлена' },
  flashcard: { create: 'Карточка создана', edit: 'Карточка обновлена' },
  event: { create: 'Событие создано', edit: 'Событие обновлено' },
};
const deleteMessages = {
  subjects: 'Предмет удален',
  notes: 'Заметка удалена',
  flashcards: 'Карточка удалена',
  events: 'Событие удалено',
};

export default function Dashboard() {
  const notify = useToast();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [calendarMode, setCalendarMode] = useState('subject');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [notes, setNotes] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventFeed, setEventFeed] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState({ subjects: 0, notes: 0, flashcards: 0, events: 0 });
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [activeTab, setActiveTab] = useState('events');
  const [dayOpen, setDayOpen] = useState(true);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [visibleAnswers, setVisibleAnswers] = useState({});
  const [expandedNotes, setExpandedNotes] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async ({ initial = false } = {}) => {
    if (initial) setInitialLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dashboard');
      const loadedSubjects = (data.subjects || []).map(normalizeId);
      setSubjects(loadedSubjects);
      setNotes((data.notes || []).map(normalizeId));
      setFlashcards((data.flashcards || []).map(normalizeId));
      setEvents((data.events || []).map(normalizeId));
      setEventFeed((data.eventFeed || data.upcomingEvents || []).map(normalizeId));
      setRecommendations(data.recommendations || []);
      setStats(data.stats || { subjects: loadedSubjects.length, notes: 0, flashcards: 0, events: 0 });
      if (!selectedSubjectId && loadedSubjects.length) setSelectedSubjectId(loadedSubjects[0].id);
    } catch (loadError) {
      if (loadError.response?.status === 401) {
        return;
      }
      const message = 'Не удалось загрузить данные. Проверьте backend и MongoDB.';
      setError(message);
      notify.error(message);
    } finally {
      if (initial) setInitialLoading(false);
    }
  };

  useEffect(() => {
    load({ initial: true });
  }, []);

  const subjectById = (id) => subjects.find((subject) => subject.id === id);
  const subjectName = (id) => subjectById(id)?.title || 'Без предмета';
  const subjectColor = (id) => subjectById(id)?.colorKey || 'gray';
  const selectedSubject = subjectById(selectedSubjectId);
  const filteredSubjects = subjects.filter((subject) => subject.title.toLowerCase().includes(subjectSearch.toLowerCase()));
  const subjectNotes = selectedSubjectId ? notes.filter((item) => item.subjectId === selectedSubjectId) : [];
  const subjectCards = selectedSubjectId ? flashcards.filter((item) => item.subjectId === selectedSubjectId) : [];
  const subjectEvents = selectedSubjectId ? events.filter((item) => item.subjectId === selectedSubjectId) : [];
  const visibleNotes = calendarMode === 'all' ? notes : subjectNotes;
  const visibleCards = calendarMode === 'all' ? flashcards : subjectCards;
  const visibleEvents = calendarMode === 'all' ? events : subjectEvents;
  const selectedNotes = visibleNotes.filter((item) => item.date === selectedDate);
  const selectedCards = visibleCards.filter((item) => item.date === selectedDate);
  const selectedEvents = visibleEvents.filter((item) => item.date === selectedDate);
  const selectedFiles = selectedNotes.flatMap((note) => (note.files || []).map((file) => ({ ...file, noteId: note.id, noteTitle: note.title, subjectId: note.subjectId })));
  const importantEvents = eventFeed.filter((item) => item.importance === 'high').slice(0, 5);
  const todayDate = todayISO();
  const todayEventsCount = useMemo(() => {
    const seen = new Set();
    return [...events, ...eventFeed].filter((item) => {
      const key = item.id || `${item.title}-${item.date}-${item.time}`;
      if (item.date !== todayDate || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).length;
  }, [events, eventFeed, todayDate]);
  const tickerItems = useMemo(() => {
    const recent = (items) => [...items].sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0)).slice(0, 8);
    return [
      ...eventFeed.map((item) => ({ ...item, tickerType: 'event', tickerLabel: 'Событие', tickerTitle: item.title, tickerTab: 'events' })),
      ...recent(notes).map((item) => ({ ...item, tickerType: 'note', tickerLabel: 'Заметка', tickerTitle: item.title, tickerTab: 'notes' })),
      ...recent(flashcards).map((item) => ({ ...item, tickerType: 'flashcard', tickerLabel: 'Карточка', tickerTitle: item.question, tickerTab: 'flashcards' })),
    ].filter((item) => item.tickerTitle);
  }, [eventFeed, notes, flashcards]);

  const counters = useMemo(() => [
    ['Предметы', stats.subjects, Layers],
    ['Заметки', stats.notes, FileText],
    ['Карточки', stats.flashcards, Check],
    ['События', stats.events, CalendarDays],
  ], [stats]);

  const openCreate = (type) => {
    setModal({ type, mode: 'create', files: [], data: {
      subject: { title: '', description: '' },
      note: { subjectId: selectedSubjectId, title: '', content: '', date: selectedDate, files: [] },
      flashcard: { subjectId: selectedSubjectId, question: '', answer: '', date: selectedDate },
      event: { subjectId: selectedSubjectId, title: '', description: '', date: selectedDate, time: '', importance: 'medium' },
    }[type] });
  };

  const openEdit = (type, item) => {
    setModal({ type, mode: 'edit', id: item.id, files: [], data: {
      subject: { title: item.title, description: item.description || '' },
      note: { subjectId: item.subjectId, title: item.title, content: item.content || '', date: item.date, files: item.files || [] },
      flashcard: { subjectId: item.subjectId, question: item.question, answer: item.answer, date: item.date },
      event: { subjectId: item.subjectId || '', title: item.title, description: item.description || '', date: item.date, time: item.time || '', importance: item.importance || 'medium' },
    }[type] });
  };

  const saveModal = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { type, mode, id, data, files } = modal;
      if ((type === 'note' || type === 'flashcard') && !data.subjectId) throw new Error('Сначала выберите предмет.');
      let response;
      if (type === 'subject') response = mode === 'edit' ? await api.put(`/subjects/${id}`, data) : await api.post('/subjects', data);
      if (type === 'note') response = mode === 'edit' ? await api.put(`/subjects/${data.subjectId}/notes/${id}`, data) : await api.post(`/subjects/${data.subjectId}/notes`, data);
      if (type === 'flashcard') response = mode === 'edit' ? await api.put(`/subjects/${data.subjectId}/flashcards/${id}`, data) : await api.post(`/subjects/${data.subjectId}/flashcards`, data);
      if (type === 'event') {
        const base = data.subjectId ? `/subjects/${data.subjectId}/events` : '/events';
        response = mode === 'edit' ? await api.put(`${base}/${id}`, data) : await api.post(base, data);
      }
      if (type === 'note' && files?.length) {
        const noteId = id || normalizeId(response.data).id;
        for (const file of files) {
          const form = new FormData();
          form.append('file', file);
          await api.post(`/subjects/${data.subjectId}/notes/${noteId}/files`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
      }
      notify.success(saveMessages[type]?.[mode] || (mode === 'edit' ? 'Изменения сохранены' : 'Запись создана'));
      setModal(null);
      await load();
    } catch (err) {
      if (err.response?.status === 401) {
        return;
      }
      const message = err.message || err.response?.data?.error || 'Не удалось сохранить данные.';
      setError(message);
      if (message.includes('выберите предмет')) notify.warn(message);
      else notify.error(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    try {
      if (deleteTarget.fileId) await api.delete(`/subjects/${deleteTarget.subjectId}/notes/${deleteTarget.noteId}/files/${deleteTarget.fileId}`);
      else if (deleteTarget.collection === 'subjects') await api.delete(`/subjects/${deleteTarget.id}`);
      else if (deleteTarget.collection === 'notes') await api.delete(`/subjects/${deleteTarget.subjectId}/notes/${deleteTarget.id}`);
      else if (deleteTarget.collection === 'flashcards') await api.delete(`/subjects/${deleteTarget.subjectId}/flashcards/${deleteTarget.id}`);
      else if (deleteTarget.collection === 'events') await api.delete(`${deleteTarget.subjectId ? `/subjects/${deleteTarget.subjectId}/events` : '/events'}/${deleteTarget.id}`);
      notify.success(deleteTarget.fileId ? 'Файл удален' : deleteMessages[deleteTarget.collection] || 'Запись удалена');
      setDeleteTarget(null);
      await load();
    } catch (deleteError) {
      if (deleteError.response?.status === 401) {
        return;
      }
      const message = 'Не удалось удалить запись.';
      setError(message);
      notify.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAnswer = async (card) => {
    const nextVisible = !visibleAnswers[card.id];
    setVisibleAnswers({ ...visibleAnswers, [card.id]: nextVisible });
    if (nextVisible) {
      const { data } = await api.post(`/subjects/${card.subjectId}/flashcards/${card.id}/review`);
      setFlashcards((items) => items.map((item) => item.id === card.id ? normalizeId(data) : item));
    }
  };

  return (
    <main>
      <TopBar />
      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="section-head"><div><h2>Предметы</h2><p className="muted">{subjects.length} всего</p></div><button className="primary-button compact" onClick={() => openCreate('subject')}><Plus size={16} />Создать</button></div>
          <label className="search-field"><Search size={16} /><input placeholder="Поиск предмета" value={subjectSearch} onChange={(e) => setSubjectSearch(e.target.value)} /></label>
          {initialLoading ? <SidebarSkeleton /> : <div className="subject-list">{filteredSubjects.length ? filteredSubjects.map((subject) => <article className={`subject-row ${selectedSubjectId === subject.id ? 'selected' : ''}`} key={subject.id} style={{ '--subject-color': `var(--subject-${subject.colorKey || 'gray'})` }} onClick={() => setSelectedSubjectId(subject.id)}><strong>{subject.title}</strong><span>{subject.description || 'Без описания'}</span><div className="row-actions"><button className="edit-button" onClick={(e) => { e.stopPropagation(); openEdit('subject', subject); }}><SquarePen size={15} />Изменить</button><button className="delete-button" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ collection: 'subjects', id: subject.id }); }}><Trash2 size={15} />Удалить</button></div></article>) : <EmptyState text={subjectSearch ? 'Предметы не найдены.' : 'Предметов пока нет.'} action="Создать предмет" onAction={() => openCreate('subject')} />}</div>}
        </aside>

        <section className="center-column">
          {initialLoading ? <div className="live-ticker ticker-loading" /> : <LiveTicker items={tickerItems} subjectName={subjectName} />}
          {error && <div className="error-text">{error}</div>}
          {initialLoading ? <SkeletonCalendar /> : <Calendar selectedDate={selectedDate} events={visibleEvents} notes={visibleNotes} flashcards={visibleCards} onSelect={setSelectedDate} subjectLabel={calendarMode === 'all' ? 'Суммарно по всем предметам' : selectedSubject ? `Предмет: ${selectedSubject.title}` : 'Предмет не выбран'} calendarMode={calendarMode} onCalendarModeChange={setCalendarMode} />}
          <section className={`day-details accordion-panel ${dayOpen ? 'open' : 'closed'}`}>
            <div className="day-header accordion-head"><button className="accordion-toggle" type="button" aria-label={dayOpen ? 'Скрыть блок' : 'Открыть блок'} onClick={() => setDayOpen((value) => !value)}><ChevronDown size={18} /></button><div><h2>{fmtDate(selectedDate)}</h2><p>Материалы выбранного дня.</p></div><div className="quick-actions"><button className="create-button event-create" onClick={() => openCreate('event')}><Plus size={16} />Событие</button><button className="create-button note-create" disabled={!selectedSubjectId} onClick={() => openCreate('note')}><Plus size={16} />Заметка</button><button className="create-button card-create" disabled={!selectedSubjectId} onClick={() => openCreate('flashcard')}><Plus size={16} />Карточка</button></div></div>
            <div className="accordion-body"><div className="accordion-inner"><Tabs activeTab={activeTab} setActiveTab={setActiveTab} counts={{ events: selectedEvents.length, notes: selectedNotes.length, flashcards: selectedCards.length, files: selectedFiles.length }} />
              <div className="tab-panel">
                {activeTab === 'events' && <EntityList empty="На этот день пока нет событий." action="Создать событие" onAction={() => openCreate('event')} items={selectedEvents} render={(item) => <EventCard item={item} subjectName={subjectName} subjectColor={subjectColor} onEdit={() => openEdit('event', item)} onDelete={() => setDeleteTarget({ collection: 'events', id: item.id, subjectId: item.subjectId })} />} />}
                {activeTab === 'notes' && <EntityList empty="На этот день пока нет заметок." action="Создать заметку" onAction={() => openCreate('note')} items={selectedNotes} render={(item) => <NoteCard item={item} expanded={expandedNotes[item.id]} onExpand={() => setExpandedNotes({ ...expandedNotes, [item.id]: !expandedNotes[item.id] })} subjectName={subjectName} subjectColor={subjectColor} onEdit={() => openEdit('note', item)} onDelete={() => setDeleteTarget({ collection: 'notes', id: item.id, subjectId: item.subjectId })} onPreview={setImagePreview} onDeleteFile={(file) => setDeleteTarget({ fileId: file.id, noteId: item.id, subjectId: item.subjectId })} />} />}
                {activeTab === 'flashcards' && <EntityList empty="Карточек на этот день пока нет." action="Создать карточку" onAction={() => openCreate('flashcard')} items={selectedCards} render={(item) => <FlashcardCard item={item} visible={visibleAnswers[item.id]} subjectName={subjectName} subjectColor={subjectColor} onToggle={() => toggleAnswer(item)} onEdit={() => openEdit('flashcard', item)} onDelete={() => setDeleteTarget({ collection: 'flashcards', id: item.id, subjectId: item.subjectId })} />} />}
                {activeTab === 'files' && <FilesTab files={selectedFiles} subjectName={subjectName} onPreview={setImagePreview} onDeleteFile={(file) => setDeleteTarget({ fileId: file.id, noteId: file.noteId, subjectId: file.subjectId })} />}
              </div></div></div>
          </section>
          <section className={`event-details-block accordion-panel ${eventDetailsOpen ? 'open' : 'closed'}`}>
            <div className="section-head accordion-head">
              <button className="accordion-toggle" type="button" aria-label={eventDetailsOpen ? 'Скрыть блок' : 'Открыть блок'} onClick={() => setEventDetailsOpen((value) => !value)}><ChevronDown size={18} /></button>
              <div>
                <h2>Подробности событий</h2>
                <p className="muted">События выбранного дня с описанием и действиями.</p>
              </div>
            </div>
            <div className="accordion-body"><div className="accordion-inner">
              <EntityList empty="На выбранный день нет событий для подробного просмотра." action="Создать событие" onAction={() => openCreate('event')} items={selectedEvents} render={(item) => <EventCard item={item} subjectName={subjectName} subjectColor={subjectColor} onEdit={() => openEdit('event', item)} onDelete={() => setDeleteTarget({ collection: 'events', id: item.id, subjectId: item.subjectId })} />} />
            </div></div>
          </section>
        </section>

        <aside className="rightbar">
          {initialLoading ? <RightbarSkeleton /> : <><div className="stats-grid">{counters.map(([label, value, Icon]) => <div className="stat" key={label}><Icon size={18} /><span>{label}</span><strong>{value}</strong></div>)}</div><SideList title="Ближайшие события" items={eventFeed.slice(0, 5)} render={(item) => <EventMini item={item} subjectName={subjectName} />} meta={`${todayEventsCount} сегодня · ${importantEvents.length} важных`} /><Recommendations items={recommendations} /></>}
        </aside>
      </div>

      {modal && <EntityModal modal={modal} setModal={setModal} subjects={subjects} onSubmit={saveModal} error={error} saving={saving} onPreview={setImagePreview} onDeleteFile={(file) => setDeleteTarget({ fileId: file.id, noteId: modal.id, subjectId: modal.data.subjectId })} />}
      {deleteTarget && <Modal title="Подтверждение удаления" onClose={() => setDeleteTarget(null)} footer={<><button className="secondary-button" disabled={saving} onClick={() => setDeleteTarget(null)}>Отмена</button><button className="delete-button strong" disabled={saving} onClick={confirmDelete}>{saving ? 'Удаление...' : 'Удалить'}</button></>}><p>Это действие нельзя отменить.</p></Modal>}
      {imagePreview && <Modal title={imagePreview.originalName} onClose={() => setImagePreview(null)}><img className="image-preview-large" src={`${API_ORIGIN}${imagePreview.url}`} alt={imagePreview.originalName} /></Modal>}
    </main>
  );
}

function LiveTicker({ items, subjectName }) {
  if (!items.length) return <div className="live-ticker empty">Материалов в ленте пока нет. Добавьте событие, заметку или карточку.</div>;
  const renderItems = (suffix) => items.map((item, index) => (
    <span className={`ticker-item ticker-${item.tickerType} importance-${item.importance || 'low'}`} key={`${item.id}-${item.tickerType}-${suffix}-${index}`}>
      <span className="ticker-label">{item.tickerLabel}</span>
      <strong>{item.tickerTitle}</strong>
      <small>{fmtDateTime(item.date, item.time)}{item.subjectId ? ` · ${subjectName(item.subjectId)}` : ''}</small>
    </span>
  ));
  return <div className="live-ticker"><div className="ticker-track"><div className="ticker-group">{renderItems('a')}</div><div className="ticker-group" aria-hidden="true">{renderItems('b')}</div><div className="ticker-group" aria-hidden="true">{renderItems('c')}</div></div></div>;
}

function EntityModal({ modal, setModal, subjects, onSubmit, error, saving, onPreview, onDeleteFile }) {
  const update = (patch) => setModal({ ...modal, data: { ...modal.data, ...patch } });
  const selectedFiles = modal.files || [];
  const title = { subject: 'предмет', note: 'заметку', flashcard: 'карточку', event: 'событие' }[modal.type];
  return <Modal title={`${modal.mode === 'edit' ? 'Изменить' : 'Создать'} ${title}`} onClose={() => setModal(null)} error={error}><form className="stack-form" onSubmit={onSubmit}>{modal.type === 'subject' && <><label>Название<input required value={modal.data.title} onChange={(e) => update({ title: e.target.value })} /></label><label>Описание<textarea value={modal.data.description} onChange={(e) => update({ description: e.target.value })} /></label><p className="muted">Цвет назначается автоматически.</p></>}{modal.type === 'note' && <><SubjectSelect value={modal.data.subjectId} subjects={subjects} onChange={(subjectId) => update({ subjectId })} /><label>Заголовок<input required value={modal.data.title} onChange={(e) => update({ title: e.target.value })} /></label><label>Текст<textarea required value={modal.data.content} onChange={(e) => update({ content: e.target.value })} /></label><label>Дата<input type="date" required value={modal.data.date} onChange={(e) => update({ date: e.target.value })} /></label><FilePicker files={selectedFiles} onChange={(files) => setModal({ ...modal, files })} /><FileList files={modal.data.files || []} onPreview={onPreview} onDelete={modal.mode === 'edit' ? onDeleteFile : undefined} /></>}{modal.type === 'flashcard' && <><SubjectSelect value={modal.data.subjectId} subjects={subjects} onChange={(subjectId) => update({ subjectId })} /><label>Вопрос<input required value={modal.data.question} onChange={(e) => update({ question: e.target.value })} /></label><label>Ответ<textarea required value={modal.data.answer} onChange={(e) => update({ answer: e.target.value })} /></label><label>Дата<input type="date" required value={modal.data.date} onChange={(e) => update({ date: e.target.value })} /></label></>}{modal.type === 'event' && <><SubjectSelect required={false} value={modal.data.subjectId} subjects={subjects} onChange={(subjectId) => update({ subjectId })} /><label>Название<input required value={modal.data.title} onChange={(e) => update({ title: e.target.value })} /></label><label>Описание<textarea value={modal.data.description} onChange={(e) => update({ description: e.target.value })} /></label><label>Дата<input type="date" required value={modal.data.date} onChange={(e) => update({ date: e.target.value })} /></label><label>Время<input type="time" value={modal.data.time} onChange={(e) => update({ time: e.target.value })} /></label><label>Важность<select value={modal.data.importance} onChange={(e) => update({ importance: e.target.value })}><option value="high">Высокая</option><option value="medium">Средняя</option><option value="low">Обычная</option></select></label></>}<div className="modal-footer"><button className="secondary-button" type="button" disabled={saving} onClick={() => setModal(null)}>Отмена</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Сохранение...' : 'Сохранить'}</button></div></form></Modal>;
}

function SubjectSelect({ value, onChange, subjects, required = true }) {
  return <label>Предмет<select required={required} value={value} onChange={(e) => onChange(e.target.value)}>{!required && <option value="">Без предмета</option>}{required && <option value="">Выберите предмет</option>}{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}</select></label>;
}
function Tabs({ activeTab, setActiveTab, counts }) {
  return <div className="tabs">{[['events', 'События'], ['notes', 'Заметки'], ['flashcards', 'Карточки'], ['files', 'Файлы']].map(([key, label]) => <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>{label} <span>{counts[key]}</span></button>)}</div>;
}
function EntityList({ items, render, empty, action, onAction }) {
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items.length, empty]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!items.length) return <EmptyState text={empty} action={action} onAction={onAction} />;

  const start = (page - 1) * pageSize;
  const visibleItems = items.slice(start, start + pageSize);

  return (
    <>
      <div className="entity-list">{visibleItems.map((item, index) => <div className="entity-list-item" key={item.id || item.fileName || `${page}-${index}`}>{render(item)}</div>)}</div>
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
    </>
  );
}
function Pagination({ page, totalPages, onPage }) {
  return <div className="pagination"><button className="secondary-button" disabled={page === 1} onClick={() => onPage(page - 1)}>Назад</button><span>{page} / {totalPages}</span><button className="secondary-button" disabled={page === totalPages} onClick={() => onPage(page + 1)}>Дальше</button></div>;
}
function EmptyState({ text, action, onAction }) {
  return <div className="empty-state"><span>{text}</span>{action && <button className="empty-action" onClick={onAction}>{action}</button>}</div>;
}
function SideList({ title, items, render, meta }) {
  return <section className="side-list"><div className="side-title"><h3>{title}</h3>{meta && <span>{meta}</span>}</div>{items.length ? items.map((item) => <div key={item.id}>{render(item)}</div>) : <EmptyState text="Пока пусто" />}</section>;
}
function Recommendations({ items }) {
  const [open, setOpen] = useState(true);
  return <section className={`side-list recommendations accordion-panel ${open ? 'open' : 'closed'}`}><div className="side-title accordion-head"><button className="accordion-toggle compact" type="button" aria-label={open ? 'Скрыть рекомендации' : 'Открыть рекомендации'} onClick={() => setOpen((value) => !value)}><ChevronDown size={16} /></button><h3>Рекомендации</h3></div><div className="accordion-body"><div className="accordion-inner">{items.length ? items.map((item, index) => <div className={`recommendation priority-${item.priority}`} key={`${item.type}-${index}`}><strong>{item.title}</strong><span>{item.text}</span></div>) : <EmptyState text="Рекомендаций пока нет." />}</div></div></section>;
}
function EventMini({ item, subjectName }) {
  return <span className={`event-mini importance-${item.importance}`}><strong>{item.title}</strong><small><span>{fmtDateTime(item.date, item.time)}</span><span>{subjectName(item.subjectId)}</span></small></span>;
}
function EventCard({ item, subjectName, subjectColor, onEdit, onDelete }) {
  return <article className={`entity-card event-card importance-${item.importance}`} style={{ '--subject-color': `var(--subject-${subjectColor(item.subjectId)})` }}><div className="entity-top"><strong>{item.title}</strong><span>{importanceName(item.importance)}</span></div><p>{item.description || 'Без описания'}</p><small>{fmtDateTime(item.date, item.time)} · {subjectName(item.subjectId)}</small><Actions onEdit={onEdit} onDelete={onDelete} /></article>;
}
function NoteCard({ item, expanded, onExpand, subjectName, subjectColor, onEdit, onDelete, onPreview, onDeleteFile }) {
  const content = item.content || '';
  const isLong = content.length > 180;
  return <article className="entity-card note-card" style={{ '--subject-color': `var(--subject-${subjectColor(item.subjectId)})` }}><div className="entity-top"><strong>{item.title}</strong><span><Paperclip size={14} />{item.files?.length || 0}</span></div><p>{expanded || !isLong ? content : `${content.slice(0, 180)}...`}</p>{isLong && <button className="view-button" onClick={onExpand}>{expanded ? 'Скрыть' : 'Показать полностью'}</button>}<small>{fmtDate(item.date)} · {subjectName(item.subjectId)}</small><FileList files={item.files || []} onPreview={onPreview} onDelete={onDeleteFile} deleteIcon /><Actions onEdit={onEdit} onDelete={onDelete} /></article>;
}
function FlashcardCard({ item, visible, subjectName, subjectColor, onToggle, onEdit, onDelete }) {
  return <article className="entity-card flashcard-card" style={{ '--subject-color': `var(--subject-${subjectColor(item.subjectId)})` }}><strong>{item.question}</strong>{visible ? <p className="answer-reveal">{item.answer}</p> : <p className="muted">Ответ скрыт</p>}<small>{fmtDate(item.date)} · {subjectName(item.subjectId)} · повторений: {item.reviewCount || 0}</small><div className="row-actions"><button className="view-button" onClick={onToggle}>{visible ? 'Скрыть ответ' : 'Показать ответ'}</button><button className="edit-button" onClick={onEdit}><SquarePen size={15} />Изменить</button><button className="delete-button" onClick={onDelete}><Trash2 size={15} />Удалить</button></div></article>;
}
function Actions({ onEdit, onDelete }) {
  return <div className="row-actions"><button className="edit-button" onClick={onEdit}><SquarePen size={15} />Изменить</button><button className="delete-button" onClick={onDelete}><Trash2 size={15} />Удалить</button></div>;
}
function FilePicker({ files, onChange }) {
  const fileText = files.length ? `Выбрано файлов: ${files.length}` : 'Файл пока не выбран';
  const fileHint = files.length ? 'Ниже показан краткий предпросмотр' : 'После загрузки здесь появится краткий предпросмотр';
  return <div className="file-picker"><span className="file-picker-title">Файлы</span><label className="file-picker-control"><input type="file" multiple accept="image/*,.pdf,.txt,text/plain,application/pdf" onChange={(e) => onChange(Array.from(e.target.files || []))} /><span className="file-picker-icon"><Paperclip size={17} /></span><span className="file-picker-copy"><strong>{fileText}</strong><small>{fileHint}</small></span><span className="file-picker-action">Выбрать файлы</span></label>{files.length > 0 && <div className="picked-files">{files.map((file, index) => <div className="picked-file" key={`${file.name}-${index}`}>{file.type?.startsWith('image/') ? <img className="picked-thumb" src={URL.createObjectURL(file)} alt={file.name} /> : <Paperclip size={18} />}<span>{file.name}</span><small>{Math.ceil(file.size / 1024)} КБ</small><button type="button" className="delete-link" onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}>Удалить</button></div>)}</div>}</div>;
}
function FileList({ files, onPreview, onDelete, deleteIcon = false }) {
  // if (!files?.length) return <p className="muted">Файлов нет.</p>;
  return <div className="file-list">{files.map((file) => { const isImage = file.isImage || file.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.originalName || file.fileName || file.url || ''); return <div key={file.id || file.fileName} className={`file-row ${deleteIcon ? 'file-row-inline-delete' : ''}`}>{isImage ? <button type="button" className="thumb-button" onClick={() => onPreview?.(file)}><img src={`${API_ORIGIN}${file.url}`} alt={file.originalName} /></button> : <span className="file-icon"><Paperclip size={18} /></span>}<a href={`${API_ORIGIN}${file.url}`} target="_blank" rel="noreferrer">{isImage ? <Image size={14} /> : <Paperclip size={14} />}{file.originalName}</a>{onDelete && deleteIcon && <button type="button" className="delete-icon-button" aria-label="Удалить файл" title="Удалить файл" onClick={() => onDelete(file)}><Trash2 size={15} /></button>}<small>{Math.ceil((file.size || 0) / 1024)} КБ</small>{onDelete && !deleteIcon && <button className="delete-link" onClick={() => onDelete(file)}>Удалить</button>}</div>; })}</div>;
}
function FilesTab({ files, subjectName, onPreview, onDeleteFile }) {
  return <EntityList items={files} empty="Файлы не прикреплены." render={(file) => <article className="entity-card file-card note-file-card"><FileList files={[file]} onPreview={onPreview} onDelete={onDeleteFile} /><small>Прикреплен к заметке: <strong>{file.noteTitle}</strong> по предмету <strong>{subjectName(file.subjectId)}</strong></small></article>} />;
}
function SkeletonList({ count }) { return <div className="skeleton-list">{Array.from({ length: count }).map((_, index) => <div className="skeleton-card" key={index} />)}</div>; }
function SidebarSkeleton() { return <div className="skeleton-list sidebar-skeleton"><div className="skeleton-input" /><div className="skeleton-subject" /><div className="skeleton-subject" /></div>; }
function RightbarSkeleton() { return <div className="rightbar-skeleton"><div className="skeleton-stats">{Array.from({ length: 4 }).map((_, index) => <div className="skeleton-stat" key={index} />)}</div><div className="skeleton-panel" /><div className="skeleton-panel compact" /></div>; }
function SkeletonCalendar() { return <div className="calendar-panel skeleton-calendar">{Array.from({ length: 35 }).map((_, index) => <div className="skeleton-cell" key={index} />)}</div>; }
function importanceName(value) { return { high: 'Высокая', medium: 'Средняя', low: 'Обычная' }[value] || 'Обычная'; }
