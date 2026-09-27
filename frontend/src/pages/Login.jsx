import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import AuthForm, { AuthLink } from './AuthForm.jsx';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const notify = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const notice = localStorage.getItem('authNotice');
    if (!notice) return;
    localStorage.removeItem('authNotice');
    setError(notice);
    notify.warn(notice);
  }, [notify]);

  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await login(form);
      notify.success('Вы вошли в аккаунт');
      navigate('/');
    } catch {
      const message = 'Не удалось войти. Проверьте email и пароль.';
      setError(message);
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthForm
      title="Вход"
      subtitle="Вернитесь к учебным материалам, карточкам и планам."
      submitLabel="Войти"
      loadingLabel="Входим..."
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={submit}
      fields={(
        <>
          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Пароль<input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        </>
      )}
      footer={<>Нет аккаунта? <AuthLink to="/register">Зарегистрироваться</AuthLink></>}
    />
  );
}
