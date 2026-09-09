import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { FiSearch, FiDownload, FiPrinter, FiInbox, FiEye, FiSliders, FiX, FiFileText } from 'react-icons/fi';
import api from '../services/api';
import { toTbq, categoryLabel } from '../utils/unitConversion';
import { formatDate } from '../utils/unitConversion';
import { printInventoryReport } from '../utils/printInventoryReport';

const PAGE = 100000;

export default function InventoryPreview() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [dValues, setDValues] = useState([]);
  const [institutions, setInstitutions] = useState([]);

  const load = () => {
    setLoading(true);
    api.get('/sources', { params: { ...filters, limit: PAGE, offset: 0 } })
      .then(({ data }) => { setRows(data.rows); setTotal(data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/sources/d-values').then(({ data }) => setDValues(data)).catch(() => {});
    api.get('/institutions').then(({ data }) => setInstitutions(data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  const searchable = useMemo(() => {
    let out = rows;
    if (filters.high_risk === '1') {
      out = out.filter((r) => r.source_classification === 1 || r.source_classification === 2);
    }
    const q = term.trim().toLowerCase();
    if (!q) return out;
    return out.filter((r) =>
      [r.source_serial_no, r.device_serial_no, r.nra_registration_no, r.source_barcode, r.radionuclide, r.current_owner_name, r.storage_facility_unit]
        .some((v) => v && String(v).toLowerCase().includes(q))
    );
  }, [rows, term, filters.high_risk]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(searchable);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `dsrs_inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Inventory exported to Excel');
  };

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value || undefined }));

  const rowColor = (cat) => `row-cat-${[1, 2, 3, 4, 5].includes(cat) ? cat : 0}`;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Inventory Preview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Read-only view of all registered sources · {total} records</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printInventoryReport({ sources: searchable, institutions })} className="btn-secondary"><FiFileText size={15} /> Report (PDF)</button>
          <button onClick={exportExcel} className="btn-secondary"><FiDownload size={15} /> Excel</button>
          <button onClick={() => window.print()} className="btn-secondary"><FiPrinter size={15} /> Print</button>
          <button onClick={() => setPanelOpen(!panelOpen)} className={`btn-secondary ${panelOpen ? '!border-brand-500 !text-brand-700' : ''}`}>
            <FiSliders size={15} /> Filters {Object.values(filters).filter(Boolean).length > 0 && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center font-bold">
                {Object.values(filters).filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toolbar + filter panel */}
      <div className="card p-4 space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); }} className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="input pl-10"
              placeholder="Instant search — serial, device, barcode, radionuclide, owner…"
            />
          </div>
          {term && (
            <button type="button" onClick={() => setTerm('')} className="btn-ghost !px-2.5" title="Clear search">
              <FiX size={15} />
            </button>
          )}
        </form>

        {panelOpen && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="field-label">Category</label>
              <select value={filters.source_classification || ''} onChange={(e) => set('source_classification', e.target.value)} className="input">
                <option value="">All</option>
                {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>Category {c}</option>)}
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
              <label className="field-label">Conditioning</label>
              <select value={filters.conditioning_status || ''} onChange={(e) => set('conditioning_status', e.target.value)} className="input">
                <option value="">All</option>
                <option value="none">Not conditioned</option>
                <option value="conditioned">Conditioned</option>
                <option value="disposed">Disposed</option>
              </select>
            </div>
            <div>
              <label className="field-label">High risk only</label>
              <div className="h-[38px] flex items-center">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.high_risk === '1'}
                    onChange={(e) => set('high_risk', e.target.checked ? '1' : undefined)}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Cat 1 + 2
                </label>
              </div>
            </div>
            <div>
              <label className="field-label">&nbsp;</label>
              <button
                onClick={() => { setFilters({}); setTerm(''); setPanelOpen(false); }}
                className="btn-ghost w-full !py-2 text-xs"
              >
                Reset all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Device</th>
                <th>Barcode</th>
                <th>NRA reg</th>
                <th>Radionuclide</th>
                <th>Activity (now)</th>
                <th>Category</th>
                <th>End user</th>
                <th>Location</th>
                <th>Last verified</th>
                <th className="text-right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {searchable.map((s) => (
                <tr key={s.id} className={rowColor(s.source_classification)}>
                  <td className="font-mono font-semibold text-slate-900">{s.source_serial_no || `#${s.id}`}</td>
                  <td className="font-mono text-slate-500">{s.device_serial_no || '—'}</td>
                  <td className="font-mono text-slate-500">{s.source_barcode || '—'}</td>
                  <td className="font-mono text-slate-500">{s.nra_registration_no || '—'}</td>
                  <td className="font-semibold text-slate-800">{s.radionuclide}</td>
                  <td className="text-slate-600">
                    {s.current_activity ? (
                      <span className="font-mono">{Number(s.current_activity).toLocaleString()} {s.current_activity_unit}</span>
                    ) : '—'}
                    {s.current_activity && (
                      <span className="text-[11px] text-slate-400"> ({formatTbq(toTbq(s.current_activity, s.current_activity_unit))})</span>
                    )}
                  </td>
                  <td><span className={catBadge(s.source_classification)}>{categoryLabel(s.source_classification)}</span></td>
                  <td className="min-w-[160px] text-slate-600">{s.current_owner_name || '—'}</td>
                  <td className="text-slate-600">{s.storage_facility_unit || '—'}</td>
                  <td className="text-slate-500">{formatDate(s.date_last_verified)}</td>
                  <td>
                    <div className="flex justify-end">
                      <Link to={`/sources/${s.id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50" title="Traceability">
                        <FiEye size={15} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {searchable.length === 0 && !loading && (
          <div className="empty-state">
            <FiInbox size={40} className="mb-3 text-slate-300" />
            <p className="font-medium text-slate-500">Nothing to preview</p>
            <p className="text-sm mt-1">Register sources in the DSRS Entry tab.</p>
          </div>
        )}
        {loading && (
          <div className="py-16 flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
          </div>
        )}
      </div>
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