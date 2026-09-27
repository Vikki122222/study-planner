import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import AuthForm, { AuthLink } from './AuthForm.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const notify = useToast();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await register(form);
      notify.success('Аккаунт создан');
      navigate('/');
    } catch {
      const message = 'Не удалось зарегистрироваться. Возможно, email уже занят.';
      setError(message);
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthForm
      title="Регистрация"
      subtitle="Создайте пространство для заметок, карточек и учебного календаря."
      submitLabel="Создать аккаунт"
      loadingLabel="Создаем..."
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={submit}
      fields={(
        <>
          <label>Имя<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Пароль<input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        </>
      )}
      footer={<>Уже есть аккаунт? <AuthLink to="/login">Войти</AuthLink></>}
    />
  );
}
