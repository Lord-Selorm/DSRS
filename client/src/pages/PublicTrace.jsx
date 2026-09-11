import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiPrinter, FiCamera, FiShield, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { categoryBadge, categoryLabel, formatDate } from '../utils/unitConversion';

export default function PublicTrace() {
  const { id } = useParams();
  const [source, setSource] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [qr, setQr] = useState(null);
  const [barcode, setBarcode] = useState(null);

  useEffect(() => {
    setSource(null);
    setNotFound(false);
    fetch(`/api/public/sources/${id}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error('load failed');
        return r.json();
      })
      .then(setSource)
      .catch(() => setNotFound(true));
    fetch(`/api/public/sources/${id}/qrcode`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => b && setQr(URL.createObjectURL(b)))
      .catch(() => {});
    fetch(`/api/public/sources/${id}/barcode`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => b && setBarcode(URL.createObjectURL(b)))
      .catch(() => {});
  }, [id]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-sm">
          <FiAlertTriangle size={36} className="mx-auto mb-3 text-rose-500" />
          <h1 className="font-semibold text-slate-800">Source not found</h1>
          <p className="text-sm text-slate-500 mt-1">This code does not match a registered DSRS record.</p>
          <Link to="/login" className="btn-primary mt-4">Go to system</Link>
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  const statusChanges = (source.history || []).filter((h) => ['conditioning_status', 'source_integrity', 'storage_facility_unit', 'capsule_no_id', 'concrete_drum_no'].includes(h.field_changed));

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <header className="card overflow-hidden">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="micro-label text-rose-500 font-bold">DSRS TRACE</p>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                {source.source_serial_no || `#${source.id}`}
                <span className="ml-2 align-middle">{categoryBadge(source.source_classification)}{categoryLabel(source.source_classification)}</span>
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {source.radionuclide} · {source.device_serial_no || 'no device serial'} · registered {formatDate(source.created_at)}
              </p>
            </div>
            <button onClick={() => window.print()} className="btn-secondary"><FiPrinter size={15} /> Print</button>
          </div>

          {source.photo_path && (
            <img src={`/uploads/${source.photo_path}`} alt="Source" className="w-full h-48 object-cover border-t border-slate-100 mt-4" />
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <HeroItem label="End user" value={source.current_owner_name} />
            <HeroItem label="Facility / unit" value={source.storage_facility_unit} />
            <HeroItem label="Activity" value={source.current_activity ? `${source.current_activity} ${source.current_activity_unit}` : null} />
            <HeroItem label="D-value" value={source.d_value_tbq ? `${source.d_value_tbq} TBq` : null} />
            <HeroItem label="NRA reg no." value={source.nra_registration_no} mono />
            <HeroItem label="No. on source" value={source.no_on_source} mono />
            <HeroItem label="Source barcode" value={source.source_barcode} mono />
            <HeroItem label="Last verified" value={formatDate(source.date_last_verified)} />
          </div>

          <div className="flex items-center flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            {source.contamination_status === 'contaminated' && <span className="badge-rose">Contaminated</span>}
            {source.source_integrity === 'damaged' && <span className="badge-red">Damaged</span>}
            {source.borehole_disposal_intention ? <span className="badge-amber">Borehole intended</span> : null}
            {source.decay_storage ? <span className="badge-blue">Decay storage</span> : null}
            <span className="badge-teal">Conditioning: {source.conditioning_status}</span>
          </div>

          {(qr || barcode) && (
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100 bg-slate-50/60 rounded-lg p-3">
              {qr && <img src={qr} alt="QR" className="w-28 h-28 bg-white rounded-lg p-1" />}
              {barcode && <img src={barcode} alt="Barcode" className="w-40 bg-white rounded-lg p-1" />}
              <p className="text-[11px] text-slate-400 max-w-[140px]">Scanning this source's QR opens this public record.</p>
            </div>
          )}
        </header>

        {/* Lifecycle history */}
        <section className="card overflow-hidden">
          <header className="card-header">
            <div className="flex items-center gap-2">
              <FiClock size={16} className="text-brand-600" />
              <h2 className="font-semibold text-sm text-slate-800">Lifecycle history</h2>
            </div>
            <span className="text-xs text-slate-400">{statusChanges.length} milestone(s), {(source.history || []).length} audit event(s)</span>
          </header>
          {(source.history || []).length === 0 ? (
            <p className="text-sm text-slate-400 p-5">No recorded events.</p>
          ) : (
            <ol className="p-5 space-y-0">
              {(source.history || []).slice().reverse().map((h, i) => (
                <li key={h.id} className="relative pl-6 pb-4 border-l-2 border-slate-100 ml-2 last:pb-0">
                  <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                  <p className="text-xs text-slate-400">{formatDate(h.changed_at)} · by {h.changed_by_name || 'system'}</p>
                  <p className="text-sm text-slate-700">
                    <span className="capitalize font-medium">{h.change_type}</span>
                    {h.field_changed ? (
                      <>
                        {' '}— <span className="font-mono text-slate-400">{h.field_changed}</span>:
                        {h.previous_value ? <s className="text-slate-400 mx-1">{h.previous_value}</s> : null}
                        <span className="text-slate-800 font-medium">{h.new_value}</span>
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Status summary */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Status" value={source.conditioning_status} />
          <MiniStat label="Location" value={source.storage_facility_unit} />
          <MiniStat label="Capsule no." value={source.capsule_no_id} />
          <MiniStat label="Waste pkg no." value={source.concrete_drum_no} />
        </section>

        <DetailGroups source={source} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Measurements source={source} />
          <LeakTests source={source} />
        </div>

        <footer className="text-center text-xs text-slate-400 pb-6">
          Ghana DSRS Inventory System · public read-only record · <Link to="/login" className="underline">regulator login</Link>
        </footer>
      </div>
    </div>
  );
}

function HeroItem({ label, value, mono }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm font-semibold text-slate-800 truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 capitalize truncate">{value || '—'}</p>
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
      ['Decay storage', source.decay_storage ? 'Yes' : 'No'],
    ]},
  ];
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.title} className="card overflow-hidden">
          <header className="card-header">
            <div className="flex items-center gap-2">
              <FiShield size={15} className="text-brand-600" />
              <h3 className="font-semibold text-sm text-slate-800">{g.title}</h3>
            </div>
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
          <FiCamera size={15} className="text-brand-600" />
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