import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { FiFilter, FiDownload, FiPrinter, FiSearch, FiEye, FiEdit, FiInbox, FiRefreshCw, FiAlertTriangle, FiPlus, FiList, FiFileText, FiUpload } from 'react-icons/fi';
import api from '../services/api';
import SourceEntryForm from '../components/SourceEntryForm';
import ImportModal from '../components/ImportModal';
import { toTbq, categoryLabel } from '../utils/unitConversion';
import { printInventoryReport } from '../utils/printInventoryReport';
import Pager from '../components/Pager';

const ALL = 100000;

export default function DsrsEntry() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = params.get('edit');
  const [tab, setTab] = useState('entry');

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState({});
  const [dValues, setDValues] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [draft, setDraft] = useState({});
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [reloadTick, setReloadTick] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => { if (editId) setTab('entry'); }, [editId]);

  const load = (f, signal) => {
    setLoading(true);
    api.get('/sources', { params: { ...f, limit: size, offset: (page - 1) * size }, signal })
      .then(({ data }) => {
        setRows(data.rows);
        setTotal(data.total);
        setCategoryTotals((data.categoryTotals || []).reduce((m, r) => ((m[r.source_classification] = r.count), m), {}));
        const maxPage = Math.max(1, Math.ceil(data.total / size));
        if (page > maxPage) setPage(maxPage);
      })
      .catch((err) => { if (err.name !== 'CanceledError' && err.name !== 'AbortError') console.error(err); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/sources/d-values').then(({ data }) => setDValues(data)).catch(() => {});
    api.get('/institutions').then(({ data }) => setInstitutions(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(filters, controller.signal);
    return () => controller.abort();
  }, [page, size, reloadTick, JSON.stringify(filters)]);

  const applyFilters = (e) => {
    e?.preventDefault();
    setFilters(draft);
    setPage(1);
  };

  const resetFilters = () => {
    setDraft({});
    setFilters({});
    setPage(1);
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  const fetchAll = () =>
    api.get('/sources', { params: { ...filters, limit: ALL, offset: 0 } }).then((d) => d.data.rows);

  const exportExcel = async () => {
    const all = await fetchAll();
    const ws = XLSX.utils.json_to_sheet(all);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sources');
    XLSX.writeFile(wb, `dsrs_inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Inventory exported to Excel');
  };

  const printReport = async () => {
    const all = await fetchAll();
    printInventoryReport({ sources: all, institutions });
  };

  const rowColor = (cat) => `row-cat-${[1, 2, 3, 4, 5].includes(cat) ? cat : 0}`;
  const catDot = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-amber-500', 4: 'bg-sky-400', 5: 'bg-emerald-500' };

  const tabBtn = (active) =>
    `inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
    }`;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">DSRS Entry</h1>
          <p className="text-sm text-slate-500 mt-0.5">Register new sources and manage the national inventory</p>
        </div>
        {editId ? (
          <button onClick={() => setParams({}, { replace: true })} className="btn-primary">
            <FiRefreshCw size={15} /> Back to new entry
          </button>
        ) : (
          <button onClick={() => setImportOpen(true)} className="btn-secondary">
            <FiUpload size={15} /> Bulk import
          </button>
        )}
      </div>

      {/* Tabs: keep registering and inventory separate */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setTab('entry')} className={tabBtn(tab === 'entry')}>
          <FiPlus size={15} /> Register / Edit Source
        </button>
        <button onClick={() => setTab('inventory')} className={tabBtn(tab === 'inventory')}>
          <FiList size={15} /> Inventory {total > 0 && <span className="opacity-70">({total})</span>}
        </button>
      </div>

      {tab === 'entry' && (
        <div className="max-w-5xl">
          <SourceEntryForm
            editId={editId}
            onSaved={() => navigate('/preview')}
            onCancel={() => { if (editId) setParams({}, { replace: true }); }}
          />
        </div>
      )}

      {tab === 'inventory' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          {/* Results table */}
          <section className="card overflow-hidden">
            <header className="card-header">
              <div>
                <h2 className="font-semibold text-sm text-slate-800">All entries</h2>
                <p className="text-xs text-slate-400 mt-0.5">Rows are color-coded by IAEA source category</p>
              </div>
              <Legend />
            </header>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Device</th>
                    <th>Radionuclide</th>
                    <th>Activity</th>
                    <th>Category</th>
                    <th>End user</th>
                    <th>Location</th>
                    <th>Conditioning</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className={rowColor(s.source_classification)}>
                      <td>
                        <Link to={`/sources/${s.id}`} className="font-mono font-semibold text-slate-900 hover:text-brand-700">{s.source_serial_no || `#${s.id}`}</Link>
                        {s.no_on_source && <p className="text-[11px] text-slate-400 font-mono">№ {s.no_on_source}</p>}
                      </td>
                      <td className="font-mono text-slate-500">{s.device_serial_no || '—'}</td>
                      <td className="font-semibold text-slate-800">{s.radionuclide}</td>
                      <td>
                        {s.current_activity ? (
                          <span className="font-mono text-slate-700">
                            {Number.isFinite(Number(s.current_activity)) ? Number(s.current_activity).toLocaleString() : s.current_activity} {s.current_activity_unit}
                          </span>
                        ) : '—'}
                        <p className="text-[11px] text-slate-400">
                          ≈ {s.current_activity ? formatTbq(toTbq(s.current_activity, s.current_activity_unit)) : '—'}
                        </p>
                      </td>
                      <td>
                        <span className={catBadge(s.source_classification)}>{categoryLabel(s.source_classification)}</span>
                      </td>
                      <td className="text-slate-600 min-w-[160px]">{s.current_owner_name || '—'}</td>
                      <td className="text-slate-600">{s.storage_facility_unit || '—'}</td>
                      <td><CondBadge status={s.conditioning_status} /></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Link to={`/sources/${s.id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50" title="Traceability">
                            <FiEye size={15} />
                          </Link>
                          <Link to={`/entry?edit=${s.id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50" title="Edit">
                            <FiEdit size={15} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager total={total} page={page} size={size} onPage={setPage} onSize={setSize} />
            {rows.length === 0 && !loading && (
              <div className="empty-state">
                <FiInbox size={40} className="mb-3 text-slate-300" />
                <p className="font-medium text-slate-500">No entries match</p>
                <p className="text-sm mt-1">Register a source in the form tab, or reset the filters.</p>
              </div>
            )}
            {loading && (
              <div className="py-16 flex items-center justify-center">
                <span className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
              </div>
            )}
          </section>

          {/* Right: filters & export */}
          <aside className="space-y-4 xl:sticky xl:top-0">
            <section className="card overflow-hidden">
              <button onClick={() => setShowFilters(!showFilters)} className="w-full card-header cursor-pointer hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <FiFilter size={16} className="text-brand-600" />
                  <h2 className="font-semibold text-sm text-slate-800">Filters {activeCount > 0 && <span className="badge-teal ml-1">{activeCount}</span>}</h2>
                </div>
                <span className="text-xs text-slate-400">{showFilters ? 'hide' : 'show'}</span>
              </button>
              {showFilters && (
                <form onSubmit={applyFilters} className="p-4 space-y-3">
                  <div>
                    <label className="field-label">End user (owner)</label>
                    <select value={draft.current_owner_id || ''} onChange={(e) => setDraft({ ...draft, current_owner_id: e.target.value || undefined })} className="input">
                      <option value="">All end users</option>
                      {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Radionuclide</label>
                    <select value={draft.radionuclide || ''} onChange={(e) => setDraft({ ...draft, radionuclide: e.target.value || undefined })} className="input">
                      <option value="">All radionuclides</option>
                      {dValues.map((d) => <option key={d.id} value={d.radionuclide}>{d.radionuclide}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Category</label>
                    <select value={draft.source_classification || ''} onChange={(e) => setDraft({ ...draft, source_classification: e.target.value || undefined })} className="input">
                      <option value="">All categories</option>
                      {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>Category {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Quick search</label>
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        value={draft.q || ''}
                        onChange={(e) => setDraft({ ...draft, q: e.target.value || undefined })}
                        className="input pl-9"
                        placeholder="Serial, device, barcode, NRA reg, radionuclide…"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" className="btn-primary flex-1">Apply</button>
                    <button type="button" onClick={resetFilters} className="btn-secondary" title="Reset filters">
                      <FiRefreshCw size={14} />
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Export */}
            <section className="card overflow-hidden">
              <header className="card-header">
                <div className="flex items-center gap-2">
                  <FiDownload size={16} className="text-brand-600" />
                  <h2 className="font-semibold text-sm text-slate-800">Export inventory</h2>
                </div>
              </header>
              <div className="p-4 grid grid-cols-3 gap-2">
                <button onClick={exportExcel} className="btn-secondary !py-2">
                  <FiDownload size={14} /> Excel
                </button>
                <button onClick={() => window.print()} className="btn-secondary !py-2">
                  <FiPrinter size={14} /> Print / PDF
                </button>
                <button onClick={() => printReport()} className="btn-secondary !py-2">
                  <FiFileText size={14} /> Report
                </button>
              </div>
              <div className="px-4 pb-4 pt-0 text-[11px] text-slate-400">
                Exports the {total} record(s) shown in the table.
              </div>
            </section>

            {/* Category tally */}
            <section className="card p-4">
              <p className="micro-label mb-3">Inventory mix — {total} sources</p>
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((c) => (
                  <div key={c} className="flex items-center gap-2 text-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${catDot[c]}`} />
                    <span className="text-slate-500 flex-1">Category {c}</span>
                    <span className="font-semibold text-slate-800">{categoryTotals[c] || 0}</span>
                  </div>
                ))}
                {total > 0 && ((categoryTotals[1] || 0) + (categoryTotals[2] || 0)) > 0 && (
                  <p className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-xs text-rose-600">
                    <FiAlertTriangle size={13} /> {(categoryTotals[1] || 0) + (categoryTotals[2] || 0)} high-risk source(s)
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { setReloadTick((t) => t + 1); setTab('inventory'); }}
      />
    </div>
  );
}

function catBadge(cat) {
  const colors = {
    1: 'bg-red-100 text-red-700',
    2: 'bg-orange-100 text-orange-700',
    3: 'bg-amber-100 text-amber-800',
    4: 'bg-sky-100 text-sky-700',
    5: 'bg-emerald-100 text-emerald-700',
  };
  return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${colors[cat] || 'bg-slate-200 text-slate-600'}`;
}

function formatTbq(v) {
  if (!v) return '—';
  if (v >= 1000) return `${v} TBq`;
  if (v >= 1) return `${v.toFixed(2)} TBq`;
  if (v >= 1e-3) return `${(v * 1e3).toFixed(1)} GBq`;
  if (v >= 1e-6) return `${(v * 1e6).toFixed(1)} MBq`;
  return `${(v * 1e12).toFixed(0)} Bq`;
}

function CondBadge({ status }) {
  const map = {
    none: <span className="badge-slate">Not conditioned</span>,
    conditioned: <span className="badge-teal">Conditioned</span>,
    disposed: <span className="badge-rose">Disposed</span>,
  };
  return map[status] || <span className="badge-slate">Unknown</span>;
}

function Legend() {
  const items = [['bg-red-500', 'Cat 1'], ['bg-orange-500', 'Cat 2'], ['bg-amber-500', 'Cat 3'], ['bg-sky-400', 'Cat 4'], ['bg-emerald-500', 'Cat 5']];
  return (
    <div className="flex items-center gap-3">
      {items.map(([dot, label]) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className={`w-2 h-2 rounded-full ${dot}`} /> {label}
        </span>
      ))}
    </div>
  );
}