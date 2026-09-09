import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FiRadio, FiUsers, FiAlertTriangle, FiTool, FiActivity,
  FiArrowRight, FiPlus, FiList, FiFileText, FiBarChart2,
} from 'react-icons/fi';

const CAT_META = {
  1: { name: 'Category 1', badge: 'bg-red-100 text-red-700', bar: 'bg-red-500' },
  2: { name: 'Category 2', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
  3: { name: 'Category 3', badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' },
  4: { name: 'Category 4', badge: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500' },
  5: { name: 'Category 5', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr + 'T00:00:00') - new Date();
  return Math.ceil(ms / 86400000);
}

function StatCard({ icon: Icon, label, value, tone, onClick }) {
  const toneCls =
    tone === 'red' ? 'bg-red-50 text-red-600' :
    tone === 'brand' ? 'bg-brand-50 text-brand-700' :
    'bg-slate-100 text-slate-600';
  return (
    <button
      onClick={onClick}
      className="card p-4 flex items-center gap-3 text-left hover:border-brand-300 transition-colors"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneCls}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value ?? '—'}</p>
        <p className="text-xs text-slate-500 truncate">{label}</p>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setData(data)).catch(() => {});
  }, []);

  const catTotal = (data?.byClassification || []).reduce((m, r) => ((m[r.source_classification] = r.count), m), {});
  const total = data?.total ?? 0;
  const highRisk = data?.highRisk || [];
  const due = data?.calibrationDue || [];
  const recent = data?.recentActivity || [];
  const maxCat = Math.max(1, ...Object.values(catTotal).map(Number));

  const bandFor = (cls) => CAT_META[cls] || { name: `Category ${cls}`, badge: 'bg-slate-200 text-slate-700', bar: 'bg-slate-400' };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => navigate('/entry')} className="btn-primary">
          <FiPlus size={15} /> Register a source
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={FiRadio} label="Registered sources" value={total} tone="brand" onClick={() => navigate('/preview')} />
        <StatCard icon={FiAlertTriangle} label="High-risk sources (Cat 1–2)" value={highRisk.length} tone="red" onClick={() => navigate('/preview')} />
        <StatCard icon={FiUsers} label="End users" value={data?.endUsers} onClick={() => navigate('/end-users')} />
        <StatCard icon={FiTool} label="Calibration due (90 days)" value={due.length} onClick={() => navigate('/preview')} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Left column */}
        <div className="space-y-6">
          {/* Category distribution */}
          <section className="card">
            <header className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">Category distribution</h2>
              <span className="micro-label">{total} sources</span>
            </header>
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5].map((cat) => {
                const meta = bandFor(cat);
                const n = Number(catTotal[cat] || 0);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className={`badge ${meta.badge} w-24 justify-center`}>{meta.name}</span>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${meta.bar} transition-all`} style={{ width: `${(n / maxCat) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-6 text-right">{n}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* High-risk sources */}
          <section className="card">
            <header className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FiAlertTriangle className="text-red-500" size={15} /> High-risk sources
              </h2>
              <button onClick={() => navigate('/preview')} className="text-xs font-medium text-brand-700 hover:underline flex items-center gap-1">
                View all <FiArrowRight size={12} />
              </button>
            </header>
            {highRisk.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No Category 1 or 2 sources on record.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {highRisk.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => navigate(`/sources/${s.id}`)}
                      className={`w-full px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 ${s.source_classification === 1 ? 'row-cat-1' : 'row-cat-2'}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {s.source_serial_no || s.device_serial_no}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {s.radionuclide} · {s.current_owner_name || 'Unknown owner'}
                        </p>
                      </div>
                      <span className={`badge ${bandFor(s.source_classification).badge} shrink-0`}>
                        Cat {s.source_classification}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Calibration due */}
          <section className="card">
            <header className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FiTool className="text-amber-500" size={15} /> Instrument calibration due
              </h2>
              <span className="micro-label">next 90 days</span>
            </header>
            {due.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nothing due in the next 90 days.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {due.map((s) => {
                  const days = daysUntil(s.leak_test_instrument_calibration_due_date);
                  const cls = days <= 30 ? 'bg-red-100 text-red-700' : days <= 60 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700';
                  const lbl = days < 0 ? 'overdue' : days === 0 ? 'due today' : days === 1 ? '1 day left' : `${days} days left`;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => navigate(`/sources/${s.id}`)}
                        className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{s.source_serial_no}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {s.radionuclide} · {new Date(s.leak_test_instrument_calibration_due_date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`badge ${cls} shrink-0`}>{lbl}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Recent activity */}
          <section className="card">
            <header className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FiActivity className="text-brand-600" size={15} /> Recent activity
              </h2>
            </header>
            {recent.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((h, i) => (
                  <li key={i} className="px-5 py-3 flex items-start gap-3">
                    <span className="mt-1 w-2 h-2 rounded-full bg-brand-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold capitalize">{h.change_type}</span>{' '}
                        <span className="text-slate-500">· {h.source_serial_no || h.field_changed}</span>
                        {h.radionuclide && <span className="text-slate-400"> · {h.radionuclide}</span>}
                      </p>
                      <p className="text-[11px] text-slate-400">{timeAgo(h.changed_at)} by {h.changed_by_name || 'system'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Quick actions */}
      <section className="grid sm:grid-cols-3 gap-3">
        {[
          { to: '/entry', icon: FiPlus, label: 'Register / edit a source' },
          { to: '/preview', icon: FiList, label: 'Browse inventory' },
          { to: '/end-users', icon: FiFileText, label: 'End users & exports' },
          { to: '/statistics', icon: FiBarChart2, label: 'Statistics & trends' },
        ].map(({ to, icon: Icon, label }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="card p-4 flex items-center gap-3 text-left hover:border-brand-300 transition-colors"
          >
            <Icon className="text-brand-600 shrink-0" size={17} />
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </button>
        ))}
      </section>
    </div>
  );
}