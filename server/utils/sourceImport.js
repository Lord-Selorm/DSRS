const XLSX = require('xlsx');
const pool = require('../config/db');
const Source = require('../models/Source');

// db field -> accepted header strings (normalized: lowercase, non-alnum stripped)
const FIELD_HEADERS = {
  device_serial_no: ['deviceserialno', 'deviceserial', 'serialnodevice'],
  source_serial_no: ['sourceserialno', 'sourceserial', 'serialnosource'],
  nra_registration_no: ['nraregistrationno', 'nraregno', 'registrationno', 'nrano'],
  source_barcode: ['sourcebarcode', 'barcode', 'barcodeno'],
  no_on_source: ['noon source', 'numberonsource', 'noon thesource'],
  original_activity: ['originalactivity'],
  original_activity_unit: ['originalactivityunit'],
  original_activity_date: ['originalactivitydate', 'activitydate'],
  current_activity: ['currentactivity'],
  current_activity_unit: ['currentactivityunit'],
  current_activity_date: ['currentactivitydate'],
  half_life_value: ['halflifevalue', 'halflife'],
  half_life_unit: ['halflifeunit', 'halflifeunits'],
  source_physical_form: ['physicalform', 'sourcephysicalform'],
  source_length: ['lengthcm', 'sourcelength'],
  source_diameter: ['diametercm', 'sourcediameter'],
  source_mass: ['massg', 'sourcemass'],
  manufacturer: ['manufacturer'],
  manufacturer_country: ['countryofmanufacture', 'manufacturercountry'],
  source_certificate_no: ['sourcecertificateno', 'certificateno'],
  original_owner: ['originalowner', 'supplier', 'importlicensee'],
  current_owner: ['currentowner', 'enduser', 'finalenduser', 'finalowner'],
  date_licensed: ['datelicensed', 'licencedate'],
  original_application: ['originalapplication', 'originalpractice', 'originaluse'],
  current_application: ['currentapplication', 'currentpractice', 'currentuse'],
  date_transferred: ['datetransferred', 'transferdate'],
  reason_for_transfer: ['reasonfortransfer'],
  transfer_authorization: ['transferauthorization'],
  transporter: ['transporter'],
  storage_facility_unit: ['storagefacilityunit', 'storageunit', 'facilityunit', 'storagelocation'],
  storage_cage_address: ['storagecageaddress', 'cageaddress'],
  date_placed_in_cage: ['dateplacedincage', 'placedincagedate'],
  responsible_officer: ['responsibleofficer', 'custodian'],
  date_last_verified: ['datelastverified', 'lastverified', 'verifieddate'],
  radiation_type: ['radiationtype', 'typeofradiation'],
  dose_rate_at_1m: ['doserateat1m', 'doserate1m'],
  dose_rate_on_surface: ['doserateonsurface', 'surfacedoserate'],
  background_radiation: ['backgroundradiation', 'backgrounddoserate'],
  measurement_date: ['measurementdate', 'dosedate'],
  instrument_used: ['instrumentused'],
  instrument_calibration_due_date: ['instrumentcalibrationduedate', 'instrumentcalibrationdue'],
  source_integrity: ['sourceintegrity', 'integrity'],
  contamination_status: ['contaminationstatus', 'contamination'],
  visual_inspection_result: ['visualinspectionresult', 'visualinspection'],
  leak_test_method: ['leaktestmethod'],
  leak_test_result: ['leaktestresult', 'leaktest'],
  leak_test_date: ['leaktestdate', 'dateleaktest'],
  leak_test_instrument_used: ['leaktestinstrumentused', 'leaktestinstrument'],
  leak_test_instrument_calibration_due_date: ['leaktestinstrumentcalibrationdue'],
  conditioning_status: ['conditioningstatus'],
  conditioning_date: ['conditioningdate', 'dateconditioned'],
  capsule_no_id: ['capsuleno', 'capsuleid', 'capsule', 'capsuleidentifier'],
  capsule_height_mm: ['capsuleheightmm', 'capsuleheight'],
  capsule_external_diameter: ['capsuleexternaldiameter', 'capsuleextdiameter'],
  concrete_drum_no: ['concretedrumno', 'concretedrum', 'drumno', 'wastepkgno'],
  borehole_disposal_intention: ['boreholedisposalintention', 'boreholeintention'],
  return_to_supplier: ['returntosupplier'],
  reuse: ['reuse'],
};

