import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Chart as ChartJS, ArcElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, ScatterController, BarController, BarElement } from 'chart.js';
import { Scatter, Pie, Bar } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import { FiDownload, FiFilter, FiRefreshCw, FiBarChart2, FiInbox } from 'react-icons/fi';
import api from '../services/api';
import { toTbq } from '../utils/unitConversion';

ChartJS.register(ArcElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, ScatterController, BarController, BarElement);

const PAGE = 100000;

export default function Statistics() {
  const [all, setAll] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [dValues, setDValues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const exportRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get('/sources', { params: { limit: PAGE, offset: 0 } }).then(({ data }) => setAll(data.rows)),
      api.get('/institutions').then(({ data }) => setInstitutions(data)),
      api.get('/sources/d-values').then(({ data }) => setDValues(data)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  const locations = useMemo(() =>
    [...new Set(all.map((r) => r.storage_facility_unit).filter(Boolean))].sort(),
  [all]);

  const years = useMemo(() => {
    const ys = new Set();
    all.forEach((r) => { const y = yearOf(r); if (y) ys.add(y); });
    return [...ys].sort();
  }, [all]);

  const filtered = useMemo(() => {
    let out = all;
    if (filters.current_owner_id) out = out.filter((r) => String(r.current_owner_id) === String(filters.current_owner_id));
    if (filters.radionuclide) out = out.filter((r) => r.radionuclide === filters.radionuclide);
    if (filters.category) out = out.filter((r) => r.source_classification === Number(filters.category));
    if (filters.location) out = out.filter((r) => r.storage_facility_unit === filters.location);
    if (filters.year) out = out.filter((r) => String(yearOf(r)) === String(filters.year));
    if (filters.conditioning) out = out.filter((r) => r.conditioning_status === filters.conditioning);
    return out;
  }, [all, filters]);

  const locationData = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const k = r.storage_facility_unit || 'Unassigned';
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [filtered]);

  const radionuclideData = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      map[r.radionuclide] = (map[r.radionuclide] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [filtered]);

  const scatterData = useMemo(() => {
    const pts = filtered
      .map((r) => {
        const y = yearOf(r);
        const tbq = toTbq(r.current_activity, r.current_activity_unit);
        if (!y || !tbq) return null;
        return { x: y, y: Number(tbq), s: r };
      })
      .filter(Boolean);
    const colors = { 1: '#dc2626', 2: '#f97316', 3: '#f59e0b', 4: '#0ea5e9', 5: '#10b981' };
    const datasets = [1, 2, 3, 4, 5].map((cat) => {
      const subset = pts.filter((p) => (p.s.source_classification || 5) === cat);
      return {
        label: `Category ${cat}`,
        data: subset.map(({ x, y, s }) => ({ x, y, source: s })),
        backgroundColor: colors[cat],
        pointRadius: 6,
        pointHoverRadius: 8,
      };
    }).filter((d) => d.data.length > 0);
    return datasets;
  }, [filtered]);

  // Aggregate totals by year for a compact summary table under the scatter
  const byYear = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const y = yearOf(r);
      if (!y) return;
      map[y] = map[y] || { count: 0, activity: 0 };
      map[y].count += 1;
      map[y].activity += toTbq(r.current_activity, r.current_activity_unit) || 0;
    });
    return Object.entries(map).sort(([a], [b]) => a - b);
  }, [filtered]);

  const totalActivity = useMemo(() =>
    filtered.reduce((acc, r) => acc + (toTbq(r.current_activity, r.current_activity_unit) || 0), 0),
  [filtered]);

  const exportImage = async () => {
    try {
      toast.loading('Rendering…', { id: 'stat-export' });
      const canvas = await html2canvas(exportRef.current, { backgroundColor: '#f4f5f7', scale: 2 });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `dsrs_statistics_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      toast.success('Image exported', { id: 'stat-export' });
    } catch {
      toast.error('Export failed', { id: 'stat-export' });
    }
  };

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value || undefined }));
  const reset = () => setFilters({});
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Statistics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Inventory analytics by location and receipt year</p>
        </div>
        <button onClick={exportImage} className="btn-secondary">
          <FiDownload size={15} /> Export image
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
        {/* Filters */}
        <aside className="card overflow-hidden xl:sticky xl:top-0">
          <header className="card-header">
            <div className="flex items-center gap-2">
              <FiFilter size={16} className="text-brand-600" />
              <h2 className="font-semibold text-sm text-slate-800">Filter {activeCount > 0 && <span className="badge-teal ml-1">{activeCount}</span>}</h2>
            </div>
          </header>
          <div className="p-4 space-y-3">
            <div>
              <label className="field-label">End user</label>
              <select value={filters.current_owner_id || ''} onChange={(e) => set('current_owner_id', e.target.value)} className="input">
                <option value="">All</option>
                {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Radionuclide</label>
              <select value={filters.radionuclide || ''} onChange={(e) => set('radionuclide', e.target.value)} className="input">
                <option value="">All</option>
                {dValues.map((d) => <option key={d.id} value={d.radionuclide}>{d.radionuclide}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Category</label>
              <select value={filters.category || ''} onChange={(e) => set('category', e.target.value)} className="input">
                <option value="">All</option>
                {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>Category {c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Location</label>
              <select value={filters.location || ''} onChange={(e) => set('location', e.target.value)} className="input">
                <option value="">All locations</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Receipt year</label>
              <select value={filters.year || ''} onChange={(e) => set('year', e.target.value)} className="input">
                <option value="">All years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Status</label>
              <select value={filters.conditioning || ''} onChange={(e) => set('conditioning', e.target.value)} className="input">
                <option value="">All</option>
                <option value="none">Not conditioned</option>
                <option value="conditioned">Conditioned</option>
                <option value="disposed">Disposed</option>
              </select>
            </div>
            <button onClick={reset} disabled={activeCount === 0} className="btn-ghost w-full mt-1">
              <FiRefreshCw size={14} /> Reset
            </button>
          </div>
        </aside>

        {/* Charts */}
        <div ref={exportRef} className="space-y-5 min-w-0">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="Sources" value={filtered.length} />
            <SummaryCard label="Total activity" value={formatTbq(totalActivity)} />
            <SummaryCard label="Locations" value={Object.keys(locationData).length} />
          </div>

          <section className="card overflow-hidden">
            <header className="card-header">
              <div className="flex items-center gap-2">
                <FiBarChart2 size={16} className="text-brand-600" />
                <h2 className="font-semibold text-sm text-slate-800">Sources per storage location</h2>
              </div>
              <span className="text-xs text-slate-400">{filtered.length} sources</span>
            </header>
            <div className="p-5">
              {filtered.length === 0 ? (
                <EmptyCharts />
              ) : (
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="w-56 h-56 shrink-0">
                    <Pie
                      data={{
                        labels: Object.keys(locationData),
                        datasets: [{
                          data: Object.values(locationData),
                          backgroundColor: ['#0e7490', '#f59e0b', '#ef4444', '#10b981', '#7c3aed', '#0284c7', '#f97316', '#64748b'],
                          borderWidth: 2,
                          borderColor: '#ffffff',
                        }],
                      }}
                      options={{ cutout: '55%', plugins: { legend: { display: false } }, maintainAspectRatio: false }}
                    />
                  </div>
                  <div className="flex-1 min-w-[220px] space-y-2">
                    {Object.entries(locationData).map(([loc, count], i) => {
                      const colors = ['#0e7490', '#f59e0b', '#ef4444', '#10b981', '#7c3aed', '#0284c7', '#f97316', '#64748b'];
                      const pct = filtered.length ? Math.round((count / filtered.length) * 100) : 0;
                      return (
                        <div key={loc} className="flex items-center gap-2 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
                          <span className="text-slate-600 flex-1 truncate">{loc}</span>
                          <span className="font-semibold text-slate-800">{count}</span>
                          <span className="text-slate-400 w-9 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card overflow-hidden">
            <header className="card-header">
              <div className="flex items-center gap-2">
                <FiBarChart2 size={16} className="text-brand-600" />
                <h2 className="font-semibold text-sm text-slate-800">Sources per radionuclide</h2>
              </div>
              <span className="text-xs text-slate-400">{filtered.length} sources</span>
            </header>
            <div className="p-5">
              {filtered.length === 0 ? (
                <EmptyCharts />
              ) : (
                <div className="h-72">
                  <Bar
                    data={{
                      labels: radionuclideData.map(([n]) => n),
                      datasets: [{
                        label: 'Sources',
                        data: radionuclideData.map(([, c]) => c),
                        backgroundColor: '#0e7490',
                        hoverBackgroundColor: '#155e75',
                        borderRadius: 6,
                        maxBarThickness: 42,
                      }],
                    }}
                    options={{
                      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} source(s)` } } },
                      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } },
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="card overflow-hidden">
            <header className="card-header">
              <div className="flex items-center gap-2">
                <FiBarChart2 size={16} className="text-brand-600" />
                <h2 className="font-semibold text-sm text-slate-800">Activity vs. registration year</h2>
              </div>
              <span className="text-xs text-slate-400">per source · category-colored</span>
            </header>
            <div className="p-5">
              {scatterData.length > 0 ? (
                <>
                  <div className="h-72">
                    <Scatter
                      data={{ datasets: scatterData }}
                      options={{
                        plugins: { tooltip: {
                          callbacks: {
                            label: (ctx) => `${ctx?.raw?.source?.source_serial_no || ''} — ${formatTbq(ctx.parsed.y)}`,
                          },
                        }},
                        scales: {
                          x: { title: { display: true, text: 'Year of receipt' }, grid: { color: '#f1f5f9' } },
                          y: { title: { display: true, text: 'Activity (TBq)' }, grid: { color: '#f1f5f9' } },
                        },
                        maintainAspectRatio: false,
                      }}
                    />
                  </div>
                  {/* Year summary table */}
                  <div className="mt-4">
                    <table className="data-table !text-xs">
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Sources</th>
                          <th>Total activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byYear.map(([y, v]) => (
                          <tr key={y}>
                            <td className="font-semibold text-slate-800">{y}</td>
                            <td>{v.count}</td>
                            <td className="font-mono">{formatTbq(v.activity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyCharts />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function yearOf(r) {
  if (r.original_activity_date) { const y = new Date(r.original_activity_date).getFullYear(); if (!Number.isNaN(y)) return y; }
  if (r.current_activity_date) { const y = new Date(r.current_activity_date).getFullYear(); if (!Number.isNaN(y)) return y; }
  return null;
}

function SummaryCard({ label, value }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function EmptyCharts() {
  return (
    <div className="h-56 flex flex-col items-center justify-center text-slate-400">
      <FiInbox size={34} className="mb-2 text-slate-300" />
      <p className="text-sm">No sources match the selected filters.</p>
    </div>
  );
}

function formatTbq(v) {
  if (!v) return '0 TBq';
  if (v >= 1000) return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} TBq`;
  if (v >= 1) return `${v.toFixed(2)} TBq`;
  if (v >= 1e-3) return `${(v * 1e3).toFixed(1)} GBq`;
  if (v >= 1e-6) return `${(v * 1e6).toFixed(1)} MBq`;
  return `${(v * 1e12).toFixed(0)} Bq`;
}