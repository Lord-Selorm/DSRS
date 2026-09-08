import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiEdit, FiDownload, FiCamera, FiShield, FiActivity, FiClock, FiPrinter } from 'react-icons/fi';
import api from '../services/api';
import { categoryBadge, categoryLabel, formatDate } from '../utils/unitConversion';

export default function Traceability() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [source, setSource] = useState(null);
  const [qr, setQr] = useState(null);

  useEffect(() => {
    setSource(null);
    setQr(null);
    api.get(`/sources/${id}`).then(({ data }) => setSource(data)).catch(() => {});
    api.get(`/sources/${id}/qrcode`, { responseType: 'blob' })
      .then(({ data }) => setQr(URL.createObjectURL(data)))
      .catch(() => {});
  }, [id]);

  const downloadQr = () => {
    const a = document.createElement('a');
    a.href = qr;
    a.download = `source_${source?.source_serial_no || id}_qr.png`;
    a.click();
  };

  const statusRows = useMemo(() => {
    if (!source) return [];
    const rows = [];
    (source.history || []).forEach((h) => {
      const row = {
        id: h.id,
        date: h.changed_at,
        type: h.change_type,
        changed_by: h.changed_by_name,
        field: h.field_changed,
        prev: h.previous_value,
        next: h.new_value,
      };
      rows.push(row);
    });
    return rows;
  }, [source]);

  if (!source) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/preview')} className="btn-ghost !px-2.5">
            <FiChevronLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">Traceability</h1>
              <span className={categoryBadge(source.source_classification)}>{categoryLabel(source.source_classification)}</span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Source <span className="font-mono">{source.source_serial_no || `#${source.id}`}</span> · {source.radionuclide} · registered {formatDate(source.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="btn-secondary"><FiPrinter size={15} /> Print</button>
          <Link to={`/entry?edit=${source.id}`} className="btn-primary"><FiEdit size={15} /> Edit record</Link>
        </div>
      </div>

      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] items-stretch">
          {source.photo_path ? (
            <img src={`/uploads/${source.photo_path}`} alt="Source" className="w-full lg:w-48 h-48 object-cover" />
          ) : (
            <div className="hidden lg:flex w-48 items-center justify-center bg-slate-50 text-slate-300 border-r border-slate-100">
              <FiCamera size={40} />
            </div>
          )}
          <div className="p-6 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-4">
              {source.contamination_status === 'contaminated' && <span className="badge-rose">Contaminated</span>}
              {source.source_integrity === 'damaged' && <span className="badge-red">Damaged</span>}
              {source.borehole_disposal_intention ? <span className="badge-amber">Borehole intended</span> : null}
              <span className="badge-teal">{source.conditioning_status}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-3">
              <HeroItem label="End user" value={source.current_owner_name || '—'} />
              <HeroItem label="Facility / unit" value={source.storage_facility_unit || '—'} />
              <HeroItem label="Activity" value={source.current_activity ? `${source.current_activity} ${source.current_activity_unit}` : '—'} />
              <HeroItem label="D-value" value={source.d_value_tbq ? `${source.d_value_tbq} TBq` : '—'} />
              <HeroItem label="NRA reg" value={source.nra_registration_no || '—'} mono />
              <HeroItem label="Device serial" value={source.device_serial_no || '—'} mono />
              <HeroItem label="No. on source" value={source.no_on_source || '—'} mono />
              <HeroItem label="Last verified" value={source.date_last_verified ? formatDate(source.date_last_verified) : '—'} />
            </div>
          </div>
          <div className="p-5 lg:border-l border-slate-100 flex flex-col items-center justify-center bg-slate-50/50">
            {qr ? (
              <>
                <img src={qr} alt="QR" className="w-32 h-32 bg-white rounded-lg p-1" />
                <button onClick={downloadQr} className="btn-secondary !px-3 !py-1.5 text-xs mt-3">
                  <FiDownload size={13} /> Download QR
                </button>
              </>
            ) : (
              <div className="w-32 h-32 rounded-lg bg-white flex items-center justify-center text-xs text-slate-400">QR unavailable</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
        {/* Main: status history + change log */}
        <div className="space-y-5 min-w-0">
          {/* Status change history */}
          <section className="card overflow-hidden">
            <header className="card-header">
              <div className="flex items-center gap-2">
                <FiShield size={16} className="text-brand-600" />
                <h2 className="font-semibold text-sm text-slate-800">Status change history</h2>
              </div>
              <span className="text-xs text-slate-400">{statusRows.length} events</span>
            </header>

            {/* Current state summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50/60 border-b border-slate-100">
              <Stat label="Status" value={source.conditioning_status} />
              <Stat label="Location" value={source.storage_facility_unit || '—'} />
              <Stat label="Capsule no." value={source.capsule_no_id || '—'} />
              <Stat label="Waste pkg no." value={source.concrete_drum_no || '—'} />
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Capsule no.</th>
                    <th>Waste pkg no.</th>
                    <th>Changed by</th>
                  </tr>
                </thead>
                <tbody>
                  {statusRows.map((h) => (
                    <Row key={h.id} h={h} />
                  ))}
                </tbody>
              </table>
            </div>
            {statusRows.length === 0 && (
              <p className="text-sm text-slate-400 p-5">No status changes recorded yet.</p>
            )}
          </section>

          {/* Full change log */}
          <section className="card overflow-hidden">
            <header className="card-header">
              <div className="flex items-center gap-2">
                <FiClock size={16} className="text-brand-600" />
                <h2 className="font-semibold text-sm text-slate-800">Full change log</h2>
              </div>
              <span className="text-xs text-slate-400">audit trail</span>
            </header>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Field</th>
                    <th>Previous</th>
                    <th>New</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {(source.history || []).map((h) => (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap text-slate-500">{formatDate(h.changed_at)}</td>
                      <td><span className="badge-slate capitalize">{h.change_type}</span></td>
                      <td className="font-mono text-slate-700">{h.field_changed}</td>
                      <td className="text-slate-400">{h.previous_value || '—'}</td>
                      <td className="font-medium text-slate-700">{h.new_value || '—'}</td>
                      <td className="text-slate-500">{h.changed_by_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(source.history || []).length === 0 && (
              <p className="text-sm text-slate-400 p-5">No changes yet.</p>
            )}
          </section>

          {/* Detail groups */}
          <DetailGroups source={source} />
        </div>

        {/* Right: measurements + leak tests */}
        <div className="space-y-5 lg:sticky lg:top-0">
          <Measurements source={source} />
          <LeakTests source={source} />
        </div>
      </div>
    </div>
  );
}

function Row({ h }) {
  const cols = {
    conditioning_status: null,
    source_integrity: null,
    storage_facility_unit: null,
    capsule_no_id: null,
    concrete_drum_no: null,
  };
  if (h.field in cols) cols[h.field] = h.next;
  return (
    <tr>
      <td className="whitespace-nowrap text-slate-500">{formatDate(h.date)}</td>
      <td>
        {h.field === 'conditioning_status' ? <Chip value={h.next} /> : cols.conditioning_status ?? '—'}
      </td>
      <td className="text-slate-600">{cols.storage_facility_unit || <span className="text-slate-300">—</span>}</td>
      <td className="font-mono text-slate-600">{cols.capsule_no_id || <span className="text-slate-300">—</span>}</td>
      <td className="font-mono text-slate-600">{cols.concrete_drum_no || <span className="text-slate-300">—</span>}</td>
      <td className="text-slate-500">{h.changed_by || '—'}</td>
    </tr>
  );
}

function Chip({ value }) {
  const map = {
    none: <span className="badge-slate">Not conditioned</span>,
    conditioned: <span className="badge-teal">Conditioned</span>,
    disposed: <span className="badge-rose">Disposed</span>,
    intact: <span className="badge-green">Intact</span>,
    damaged: <span className="badge-red">Damaged</span>,
    unknown: <span className="badge-slate">Unknown</span>,
  };
  return map[value] || <span className="badge-slate">{value || '—'}</span>;
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 capitalize truncate">{value}</p>
    </div>
  );
}

function HeroItem({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm font-semibold text-slate-800 truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function DetailGroups({ source }) {
  const groups = [
    { title: 'Identifiers & radionuclide', items: [
      ['Device serial no.', source.device_serial_no, 'mono'],
      ['Source serial no.', source.source_serial_no, 'mono'],
      ['NRA registration no.', source.nra_registration_no, 'mono'],
      ['Source barcode', source.source_barcode, 'mono'],
      ['No. on the source', source.no_on_source, 'mono'],
      ['Radionuclide', source.radionuclide],
      ['Half-life', source.half_life_value ? `${source.half_life_value} ${source.half_life_unit}` : null],
      ['D-value', source.d_value_tbq ? `${source.d_value_tbq} TBq` : null],
      ['Original activity', source.original_activity ? `${source.original_activity} ${source.original_activity_unit}` : null],
      ['Original activity date', formatDate(source.original_activity_date)],
      ['Current activity', source.current_activity ? `${source.current_activity} ${source.current_activity_unit}` : null],
      ['Current activity date', formatDate(source.current_activity_date)],
      ['Physical form', source.source_physical_form],
      ['Dimensions', source.source_length && source.source_diameter ? `${source.source_length} × ${source.source_diameter} cm` : null],
      ['Mass', source.source_mass ? `${source.source_mass} g` : null],
    ]},
    { title: 'Manufacturer', items: [
      ['Manufacturer', source.manufacturer],
      ['Country', source.manufacturer_country],
      ['Certificate no.', source.source_certificate_no, 'mono'],
    ]},
    { title: 'Ownership & usage', items: [
      ['Original owner', source.original_owner_name],
      ['Date licensed', formatDate(source.date_licensed)],
      ['Original application', source.original_application],
      ['Current owner', source.current_owner_name],
      ['Date transferred', formatDate(source.date_transferred)],
      ['Current application', source.current_application],
      ['Reason for transfer', source.reason_for_transfer],
      ['Transfer authorization', source.transfer_authorization],
      ['Transporter', source.transporter],
    ]},
    { title: 'Location & control', items: [
      ['Storage facility unit', source.storage_facility_unit],
      ['Storage cage address', source.storage_cage_address],
      ['Date placed in cage', formatDate(source.date_placed_in_cage)],
      ['Responsible officer', source.responsible_officer],
      ['Date last verified', formatDate(source.date_last_verified)],
    ]},
    { title: 'Radiation & integrity', items: [
      ['Radiation type', source.radiation_type],
      ['Dose rate @ 1 m', source.dose_rate_at_1m ? `${source.dose_rate_at_1m} mSv/h` : null],
      ['Dose rate on surface', source.dose_rate_on_surface ? `${source.dose_rate_on_surface} mSv/h` : null],
      ['Background radiation', source.background_radiation ? `${source.background_radiation} mSv/h` : null],
      ['Measurement date', formatDate(source.measurement_date)],
      ['Instrument used', source.instrument_used],
      ['Instrument calib. due', formatDate(source.instrument_calibration_due_date)],
      ['Source integrity', source.source_integrity],
      ['Contamination status', source.contamination_status],
      ['Visual inspection', source.visual_inspection_result],
      ['Leak test result', source.leak_test_result],
      ['Leak test date', formatDate(source.leak_test_date)],
      ['Leak test instrument', source.leak_test_instrument_used],
    ]},
    { title: 'Endpoint management', items: [
      ['Conditioning status', source.conditioning_status],
      ['Conditioning date', formatDate(source.conditioning_date)],
      ['Capsule no./ID', source.capsule_no_id],
      ['Capsule height', source.capsule_height_mm ? `${source.capsule_height_mm} mm` : null],
      ['Capsule ext. diameter', source.capsule_external_diameter ? `${source.capsule_external_diameter} mm` : null],
      ['Concrete drum / waste pkg', source.concrete_drum_no],
      ['Borehole disposal intention', source.borehole_disposal_intention ? 'Yes' : 'No'],
    ]},
  ];
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.title} className="card overflow-hidden">
          <header className="card-header">
            <h3 className="font-semibold text-sm text-slate-800">{g.title}</h3>
          </header>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 p-5">
            {g.items.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value, mono], i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50">
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className={`text-sm font-medium text-slate-800 text-right ${mono ? 'font-mono' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function Measurements({ source }) {
  const items = source.measurements || [];
  return (
    <section className="card overflow-hidden">
      <header className="card-header">
        <div className="flex items-center gap-2">
          <FiActivity size={15} className="text-brand-600" />
          <h3 className="font-semibold text-sm text-slate-800">Measurements</h3>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 p-5">None recorded</p>
      ) : (
        <div className="p-4 space-y-3">
          {items.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
              <div>
                <p className="text-slate-600">{formatDate(m.measurement_date)}</p>
                <p className="text-[11px] text-slate-400">{m.instrument_used || '—'}</p>
              </div>
              <p className="font-mono font-semibold text-slate-800">{m.dose_rate_at_1m} mSv/h @1m</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LeakTests({ source }) {
  const items = source.leak_tests || [];
  return (
    <section className="card overflow-hidden">
      <header className="card-header">
        <div className="flex items-center gap-2">
          <FiShield size={15} className="text-brand-600" />
          <h3 className="font-semibold text-sm text-slate-800">Leak tests</h3>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 p-5">None recorded</p>
      ) : (
        <div className="p-4 space-y-3">
          {items.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
              <div>
                <p className="text-slate-600">{formatDate(t.leak_test_date)}</p>
                <p className="text-[11px] text-slate-400">{t.leak_test_method || t.instrument_used || '—'}</p>
              </div>
              <span className={`badge ${t.leak_test_result === 'pass' ? 'badge-green' : t.leak_test_result === 'fail' ? 'badge-red' : 'badge-slate'}`}>
                {t.leak_test_result}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}