const DATE_FIELDS = [
  'original_activity_date', 'current_activity_date', 'date_licensed', 'date_transferred',
  'date_placed_in_cage', 'date_last_verified', 'measurement_date', 'instrument_calibration_due_date',
  'leak_test_date', 'leak_test_instrument_calibration_due_date', 'conditioning_date',
];

function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchField(header) {
  const norm = normalizeHeader(header);
  for (const [field, list] of Object.entries(FIELD_HEADERS)) {
    if (list.includes(norm)) return field;
  }
  if (/serial/.test(norm) && /dev/.test(norm)) return 'device_serial_no';
  if (/serial/.test(norm) && /source/.test(norm)) return 'source_serial_no';
  if (/radionuclide|nuclide|isotope/.test(norm)) return 'radionuclide';
  if (/owner/.test(norm)) {
    if (/original|import|supplier|previous/.test(norm)) return 'original_owner';
    return 'current_owner';
  }
  return null;
}

function coerceDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const parts = s.split(/[/.-]/);
  if (parts.length === 3) {
    let [d, mo, y] = parts.map((p) => parseInt(p, 10));
    if (y > 1000) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (d > 1900) { [y, mo, d] = [d, y, mo]; return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  }
  return null;
}

function coerceBool(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return /^(yes|true|y|1|yeah)$/i.test(String(value).trim()) ? 1 : 0;
}

function trimCell(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value.trim() : value;
}

async function importSources(buffer, ext, userId) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('The file has no sheets');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

  if (rows.length === 0) throw new Error('No data rows found (header row required)');

  // Map headers -> fields
  const headers = Object.keys(rows[0] || {});
  const mapped = {};
  headers.forEach((h) => {
    const field = matchField(h);
    if (field) mapped[h] = field;
  });
  const unmapped = headers.filter((h) => !matchField(h));

  const [dValueRows] = await pool.query('SELECT id, radionuclide, d_value_tbq FROM d_values');
  const dValues = dValueRows.map((d) => ({ ...d, radionuclide: String(d.radionuclide).toLowerCase() }));

  const errors = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNo = i + 2;
    const payload = {};

    for (const [header, field] of Object.entries(mapped)) {
      const v = raw[header];
      if (v === null || v === undefined || String(v).trim() === '') continue;
      if (DATE_FIELDS.includes(field)) {
        payload[field] = coerceDate(v);
      } else if (['borehole_disposal_intention', 'return_to_supplier', 'reuse'].includes(field)) {
        payload[field] = coerceBool(v);
      } else {
        payload[field] = trimCell(v);
      }
    }

    const radionuclide = String(payload.radionuclide || '').trim().toLowerCase();
    if (!radionuclide) {
      errors.push({ row: rowNo, reason: 'missing radionuclide' });
      continue;
    }
    const dv = dValues.find((d) => d.radionuclide === radionuclide);
    if (!dv) {
      errors.push({ row: rowNo, reason: `unknown radionuclide "${payload.radionuclide}"` });
      continue;
    }
    payload.radionuclide_id = dv.id;
    delete payload.radionuclide;

    if (payload.current_activity === null || payload.current_activity === undefined || payload.current_activity === '') {
      errors.push({ row: rowNo, reason: 'missing current activity' });
      continue;
    }
    if (!payload.current_activity_unit) payload.current_activity_unit = 'GBq';
    if (!payload.original_activity_unit) payload.original_activity_unit = payload.current_activity_unit;

    try {
      await Source.create(payload, userId);
      created += 1;
    } catch (err) {
      errors.push({ row: rowNo, reason: err.message });
    }
  }

  return {
    created,
    skipped: rows.length - created,
    errors,
    unmappedHeaders: unmapped,
    mappedHeaders: Object.keys(mapped),
  };
}

module.exports = { importSources, matchField };