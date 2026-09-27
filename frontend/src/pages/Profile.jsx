import { useEffect, useState } from 'react';
import { ChevronDown, MonitorSmartphone, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace('/api', '');
const fmtDate = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU') : '';
const fmtDateTime = (date, time) => `${fmtDate(date)} ${time || ''}`.trim();
const fmtSessionDate = (value) => value ? new Date(value).toLocaleString('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}) : 'неизвестно';

const toProfileState = (data = {}) => ({
  name: data.name || '',
  email: data.email || '',
  about: data.about || '',
  avatar: data.avatar || '',
});

export default function Profile() {
  const notify = useToast();
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [profile, setProfile] = useState({ name: '', email: '', about: '', avatar: '' });
  const [stats, setStats] = useState({ subjects: 0, notes: 0, flashcards: 0, events: 0 });
  const [importantEvents, setImportantEvents] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [tickerItems, setTickerItems] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [endingSessionId, setEndingSessionId] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [activityOpen, setActivityOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [profileResponse, statsResponse, eventsResponse, dashboardResponse, sessionsResponse] = await Promise.all([
          api.get('/profile'),
          api.get('/stats'),
          api.get('/events/upcoming'),
          api.get('/dashboard'),
          api.get('/sessions'),
        ]);
        const dashboard = dashboardResponse.data || {};
        setProfile(toProfileState(profileResponse.data));
        setStats(statsResponse.data);
        setSessions(sessionsResponse.data || []);
        setImportantEvents((eventsResponse.data || []).filter((item) => (item.importance || item.priority) === 'high').slice(0, 4));
        setRecommendations(dashboard.recommendations || []);
        setTickerItems([
          ...(dashboard.eventFeed || dashboard.upcomingEvents || []).map((item) => ({ ...item, tickerType: 'event', tickerLabel: 'Событие', tickerTitle: item.title })),
          ...(dashboard.recentNotes || []).map((item) => ({ ...item, tickerType: 'note', tickerLabel: 'Заметка', tickerTitle: item.title })),
          ...(dashboard.recentFlashcards || []).map((item) => ({ ...item, tickerType: 'flashcard', tickerLabel: 'Карточка', tickerTitle: item.question })),
        ].filter((item) => item.tickerTitle));
      } catch (loadError) {
        if (loadError.response?.status === 401) {
          return;
        }
        const message = 'Не удалось загрузить профиль.';
        setError(message);
        notify.error(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const avatarSrc = profile.avatar?.startsWith('/uploads')
    ? `${API_ORIGIN}${profile.avatar}`
    : profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || user?.email || 'U')}&background=2f6fed&color=fff`;

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await api.put('/profile', profile);
      setProfile(toProfileState(response.data));
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      notify.success('Профиль обновлен');
    } catch {
      const message = 'Не удалось обновить профиль.';
      setError(message);
      notify.error(message);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const form = new FormData();
      form.append('avatar', file);
      const response = await api.post('/profile/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(toProfileState(response.data));
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      notify.success('Аватар обновлен');
    } catch {
      const message = 'Не удалось обновить аватар.';
      setError(message);
      notify.error(message);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api.put('/profile/password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      notify.success('Пароль изменен. Войдите снова.');
      logout();
      navigate('/login', { replace: true });
    } catch (passwordError) {
      if (passwordError.response?.status === 401) {
        const message = normalizePasswordError(passwordError.response?.data?.error);
        setError(message);
        notify.error(message);
        return;
      }
      const message = normalizePasswordError(passwordError.response?.data?.error);
      setError(message);
      notify.error(message);
    }
  };

  const endSession = async (session) => {
    setEndingSessionId(session.id);
    setError('');
    try {
      await api.delete(`/sessions/${session.id}`);
      if (session.current) {
        notify.info('Текущая сессия завершена. Войдите снова.');
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setSessions((items) => items.filter((item) => item.id !== session.id));
      notify.success('Сессия завершена');
    } catch {
      const message = 'Не удалось завершить сессию.';
      setError(message);
      notify.error(message);
    } finally {
      setEndingSessionId('');
    }
  };

  if (loading) {
    return (
      <main>
        <TopBar />
        <section className="profile-page profile-skeleton-page">
          <div className="profile-hero profile-hero-skeleton">
            <div className="skeleton-avatar" />
            <div className="skeleton-text-stack">
              <div className="skeleton-line wide" />
              <div className="skeleton-line medium" />
              <div className="skeleton-line long" />
            </div>
            <div className="skeleton-button" />
          </div>
          <div className="live-ticker ticker-loading" />
          <section className="profile-accordion open profile-accordion-skeleton">
            <div className="profile-accordion-head skeleton-accordion-head">
              <span className="skeleton-round" />
              <span className="skeleton-text-stack">
                <span className="skeleton-line medium" />
                <span className="skeleton-line long" />
              </span>
            </div>
            <div className="profile-activity-board">
              <div className="profile-card skeleton-profile-card stats" />
              <div className="profile-card skeleton-profile-card list" />
              <div className="profile-card skeleton-profile-card list" />
            </div>
          </section>
          <section className="profile-accordion closed profile-accordion-skeleton profile-settings-skeleton">
            <div className="profile-accordion-head skeleton-accordion-head">
              <span className="skeleton-round" />
              <span className="skeleton-text-stack">
                <span className="skeleton-line medium" />
                <span className="skeleton-line long" />
              </span>
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main>
      <TopBar />
      <section className="profile-page">
        {error && <div className="error-text">{error}</div>}

        <div className="profile-hero">
          <img src={avatarSrc} alt="Аватар" />
          <div>
            <h1>{profile.name || 'Профиль'}</h1>
            <p>{profile.email}</p>
            <span>{profile.about || 'Расскажите немного о себе и своем обучении.'}</span>
          </div>
          <Link className="view-button" to="/">Вернуться к календарю</Link>
        </div>

        <ProfileTicker items={tickerItems} />

        <section className={`profile-accordion profile-activity-section ${activityOpen ? 'open' : 'closed'}`}>
          <button className="profile-accordion-head" type="button" onClick={() => setActivityOpen((value) => !value)}>
            <span className="accordion-toggle"><ChevronDown size={18} /></span>
            <span>
              <strong>Учебная активность</strong>
              <small>Статистика, рекомендации и важные события на одном экране.</small>
            </span>
          </button>
          <div className="accordion-body">
            <div className="accordion-inner profile-activity-board">
              <section className="profile-card profile-stats-card">
                <div className="profile-panel-head">
                  <h2>Сводка</h2>
                </div>
                <div className="profile-stats">
                  <span className="profile-stat-subjects">Предметы<strong>{stats.subjects}</strong></span>
                  <span className="profile-stat-notes">Заметки<strong>{stats.notes}</strong></span>
                  <span className="profile-stat-flashcards">Карточки<strong>{stats.flashcards}</strong></span>
                  <span className="profile-stat-events">События<strong>{stats.events}</strong></span>
                </div>
              </section>

              <section className="profile-card profile-recommendations-card">
                <div className="profile-panel-head">
                  <h2>Рекомендации</h2>
                </div>
                <div className="profile-list">
                  {recommendations.length ? recommendations.map((item, index) => (
                    <div className={`recommendation priority-${item.priority}`} key={`${item.type}-${index}`}>
                      <strong>{item.title}</strong>
                      <span>{item.text}</span>
                    </div>
                  )) : <div className="empty-state"><span>Рекомендаций пока нет.</span></div>}
                </div>
              </section>

              <section className="profile-card profile-events-card">
                <div className="profile-panel-head">
                  <h2>Важные события</h2>
                </div>
                <div className="profile-list">
                  {importantEvents.length ? importantEvents.map((event) => (
                    <div className={`profile-event importance-${event.importance || 'high'}`} key={event.id}>
                      <strong>{event.title}</strong>
                      <span>{fmtDateTime(event.date, event.time)}</span>
                    </div>
                  )) : <div className="empty-state"><span>Важных событий пока нет.</span></div>}
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className={`profile-accordion profile-settings-section ${settingsOpen ? 'open' : 'closed'}`}>
          <button className="profile-accordion-head" type="button" onClick={() => setSettingsOpen((value) => !value)}>
            <span className="accordion-toggle"><ChevronDown size={18} /></span>
            <span>
              <strong>Настройки</strong>
              <small>Личные данные, аватар и безопасность аккаунта.</small>
            </span>
          </button>
          <div className="accordion-body">
            <div className="accordion-inner profile-settings-grid">
              <section className="profile-card profile-personal-card">
                <div className="profile-panel-head">
                  <h2>Личные данные</h2>
                  <p className="muted">Имя, описание и аватар профиля.</p>
                </div>
                <form className="stack-form" onSubmit={saveProfile}>
                  <label className="avatar-preview-row">
                    <input type="file" accept="image/*" onChange={uploadAvatar} />
                    <img src={avatarSrc} alt="Аватар" />
                    <div>
                      <strong>{profile.name || 'Профиль'}</strong>
                      <span className="muted">JPG, PNG или WEBP</span>
                    </div>
                    <span className="avatar-change-button"><Upload size={15} />Изменить</span>
                  </label>
                  <label>Имя<input required value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
                  <label>Email<input disabled value={profile.email || ''} /></label>
                  <label>Обо мне<textarea value={profile.about || ''} onChange={(e) => setProfile({ ...profile, about: e.target.value })} /></label>
                  <button className="primary-button" type="submit">Сохранить профиль</button>
                </form>
              </section>

              <section className="profile-card profile-security-card">
                <div className="profile-panel-head">
                  <h2>Безопасность</h2>
                  <p className="muted">Смена пароля для входа.</p>
                </div>
                <form className="stack-form" onSubmit={changePassword}>
                  <label>Текущий пароль<input type="password" required value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></label>
                  <label>Новый пароль<input type="password" required minLength={6} value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></label>
                  <button className="primary-button" type="submit">Изменить пароль</button>
                </form>
              </section>

              <section className="profile-card profile-sessions-card">
                <div className="profile-panel-head">
                  <h2>Сессии</h2>
                  <p className="muted">Активные входы в аккаунт. Сессия живет 14 дней.</p>
                </div>
                <div className="session-list">
                  {sessions.length ? sessions.map((session) => (
                    <SessionRow
                      ending={endingSessionId === session.id}
                      key={session.id}
                      onEnd={endSession}
                      session={session}
                    />
                  )) : <div className="empty-state"><span>Активных сессий пока нет.</span></div>}
                </div>
              </section>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function deviceName(userAgent = '') {
  const ua = userAgent || '';
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('Firefox/')
      ? 'Firefox'
      : ua.includes('Chrome/')
        ? 'Chrome'
        : ua.includes('Safari/')
          ? 'Safari'
          : 'Браузер';
  const os = ua.includes('Windows')
    ? 'Windows'
    : ua.includes('Android')
      ? 'Android'
      : ua.includes('iPhone') || ua.includes('iPad')
        ? 'iOS'
        : ua.includes('Mac OS')
          ? 'macOS'
          : ua.includes('Linux')
            ? 'Linux'
            : 'устройство';
  return `${browser} · ${os}`;
}

function normalizePasswordError(error) {
  if (!error) return 'Не удалось изменить пароль.';
  if (error === 'current password is incorrect') return 'Старый пароль указан неверно.';
  return error;
}

function SessionRow({ session, ending, onEnd }) {
  return (
    <div className={`session-row ${session.current ? 'current' : ''}`}>
      <div className="session-main">
        <div className="session-title">
          <MonitorSmartphone size={18} />
          <strong>{deviceName(session.userAgent)}</strong>
          {session.current && <span className="session-badge">Текущее устройство</span>}
        </div>
        <div className="session-meta">
          <span>{session.ip || 'IP не определен'}</span>
          <span>Последняя активность: {fmtSessionDate(session.lastSeenAt)}</span>
          <span>До: {fmtSessionDate(session.expiresAt)}</span>
        </div>
      </div>
      <button
        className={session.current ? 'secondary-button' : 'delete-button'}
        disabled={ending}
        onClick={() => onEnd(session)}
        type="button"
      >
        {ending ? 'Завершаем...' : 'Завершить сессию'}
      </button>
    </div>
  );
}

function ProfileTicker({ items }) {
  if (!items.length) {
    return <div className="profile-live-ticker empty">Материалов в ленте пока нет.</div>;
  }
  const renderItems = (suffix) => items.map((item, index) => (
    <span className={`ticker-item ticker-${item.tickerType} importance-${item.importance || 'low'}`} key={`${item.id}-${item.tickerType}-${suffix}-${index}`}>
      <span className="ticker-label">{item.tickerLabel}</span>
      <strong>{item.tickerTitle}</strong>
      <small>{fmtDateTime(item.date, item.time)}{item.subjectTitle ? ` · ${item.subjectTitle}` : ''}</small>
    </span>
  ));
  return (
    <div className="profile-live-ticker">
      <div className="ticker-track">
        <div className="ticker-group">{renderItems('a')}</div>
        <div className="ticker-group" aria-hidden="true">{renderItems('b')}</div>
        <div className="ticker-group" aria-hidden="true">{renderItems('c')}</div>
      </div>
    </div>
  );
}
