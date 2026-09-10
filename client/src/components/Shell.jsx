import { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { FiUsers, FiEdit3, FiList, FiBarChart2, FiLogOut, FiSettings, FiRadio, FiHome, FiKey } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';
import EndUsers from '../pages/EndUsers';
import DsrsEntry from '../pages/DsrsEntry';
import InventoryPreview from '../pages/InventoryPreview';
import Statistics from '../pages/Statistics';
import Traceability from '../pages/Traceability';
import UsersAdmin from '../pages/UsersAdmin';
import ChangePassword from '../pages/ChangePassword';

const TABS = [
  { to: '/', label: 'Dashboard', icon: FiHome },
  { to: '/end-users', label: 'End Users', icon: FiUsers },
  { to: '/entry', label: 'DSRS Entry', icon: FiEdit3 },
  { to: '/preview', label: 'Inventory Preview', icon: FiList },
  { to: '/statistics', label: 'Statistics', icon: FiBarChart2 },
];

export default function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const mustChange = !!user?.must_change_password;
  const [sync, setSync] = useState({ enabled: false, online: false, syncing: false });

  useEffect(() => {
    if (!window.dsrs?.isElectron) return;
    let alive = true;
    const refresh = async () => {
      try {
        const resp = await fetch('/api/sync/status', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
        if (!resp.ok) return;
        const data = await resp.json();
        if (alive) setSync(data);
      } catch { /* server starting */ }
    };
    refresh();
    const t = setInterval(refresh, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const onSyncNow = async () => {
    setSync((s) => ({ ...s, syncing: true }));
    try {
      const resp = await fetch('/api/sync/run', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (resp.ok) setSync(await resp.json());
    } catch { /* ignore */ }
    setSync((s) => ({ ...s, syncing: false }));
  };

  const syncLabel = sync.syncing ? 'Syncing…' : sync.online ? `Synced ${sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}` : 'Offline';
  const syncDot = sync.syncing ? 'bg-amber-400 animate-pulse' : sync.online ? 'bg-emerald-500' : 'bg-rose-400';

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
    <div className="h-screen flex flex-col bg-paper overflow-hidden">
      {/* ======= Header ======= */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center shrink-0">
            <FiRadio className="text-white" size={17} />
          </div>
          <div className="leading-tight min-w-0">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Ghana DSRS Registry</h1>
            <p className="text-[10px] text-slate-400 leading-tight hidden sm:block">
              National Radioactive Source Registry
            </p>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {TABS.map(({ to, label, icon: Icon, base }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`
              }
            >
              <Icon size={15} />
              <span className="hidden md:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        {window.dsrs?.isElectron && (
          <button
            onClick={onSyncNow}
            title={sync.enabled ? 'Last checked: ' + (sync.lastCheckedAt || '—') : 'Sync unavailable'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${
              sync.online ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${syncDot}`} />
            {syncLabel}
          </button>
        )}

        {/* Account */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 pl-1.5 py-1.5 pr-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold uppercase">
              {(user?.full_name || 'U').charAt(0)}
            </div>
            <div className="leading-tight text-left hidden lg:block">
              <p className="text-xs font-semibold text-slate-800">{user?.full_name}</p>
              <p className="text-[10px] text-slate-400 capitalize">{user?.role}</p>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-panel py-1.5 z-50">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-800">{user?.full_name}</p>
                <p className="text-[11px] text-slate-400">@{user?.username} · {user?.role}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/change-password'); }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <FiKey size={15} /> Change password
              </button>
              {user?.role === 'admin' && (
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 text-sm hover:bg-slate-50 ${isActive ? 'text-brand-700' : 'text-slate-600'}`
                  }
                >
                  <FiSettings size={15} /> User management
                </NavLink>
              )}
              <button onClick={onLogout} className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50">
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