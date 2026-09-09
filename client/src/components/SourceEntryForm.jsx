import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiSave, FiHash, FiCrosshair, FiTool, FiUsers, FiMapPin,
  FiActivity, FiLock, FiCamera, FiX, FiChevronDown,
} from 'react-icons/fi';
import api from '../services/api';
import { toTbq, classifySource, categoryBadge, decayActivity } from '../utils/unitConversion';

const RADIONUCLIDE_UNITS = ['TBq', 'GBq', 'MBq', 'kBq', 'Bq', 'Ci', 'mCi', 'uCi'];
const HALF_LIFE_UNITS = ['s', 'min', 'h', 'd', 'yr'];

export default function SourceEntryForm({ editId, onSaved, onCancel }) {
  const isEdit = Boolean(editId);
  const [dValues, setDValues] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [category, setCategory] = useState(null);
  const [ratio, setRatio] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(isEdit ? 7 : 0);
  const [activityOverride, setActivityOverride] = useState(isEdit);
  const dValuesRef = useRef([]);
  const formRef = useRef(null);

  const [form, setForm] = useState({
    device_serial_no: '', source_serial_no: '', nra_registration_no: '', source_barcode: '', no_on_source: '',
    radionuclide_id: '', half_life_value: '', half_life_unit: 'yr',
    original_activity: '', original_activity_unit: 'GBq', original_activity_date: '',
    current_activity: '', current_activity_unit: 'GBq', current_activity_date: '',
    source_physical_form: 'sealed', source_length: '', source_diameter: '', source_mass: '',
    manufacturer: '', manufacturer_country: '', source_certificate_no: '',
    original_owner: '', date_licensed: '', original_application: '',
    current_owner: '', date_transferred: '', current_application: '',
    reason_for_transfer: '', transfer_authorization: '', transporter: '',
    storage_facility_unit: '', storage_cage_address: '', date_placed_in_cage: '',
    responsible_officer: '', date_last_verified: '',
    radiation_type: 'gamma', dose_rate_at_1m: '', dose_rate_on_surface: '',
    background_radiation: '', measurement_date: '', instrument_used: '', instrument_calibration_due_date: '',
    source_integrity: 'intact', contamination_status: 'clean', visual_inspection_result: '',
    leak_test_method: '', leak_test_result: 'pending', leak_test_date: '',
    leak_test_instrument_used: '', leak_test_instrument_calibration_due_date: '',
    return_to_supplier: false, reuse: false,
    conditioning_status: 'none', conditioning_date: '', capsule_no_id: '',
    capsule_height_mm: '', capsule_external_diameter: '', concrete_drum_no: '',
    borehole_disposal_intention: false,
  });

  useEffect(() => { dValuesRef.current = dValues; }, [dValues]);
  useEffect(() => { if (formRef.current) formRef.current = form; }, [form]);

  useEffect(() => {
    api.get('/sources/d-values')
      .then(({ data }) => {
        setDValues(data);
        if (isEdit && formRef.current) computeCategory(formRef.current, data);
      })
      .catch(() => {});
    api.get('/institutions').then(({ data }) => setInstitutions(data)).catch(() => {});
    if (isEdit) {
      api.get(`/sources/${editId}`).then(({ data }) => {
        const { history, measurements, leak_tests, radionuclide, d_value_tbq, photos, original_owner_name, current_owner_name, original_owner_id, current_owner_id, ...clean } = data;
        const mapped = { ...clean, original_owner: original_owner_name || '', current_owner: current_owner_name || '' };
        setForm({ ...mapped });
        formRef.current = mapped;
        setExistingPhotos(photos || []);
        setActivityOverride(true);
        computeCategory(mapped, dValuesRef.current);
      }).catch(() => toast.error('Could not load source for editing'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, isEdit]);

  const computeCategory = (next, dv) => {
    const dValue = dv.find((d) => d.id === Number(next.radionuclide_id));
    const tbq = toTbq(next.current_activity, next.current_activity_unit);
    const d = dValue?.d_value_tbq;
    if (tbq && d) {
      setCategory(classifySource(tbq, d));
      setRatio((tbq / d).toFixed(2));
    } else {
      setCategory(null);
      setRatio(null);
    }
  };

  const set = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (['current_activity', 'current_activity_unit', 'radionuclide_id'].includes(key)) {
      computeCategory(next, dValues);
    }
    if (['current_activity', 'current_activity_unit', 'current_activity_date'].includes(key)) {
      setActivityOverride(true);
    }
  };

  // Decay formula: original activity + activity date + half-life -> current activity
  const decayPreview = useMemo(() => {
    if (!form.original_activity || !form.original_activity_date) return null;
    const dv = dValues.find((d) => d.id === Number(form.radionuclide_id));
    const hlVal = form.half_life_value || dv?.half_life_value;
    const hlUnit = form.half_life_unit || dv?.half_life_unit;
    if (!hlVal) return null;
    const target = decayActivity(form.original_activity, form.original_activity_date, hlVal, hlUnit);
    if (target == null || target <= 0) return null;
    return { value: target, hl: `${hlVal} ${hlUnit}`, hlAuto: !form.half_life_value };
  }, [form.original_activity, form.original_activity_date, form.half_life_value, form.half_life_unit, form.radionuclide_id, form.original_activity_unit, dValues]);

  // Auto-apply decay to Current Activity as the user enters original activity/date/half-life.
  // Stops as soon as the user edits current activity fields by hand (manual override wins).
  useEffect(() => {
    if (!decayPreview || activityOverride) return;
    const unit = form.original_activity_unit;
    const next = {
      ...form,
      current_activity: trimNum(decayPreview.value),
      current_activity_unit: unit,
      current_activity_date: new Date().toISOString().slice(0, 10),
    };
    setForm(next);
    computeCategory(next, dValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decayPreview, activityOverride, form.original_activity_unit]);

  const applyDecay = () => {
    if (!decayPreview) return;
    setActivityOverride(false);
    const next = {
      ...form,
      current_activity: trimNum(decayPreview.value),
      current_activity_unit: form.original_activity_unit,
      current_activity_date: new Date().toISOString().slice(0, 10),
    };
    setForm(next);
    computeCategory(next, dValues);
    toast.success('Current activity set from radioactive decay');
  };

  const toggle = (s) => setOpen(open === s ? -1 : s);

  const removeExistingPhoto = async (photoId) => {
    try {
      await api.delete(`/sources/${editId}/photos/${photoId}`);
      setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success('Photo removed');
    } catch {
      toast.error('Could not remove photo');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        radionuclide_id: Number(form.radionuclide_id) || undefined,
        original_owner_name: form.original_owner.trim() || null,
        current_owner_name: form.current_owner.trim() || null,
        return_to_supplier: form.return_to_supplier ? 1 : 0,
        reuse: form.reuse ? 1 : 0,
        borehole_disposal_intention: form.borehole_disposal_intention ? 1 : 0,
      };
      delete payload.original_owner;
      delete payload.current_owner;
      delete payload.original_owner_id;
      delete payload.current_owner_id;
      delete payload.photo_path;

      let createdId = editId;
      if (isEdit) {
        await api.put(`/sources/${editId}`, payload);
        toast.success('Source updated');
      } else {
        const { data } = await api.post('/sources', payload);
        createdId = data.id;
        toast.success('Source registered');
      }
      if (photo) {
        const fd = new FormData();
        fd.append('photo', photo);
        await api.post(`/sources/${createdId}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Photo uploaded');
      }
      if (photos.length) {
        const fd = new FormData();
        photos.forEach((p) => fd.append('photos', p));
        await api.post(`/sources/${createdId}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Additional photos uploaded');
      }
      onSaved?.(createdId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { n: '01', title: 'Unique Identifiers', icon: FiHash, subtitle: 'All registry tracking numbers', body: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Device Serial No." value={form.device_serial_no} onChange={(v) => set('device_serial_no', v)} />
        <Field label="Source Serial No." value={form.source_serial_no} onChange={(v) => set('source_serial_no', v)} />
        <Field label="NRA Registration No." value={form.nra_registration_no} onChange={(v) => set('nra_registration_no', v)} />
        <Field label="Source Barcode" value={form.source_barcode} onChange={(v) => set('source_barcode', v)} />
        <Field label="No. on the Source" value={form.no_on_source} onChange={(v) => set('no_on_source', v)} />
      </div>
    ) },
    { n: '02', title: 'Radionuclide', icon: FiCrosshair, subtitle: 'Identification, half-life, activity & physical form', body: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3">
          <label className="field-label">Radionuclide *</label>
          <select value={form.radionuclide_id} onChange={(e) => {
            const dv = dValues.find((d) => d.id === Number(e.target.value));
            if (dv && !form.half_life_value) {
              setForm((prev) => ({ ...prev, radionuclide_id: e.target.value, half_life_value: dv.half_life_value, half_life_unit: hlUnitFor(dv.half_life_unit) }));
              computeCategory({ ...form, radionuclide_id: e.target.value, half_life_value: dv.half_life_value }, dValues);
            } else {
              set('radionuclide_id', e.target.value);
            }
          }} className="input" required>
            <option value="">Select radionuclide…</option>
            {dValues.map((d) => (
              <option key={d.id} value={d.id}>{d.radionuclide} — D = {d.d_value_tbq} TBq</option>
            ))}
          </select>
        </div>
        <PairField label="Half-life" value={form.half_life_value} onChange={(v) => set('half_life_value', v)}
          unitValue={form.half_life_unit} onUnitChange={(v) => set('half_life_unit', v)} units={HALF_LIFE_UNITS} />
        <PairField label="Original Activity" value={form.original_activity} onChange={(v) => set('original_activity', v)}
          unitValue={form.original_activity_unit} onUnitChange={(v) => set('original_activity_unit', v)} units={RADIONUCLIDE_UNITS} />
        <Field label="Original Activity Date" type="date" value={form.original_activity_date} onChange={(v) => set('original_activity_date', v)} />
        <PairField label="Current Activity" value={form.current_activity} onChange={(v) => set('current_activity', v)}
          unitValue={form.current_activity_unit} onUnitChange={(v) => set('current_activity_unit', v)} units={RADIONUCLIDE_UNITS} />
        <Field label="Current Activity Date" type="date" value={form.current_activity_date} onChange={(v) => set('current_activity_date', v)} />
        <div className="md:col-span-3">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 flex flex-wrap items-center gap-3">
            <FiActivity size={16} className="text-brand-600 shrink-0" />
            <div className="flex-1 min-w-[220px]">
              {decayPreview ? (
                <p className="text-xs text-slate-600">
                  Decay from <b>{form.original_activity} {form.original_activity_unit}</b> on <b>{form.original_activity_date}</b>
                  {' '}(T½ {decayPreview.hl}) → <b className="text-brand-700">≈ {trimNum(decayPreview.value)} {form.original_activity_unit}</b> today.
                  {decayPreview.hlAuto && ' Half-life taken from the reference table.'}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Enter original activity, activity date and half-life to auto-compute the current activity (radioactive decay).</p>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5">Current activity is calculated automatically from decay — edit it by hand at any time. Current activity &amp; D-value set the IAEA source category (A/D ratio) in the header.</p>
            </div>
            <button type="button" onClick={applyDecay} disabled={!decayPreview} className="btn-secondary !py-1.5 text-xs shrink-0">
              Re-calc →
            </button>
          </div>
        </div>
        <div>
          <label className="field-label">Physical Form</label>
          <select value={form.source_physical_form} onChange={(e) => set('source_physical_form', e.target.value)} className="input">
            {['sealed', 'unsealed', 'solid', 'liquid', 'gas'].map((t) => (
              <option key={t} value={t}>{t[0].toUpperCase()}{t.slice(1)}</option>
            ))}
          </select>
        </div>
        <Field label="Length (cm)" value={form.source_length} onChange={(v) => set('source_length', v)} />
        <Field label="Diameter (cm)" value={form.source_diameter} onChange={(v) => set('source_diameter', v)} />
        <Field label="Mass (g)" value={form.source_mass} onChange={(v) => set('source_mass', v)} />
      </div>
    ) },
    { n: '03', title: 'Manufacturer', icon: FiTool, subtitle: 'Origin and certificate of the source', body: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Manufacturer" value={form.manufacturer} onChange={(v) => set('manufacturer', v)} />
        <Field label="Country of Manufacture" value={form.manufacturer_country} onChange={(v) => set('manufacturer_country', v)} />
        <Field label="Source Certificate No." value={form.source_certificate_no} onChange={(v) => set('source_certificate_no', v)} />
      </div>
    ) },
    { n: '04', title: 'Ownership & Usage', icon: FiUsers, subtitle: 'Licence, owners, applications and transfers', body: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OwnerInput label="Original Owner" value={form.original_owner} options={institutions} onChange={(v) => set('original_owner', v)} />
        <Field label="Date Licensed" type="date" value={form.date_licensed} onChange={(v) => set('date_licensed', v)} />
        <Field label="Original Application" value={form.original_application} onChange={(v) => set('original_application', v)} />
        <OwnerInput label="Current Owner" value={form.current_owner} options={institutions} onChange={(v) => set('current_owner', v)} />
        <Field label="Date Transferred" type="date" value={form.date_transferred} onChange={(v) => set('date_transferred', v)} />
        <Field label="Current Application" value={form.current_application} onChange={(v) => set('current_application', v)} />
        <div>
          <label className="field-label">Reason for Transfer</label>
          <select value={form.reason_for_transfer} onChange={(e) => set('reason_for_transfer', e.target.value)} className="input">
            <option value="">Select reason…</option>
            {['Temporary storage', 'Permanent storage', 'Reuse', 'Recycling'].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <Field label="Transfer Authorization" value={form.transfer_authorization} onChange={(v) => set('transfer_authorization', v)} />
        <Field label="Transporter" value={form.transporter} onChange={(v) => set('transporter', v)} />
      </div>
    ) },
    { n: '05', title: 'Physical Location & Control', icon: FiMapPin, subtitle: 'Storage, custody and verification', body: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Storage Facility Unit" value={form.storage_facility_unit} onChange={(v) => set('storage_facility_unit', v)} />
        <Field label="Storage Cage Address" value={form.storage_cage_address} onChange={(v) => set('storage_cage_address', v)} />
        <Field label="Date Placed in Cage" type="date" value={form.date_placed_in_cage} onChange={(v) => set('date_placed_in_cage', v)} />
        <Field label="Responsible Officer" value={form.responsible_officer} onChange={(v) => set('responsible_officer', v)} />
        <Field label="Date Last Verified" type="date" value={form.date_last_verified} onChange={(v) => set('date_last_verified', v)} />
      </div>
    ) },
    { n: '06', title: 'Radiological Characterization', icon: FiActivity, subtitle: 'Dose rates, measurements, integrity & leak tests', body: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="field-label">Radiation Type</label>
          <select value={form.radiation_type} onChange={(e) => set('radiation_type', e.target.value)} className="input">
            {['alpha', 'beta', 'gamma', 'neutron', 'xray'].map((t) => (
              <option key={t} value={t}>{t[0].toUpperCase()}{t.slice(1)}</option>
            ))}
          </select>
        </div>
        <Field label="Dose Rate at 1m (mSv/h)" value={form.dose_rate_at_1m} onChange={(v) => set('dose_rate_at_1m', v)} />
        <Field label="Dose Rate on Surface (mSv/h)" value={form.dose_rate_on_surface} onChange={(v) => set('dose_rate_on_surface', v)} />
        <Field label="Background Radiation (mSv/h)" value={form.background_radiation} onChange={(v) => set('background_radiation', v)} />
        <Field label="Measurement Date" type="date" value={form.measurement_date} onChange={(v) => set('measurement_date', v)} />
        <Field label="Instrument Used" value={form.instrument_used} onChange={(v) => set('instrument_used', v)} />
        <Field label="Instrument Calibration Due" type="date" value={form.instrument_calibration_due_date} onChange={(v) => set('instrument_calibration_due_date', v)} />
        <div>
          <label className="field-label">Source Integrity</label>
          <select value={form.source_integrity} onChange={(e) => set('source_integrity', e.target.value)} className="input">
            <option value="intact">Intact</option><option value="damaged">Damaged</option><option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label className="field-label">Contamination Status</label>
          <select value={form.contamination_status} onChange={(e) => set('contamination_status', e.target.value)} className="input">
            <option value="clean">Clean</option><option value="contaminated">Contaminated</option><option value="unknown">Unknown</option>
          </select>
        </div>
        <Field label="Visual Inspection Result" value={form.visual_inspection_result} onChange={(v) => set('visual_inspection_result', v)} />
        <div>
          <label className="field-label">Leak Test Result</label>
          <select value={form.leak_test_result} onChange={(e) => set('leak_test_result', e.target.value)} className="input">
            <option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option>
          </select>
        </div>
        <Field label="Leak Test Instrument Calibration Due" type="date" value={form.leak_test_instrument_calibration_due_date} onChange={(v) => set('leak_test_instrument_calibration_due_date', v)} />
        <Field label="Leak Test Method" value={form.leak_test_method} onChange={(v) => set('leak_test_method', v)} />
        <Field label="Leak Test Date" type="date" value={form.leak_test_date} onChange={(v) => set('leak_test_date', v)} />
        <Field label="Leak Test Instrument Used" value={form.leak_test_instrument_used} onChange={(v) => set('leak_test_instrument_used', v)} />
      </div>
    ) },
    { n: '07', title: 'Endpoint Management', icon: FiLock, subtitle: 'Conditioning, capsules and disposal', body: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="field-label">Conditioning Status</label>
          <select value={form.conditioning_status} onChange={(e) => set('conditioning_status', e.target.value)} className="input">
            <option value="none">None</option><option value="conditioned">Conditioned</option><option value="disposed">Disposed</option>
          </select>
        </div>
        <Field label="Conditioning Date" type="date" value={form.conditioning_date} onChange={(v) => set('conditioning_date', v)} />
        <Field label="Capsule No./ID" value={form.capsule_no_id} onChange={(v) => set('capsule_no_id', v)} />
        <Field label="Capsule Height (mm)" value={form.capsule_height_mm} onChange={(v) => set('capsule_height_mm', v)} />
        <Field label="Capsule Ext. Diameter (mm)" value={form.capsule_external_diameter} onChange={(v) => set('capsule_external_diameter', v)} />
        <Field label="Concrete Drum / Waste Pkg No." value={form.concrete_drum_no} onChange={(v) => set('concrete_drum_no', v)} />
        <div className="flex gap-6 items-end h-[42px]">
          <Checkbox label="Return to Supplier" checked={form.return_to_supplier} onChange={(v) => set('return_to_supplier', v)} />
          <Checkbox label="Reuse" checked={form.reuse} onChange={(v) => set('reuse', v)} />
        </div>
        <div className="flex items-end h-[42px]">
          <Checkbox label="Borehole Disposal Intention" checked={form.borehole_disposal_intention} onChange={(v) => set('borehole_disposal_intention', v)} />
        </div>
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h2 className="font-semibold text-sm text-slate-800">{isEdit ? `Edit source ${form.source_serial_no || `#${editId}`}` : 'New source entry'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{isEdit ? 'Update the record below' : 'Complete the numbered sections to register a source'}</p>
          </div>
          {category && (
            <div className="text-right">
              <span className={`${categoryBadge(category)} !text-sm !px-3 !py-1`}>Category {category}</span>
              {ratio && <p className="text-[11px] text-slate-400 mt-1">A/D ratio {ratio} (auto)</p>}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {sections.map(({ n, title, icon: Icon, subtitle, body }) => {
          const isOpen = open === Number(n);
          return (
            <section key={n} className="card overflow-hidden">
              <button type="button" onClick={() => toggle(Number(n))} className="w-full card-header hover:bg-slate-50 transition-colors cursor-pointer text-left">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-mono text-[11px] font-bold">{n}</span>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                      <Icon size={15} className="text-brand-600" /> {title}
                    </h3>
                    <p className="text-xs text-slate-400">{subtitle}</p>
                  </div>
                </div>
                <FiChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && <div className="p-5">{body}</div>}
            </section>
          );
        })}

        {/* Photo(s) */}
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FiCamera className="text-brand-600" size={16} />
            <h3 className="font-semibold text-sm text-slate-800">Device / Source photo(s)</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
              {photo || form.photo_path ? (
                <img src={photo ? URL.createObjectURL(photo) : `/uploads/${form.photo_path}`} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-slate-400 text-xs">No photo</span>
              )}
            </div>
            <div className="space-y-2">
              <label className="btn-secondary cursor-pointer">
                {photo ? 'Replace primary photo' : 'Upload primary photo'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files[0] || null)} />
              </label>
              <label className="btn-ghost !px-3 !py-1.5 text-xs cursor-pointer w-full text-center">
                Add more photos…
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotos((prev) => [...prev, ...Array.from(e.target.files || [])])} />
              </label>
              {photo && (
                <button type="button" onClick={() => setPhoto(null)} className="btn-ghost !px-3 !py-1.5 text-xs w-full">
                  <FiX size={13} /> Clear primary
                </button>
              )}
              {isEdit && form.photo_path && !photo && (
                <p className="text-[11px] text-slate-400">Current primary photo shown. Select a file to replace it.</p>
              )}
            </div>
          </div>
          {(existingPhotos.length > 0 || photos.length > 0) && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-400 mb-2">Additional photos ({existingPhotos.length + photos.length}) — hover to remove</p>
              <div className="flex flex-wrap gap-2">
                {existingPhotos.map((p) => (
                  <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                    <img src={`/uploads/${p.photo_path}`} alt="source" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeExistingPhoto(p.id)} title="Remove photo"
                      className="absolute top-0 right-0 bg-rose-600 text-white p-0.5 opacity-0 group-hover:opacity-100 rounded-bl">
                      <FiX size={12} />
                    </button>
                  </div>
                ))}
                {photos.map((p, i) => (
                  <div key={`new-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                    <img src={URL.createObjectURL(p)} alt="source" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} title="Remove photo"
                      className="absolute top-0 right-0 bg-rose-600 text-white p-0.5 opacity-0 group-hover:opacity-100 rounded-bl">
                      <FiX size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary !px-8 !py-3">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            <FiSave size={16} />
            {isEdit ? 'Update Source' : 'Register Source'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary !px-8 !py-3">Cancel</button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type={type}
        step={type === 'date' ? undefined : 'any'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </div>
  );
}

function hlUnitFor(unit) {
  const map = { years: 'yr', days: 'd', hours: 'h', minutes: 'min', months: 'mo' };
  return map[String(unit).toLowerCase()] || unit || 'yr';
}

function trimNum(v) {
  if (v == null || !Number.isFinite(Number(v))) return '';
  const n = Number(v);
  if (n === 0) return '0';
  const mag = Math.abs(n);
  if (mag >= 1e6 || mag < 0.01) return n.toExponential(3);
  return String(Math.round(n * 1e8) / 1e8);
}

function PairField({ label, value, onChange, unitValue, onUnitChange, units }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex gap-2">
        <input type="number" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input" />
        <select value={unitValue} onChange={(e) => onUnitChange(e.target.value)} className="input !w-auto !shrink-0">
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  );
}

function OwnerInput({ label, value, options, onChange }) {
  const listId = `owner-list-${label.replace(/\W+/g, '')}`;
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        list={listId}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        placeholder="Type owner / institution…"
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o.id} value={o.name} />)}
      </datalist>
      <p className="text-[11px] text-slate-400 mt-1">Not in the list? The institution is created automatically when you save.</p>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}