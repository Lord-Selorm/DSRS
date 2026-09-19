import { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { FiUsers, FiEdit3, FiList, FiBarChart2, FiLogOut, FiSettings, FiRadio, FiHome, FiKey, FiSun, FiMoon, FiMessageSquare } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { roleLabel } from '../utils/roleLabel';
import Dashboard from '../pages/Dashboard';
import EndUsers from '../pages/EndUsers';
import DsrsEntry from '../pages/DsrsEntry';
import InventoryPreview from '../pages/InventoryPreview';
import Statistics from '../pages/Statistics';
import Traceability from '../pages/Traceability';
import UsersAdmin from '../pages/UsersAdmin';
import ChangePassword from '../pages/ChangePassword';
import Chat from '../pages/Chat';

const TABS = [
  { to: '/', label: 'Dashboard', icon: FiHome },
  { to: '/end-users', label: 'End Users', icon: FiUsers },
  { to: '/entry', label: 'DSRS Entry', icon: FiEdit3 },
  { to: '/preview', label: 'Inventory Preview', icon: FiList },
  { to: '/statistics', label: 'Statistics', icon: FiBarChart2 },
  { to: '/messages', label: 'Messages', icon: FiMessageSquare, badge: true },
];

export default function Shell() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const mustChange = !!user?.must_change_password;
  const unread = 0;

  // Unread chat badge (every 20s, plus on mount).
  useEffect(() => {
    const refresh = async () => {
      try {
        const { data } = await api.get('/chat/unread');
        setUnread(data?.total || 0);
      } catch { /* offline / server starting */ }
    };
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex flex-col bg-paper dark:bg-slate-950 overflow-hidden">
      {/* ======= Header ======= */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center shrink-0">
            <FiRadio className="text-white" size={17} />
          </div>
          <div className="leading-tight min-w-0">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Ghana DSRS Registry</h1>
            <p className="text-[10px] text-slate-400 leading-tight hidden sm:block dark:text-slate-500">
              National Radioactive Source Registry
            </p>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl dark:bg-slate-800">
          {TABS.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon size={15} />
              <span className="hidden md:inline">{label}</span>
              {badge && unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center shadow">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <button onClick={toggle} className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Toggle theme">
          {dark ? <FiSun size={16} /> : <FiMoon size={16} />}
        </button>

          {/* Account */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 pl-1.5 py-1.5 pr-2 rounded-lg hover:bg-slate-50 transition-colors dark:hover:bg-slate-800"
          >
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold uppercase">
              {(user?.full_name || 'U').charAt(0)}
            </div>
            <div className="leading-tight text-left hidden lg:block">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user?.full_name}</p>
              <p className="text-[10px] text-slate-400 capitalize dark:text-slate-500">
                {user?.role === 'admin' ? <span className="text-amber-600 dark:text-amber-400">Manager</span> : roleLabel(user?.role)}
              </p>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-panel py-1.5 z-50 dark:bg-slate-900 dark:border-slate-800">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user?.full_name}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">@{user?.username} · {user?.role === 'admin' ? <span className="text-amber-600 dark:text-amber-400 font-medium">Manager</span> : roleLabel(user?.role)}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/change-password'); }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiKey size={15} /> Change password
              </button>
              {user?.role === 'admin' && (
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'}`
                  }
                >
                  <FiSettings size={15} /> User management
                </NavLink>
              )}
              <button onClick={onLogout} className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                <FiLogOut size={15} /> Sign out
              </button>
            </div>
          )}
</div>
      </header>

      {/* ======= Content ======= */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        {mustChange ? (
          <ChangePassword forced />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/end-users" element={<EndUsers />} />
            <Route path="/entry" element={<DsrsEntry />} />
            <Route path="/preview" element={<InventoryPreview />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/messages" element={<Chat />} />
            <Route path="/sources/:id" element={<Traceability />} />
            <Route path="/admin/users" element={<UsersAdmin />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}