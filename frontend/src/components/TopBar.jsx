import { BookOpen, LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function TopBar() {
  const { user, logout } = useAuth();
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  const exit = async () => {
    if (isExiting) return;
    setIsExiting(true);
    await logout({ revoke: true });
    navigate('/login');
  };

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <BookOpen size={22} />
        <span>Study Planner</span>
      </Link>
      <nav>
        <Link to="/profile" className="nav-link"><UserRound size={17} />{user?.name || 'Профиль'}</Link>
        <button className="ghost-button" disabled={isExiting} onClick={exit}><LogOut size={17} />{isExiting ? 'Выходим...' : 'Выйти'}</button>
      </nav>
    </header>
  );
}
