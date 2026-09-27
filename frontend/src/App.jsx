import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';

function Protected({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function AppFooter() {
  return (
    <footer className="site-footer">
      <strong>Study Planner</strong>
      <span>Учебный сервис для заметок, карточек, событий и повторения материалов.</span>
    </footer>
  );
}

export default function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={token ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/" element={<Protected><Dashboard /><AppFooter /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /><AppFooter /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
