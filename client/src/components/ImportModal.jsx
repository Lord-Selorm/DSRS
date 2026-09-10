import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { FiUpload, FiDownload, FiFileText, FiX, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import api from '../services/api';

const TEMPLATE_HEADERS = [
  'Device Serial No.', 'Source Serial No.', 'NRA Registration No.', 'Source Barcode', 'No. on Source',
  'Radionuclide', 'Half-life Value', 'Half-life Unit', 'Original Activity', 'Original Activity Unit',
  'Original Activity Date', 'Current Activity', 'Current Activity Unit', 'Current Activity Date',
  'Physical Form', 'Length (cm)', 'Diameter (cm)', 'Mass (g)', 'Manufacturer', 'Country of Manufacture',
  'Source Certificate No.', 'Original Owner', 'Date Licensed', 'Original Application', 'Current Owner',
  'Date Transferred', 'Current Application', 'Reason for Transfer', 'Transfer Authorization', 'Transporter',
  'Storage Facility Unit', 'Storage Cage Address', 'Date Placed in Cage', 'Responsible Officer',
  'Date Last Verified', 'Radiation Type', 'Dose Rate at 1m (mSv/h)', 'Dose Rate on Surface (mSv/h)',
  'Background (mSv/h)', 'Measurement Date', 'Instrument Used', 'Instrument Calibration Due',
  'Source Integrity', 'Contamination Status', 'Visual Inspection Result', 'Leak Test Method',
  'Leak Test Result', 'Leak Test Date', 'Leak Test Instrument Used',
  'Leak Test Instrument Calibration Due', 'Conditioning Status', 'Conditioning Date', 'Capsule No./ID',
  'Capsule Height (mm)', 'Capsule Ext. Diameter (mm)', 'Concrete Drum / Waste Pkg No.',
  'Borehole Disposal Intention', 'Return to Supplier', 'Reuse',
];

const EXAMPLE_ROW = {
  'Device Serial No.': 'GH-BX-0001',
  'Source Serial No.': 'SRC-AM-001',
  'NRA Registration No.': 'NRA/2024/001',
  'Source Barcode': 'AM241-0001',
  'No. on Source': '1',
  Radionuclide: 'Am-241',
  'Half-life Value': '432.2',
  'Half-life Unit': 'yr',
  'Original Activity': '111',
  'Original Activity Unit': 'GBq',
  'Original Activity Date': '2018-06-15',
  'Current Activity': '80',
  'Current Activity Unit': 'GBq',
  'Current Activity Date': '2026-09-01',
  'Physical Form': 'sealed',
  'Length (cm)': '8',
  'Diameter (cm)': '2.5',
  'Mass (g)': '1500',
  Manufacturer: 'Eckert & Ziegler',
  'Country of Manufacture': 'Germany',
  'Source Certificate No.': 'Cert-1234',
  'Original Owner': 'Radiation Protection Institute',
  'Date Licensed': '2018-07-01',
  'Original Application': 'medical',
  'Current Owner': 'Korle Bu Teaching Hospital',
  'Current Application': 'medical',
  'Storage Facility Unit': 'Bunker B',
  'Date Last Verified': '2026-08-20',
  'Radiation Type': 'gamma',
  'Source Integrity': 'intact',
  'Contamination Status': 'clean',
  'Leak Test Result': 'pending',
  'Conditioning Status': 'none',
  'Borehole Disposal Intention': 'no',
};

export default function ImportModal({ open, onClose, onImported }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | uploading | done | error
  const [result, setResult] = useState(null);

  if (!open) return null;

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([EXAMPLE_ROW], { header: TEMPLATE_HEADERS });
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'dsrs_import_template.xlsx');
    toast.success('Template downloaded');
  };

  const pick = (files) => {
    const f = files[0];
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Only .xlsx, .xls or .csv files are allowed');
      return;
    }
    setFile(f);
    setResult(null);
    setPhase('idle');
  };

  const upload = async () => {
    if (!file) return;
    setPhase('uploading');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/sources/import', fd);
      setResult(data);
      setPhase('done');
      toast.success(`Imported ${data.created} source(s)`);
      onImported?.();
    } catch (err) {
      setPhase('error');
      setResult(null);
      toast.error(err.response?.data?.error || 'Import failed');
    }
  };

  const close = () => {
    setFile(null);
    setPhase('idle');
    setResult(null);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={close}>
      <div className="w-full max-w-2xl card !rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="card-header">
          <div className="flex items-center gap-2">
            <FiUpload size={16} className="text-brand-600" />
            <h2 className="font-semibold text-sm text-slate-800">Bulk import sources</h2>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <FiX size={16} />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {phase === 'done' ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
                <FiCheckCircle className="text-emerald-600 shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-emerald-800 text-sm">{result.created} source(s) registered</p>
                  <p className="text-xs text-emerald-700">{result.skipped} row(s) skipped</p>
                </div>
              </div>
              {result.unmappedHeaders?.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  Columns ignored (not recognised): {result.unmappedHeaders.join(', ')}
                </div>
              )}
              {result.errors?.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    Rows with problems ({result.errors.length})
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <table className="data-table !text-xs">
                      <tbody>
                        {result.errors.slice(0, 50).map((e, i) => (
                          <tr key={i}>
                            <td className="text-slate-400 w-16">Row {e.row}</td>
                            <td className="text-slate-600">{e.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={close} className="btn-primary">Done</button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={downloadTemplate} className="btn-secondary !py-3 text-sm">
                  <FiDownload size={15} /> Download template (.xlsx)
                </button>
                <button onClick={() => inputRef.current?.click()} className="btn-secondary !py-3 text-sm">
                  <FiFileText size={15} /> {file ? 'Choose different file' : 'Choose file…'}
                </button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => pick(e.target.files)}
              />

              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); pick(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                  file ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-300 bg-slate-50 hover:border-brand-400'
                }`}
              >
                {file ? (
                  <p className="text-sm font-medium text-slate-700">{file.name}</p>
                ) : (
                  <>
                    <FiUpload className="mx-auto mb-2 text-slate-400" size={22} />
                    <p className="text-sm text-slate-500">Drop your .xlsx / .xls / .csv file here, or click to browse</p>
                  </>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-500 space-y-1">
                <p className="flex items-center gap-1.5 font-semibold text-slate-600"><FiAlertTriangle size={12} /> Requirements</p>
                <p>• First row must be column headers (use the template for the exact names).</p>
                <p>• At minimum each row needs <b>Radionuclide</b> and <b>Current Activity</b> (unit defaults to GBq).</p>
                <p>• Unknown owners / radionuclides are reported, skipped rows are listed after import.</p>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={close} className="btn-secondary">Cancel</button>
                <button onClick={upload} disabled={!file || phase === 'uploading'} className="btn-primary">
                  {phase === 'uploading' && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  <FiUpload size={15} /> Import {file ? `"${file.name}"` : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}