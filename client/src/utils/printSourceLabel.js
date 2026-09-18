// Opens a print window with a ready-to-stick source label: DSRS header,
// device/source identifiers, the scannable barcode, activity and category.
// Images are re-encoded to data URLs so they survive the new window.
export async function printSourceLabel({ source, barcodeUrl, qrUrl }) {
  const toDataUrl = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };
  const [barcode, qr] = await Promise.all([
    barcodeUrl ? toDataUrl(barcodeUrl) : null,
    qrUrl ? toDataUrl(qrUrl) : null,
  ]);

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const catColor = { 1: '#b91c1c', 2: '#c2410c', 3: '#b45309', 4: '#0369a1', 5: '#047857' }[source.source_classification] || '#475569';
  const issued = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const win = window.open('', '_blank', 'width=900,height=640');
  win.document.write(`<!doctype html><html><head><title>DSRS Label — ${esc(source.source_serial_no || source.device_serial_no || source.id)}</title><style>
    * { box-sizing: border-box; margin: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #e2e8f0; padding: 24px; color: #0f172a; }
    .sheet { display: flex; flex-wrap: wrap; gap: 16px; }
    .label {
      width: 102mm; min-height: 64mm; background: #fff; border: 1px dashed #94a3b8;
      border-radius: 3mm; padding: 4mm; display: flex; flex-direction: column;
      position: relative; page-break-inside: avoid;
    }
    .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 2mm; margin-bottom: 2mm; }
    .brand { font-weight: 800; font-size: 11pt; letter-spacing: .2px; }
    .brand span { color: #1d4ed8; }
    .sub { font-size: 7pt; color: #64748b; }
    .cat { font-size: 8pt; font-weight: 800; color: #fff; padding: 1mm 3mm; border-radius: 3mm; }
    .row { display: flex; justify-content: space-between; align-items: baseline; font-size: 9pt; padding: .7mm 0; }
    .row b { font-family: Consolas, monospace; }
    .ids { margin: 1.5mm 0; }
    .barcode { display: flex; align-items: center; gap: 3mm; margin-top: auto; }
    .barcode img { height: 22mm; background: #fff; }
    .barcode .val { font-size: 7.5pt; color: #334155; line-height: 1.35; }
    .best { background: #fff; padding: 2mm; border: 1px solid #e2e8f0; border-radius: 2mm; }
    .best img { width: 16mm; height: 16mm; display: block; }
    .foot { font-size: 6.5pt; color: #94a3b8; margin-top: 1.5mm; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .label { border: none; page-break-inside: avoid; } }
  </style></head><body>
    <div class="sheet">
      ${[0, 1, 2, 3].map(() => `
      <div class="label">
        <div class="head">
          <div>
            <div class="brand">GHANA <span>DSRS</span> REGISTRY</div>
            <div class="sub">National Radioactive Source Inventory${esc(source.nra_registration_no ? ' · ' + source.nra_registration_no : '')}</div>
          </div>
          <span class="cat">CAT ${source.source_classification}</span>
        </div>
        <div class="ids">
          <div class="row"><span>Device serial</span><b>${esc(source.device_serial_no || '—')}</b></div>
          <div class="row"><span>Source serial</span><b>${esc(source.source_serial_no || '—')}</b></div>
          <div class="row"><span>Radionuclide</span><b>${esc(source.radionuclide)}</b></div>
          <div class="row"><span>Activity (now)</span><b>${esc(source.current_activity != null ? `${source.current_activity} ${source.current_activity_unit}` : '—')}</b></div>
          <div class="row"><span style="color:${catColor};font-weight:700">IAEA category</span><b style="color:${catColor}">${source.source_classification}</b></div>
        </div>
        <div class="barcode">
          ${barcode ? `<img src="${barcode}" alt="barcode" />` : '<div style="width:50mm;height:22mm;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:7pt;color:#94a3b8">barcode unavailable</div>'}
          <div class="val">
            <b>${esc(source.source_barcode || source.source_serial_no || `DSRS-${source.id}`)}</b><br/>
            ${esc(source.storage_facility_unit || '')}${source.storage_facility_unit && source.current_owner_name ? ' · ' : ''}${esc(source.current_owner_name || '')}
          </div>
          ${qr ? `<div class="best"><img src="${qr}" /></div>` : ''}
        </div>
        <div class="foot">Issued ${issued} · Ghana Nuclear Regulatory Authority</div>
      </div>`).join('')}
    </div>
    <script>setTimeout(function(){ window.print(); }, 400);</script>
  </body></html>`);
  win.document.close();
  win.focus();
}