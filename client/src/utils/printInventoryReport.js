import { toTbq } from './unitConversion';

// Opens a print-formatted report window combining the full end-user register
// with the complete source inventory grouped by owning end user.
export function printInventoryReport({ sources, institutions, title = 'DSRS Inventory Report' }) {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const byOwner = new Map();
  const unassigned = [];
  sources.forEach((s) => {
    const iid = String(s.current_owner_id ?? '');
    if (iid && institutions.some((i) => String(i.id) === iid)) {
      if (!byOwner.has(iid)) byOwner.set(iid, []);
      byOwner.get(iid).push(s);
    } else {
      unassigned.push(s);
    }
  });

  const catCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  sources.forEach((s) => { if (catCount[s.source_classification] !== undefined) catCount[s.source_classification] += 1; });
  const totalTbq = sources.reduce((a, s) => a + (toTbq(s.current_activity, s.current_activity_unit) || 0), 0);

  const endUserRows = institutions
    .map((u, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td><strong>${esc(u.name)}</strong><br/><span class="muted">${esc(u.address || '')}</span></td>
        <td>${esc(u.code || '')}</td>
        <td>${esc(u.contact_phone || '—')}</td>
        <td>${esc(u.license_number || '—')}</td>
        <td>${esc(u.rpo_rpe_name || '—')}</td>
      </tr>`).join('');

  const srcRow = (s, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${esc(s.radionuclide)}</td>
      <td class="mono">${esc(s.source_serial_no || s.device_serial_no || `#${s.id}`)}</td>
      <td class="mono">${esc(s.device_serial_no || '—')}</td>
      <td>${esc(s.current_activity ? `${s.current_activity} ${s.current_activity_unit}` : '—')}</td>
      <td class="mono">${s.current_activity ? `≈ ${fmtTbq(toTbq(s.current_activity, s.current_activity_unit))}` : '—'}</td>
      <td><span class="cat cat-${s.source_classification || 0}">Cat ${s.source_classification || '?'}</span></td>
      <td>${esc(s.storage_facility_unit || '—')}</td>
      <td class="cap">${esc(s.conditioning_status || 'none')}</td>
      <td>${s.date_last_verified ? String(s.date_last_verified).slice(0, 10) : '—'}</td>
    </tr>`;

  let sections = '';
  institutions.forEach((u) => {
    const list = byOwner.get(String(u.id)) || [];
    if (list.length === 0) return;
    sections += `
      <div class="section-top">
        <h2>${esc(u.name)}</h2>
        <p class="sub">${esc(u.rpo_rpe_name ? `RPO/RPE: ${u.rpo_rpe_name}` : '')}${esc(u.license_number ? ` · License: ${u.license_number}` : '')}${esc(u.contact_phone ? ` · ${u.contact_phone}` : '')}</p>
        <table>
          <thead><tr><th>#</th><th>Radionuclide</th><th>Source</th><th>Device</th><th>Activity (now)</th><th>~TBq</th><th>Category</th><th>Location</th><th>Conditioning</th><th>Verified</th></tr></thead>
          <tbody>${list.map((s, i) => srcRow(s, i)).join('')}</tbody>
        </table>
      </div>`;
  });
  if (unassigned.length) {
    sections += `
      <div class="section-top">
        <h2>Sources with no assigned end user</h2>
        <table>
          <thead><tr><th>#</th><th>Radionuclide</th><th>Source</th><th>Device</th><th>Activity (now)</th><th>~TBq</th><th>Category</th><th>Location</th><th>Conditioning</th><th>Verified</th></tr></thead>
          <tbody>${unassigned.map((s, i) => srcRow(s, i)).join('')}</tbody>
        </table>
      </div>`;
  }

  const stamp = new Date().toLocaleString();
  const win = window.open('', '_blank', 'width=1100,height=800');
  win.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 28px; font-size: 12px; }
    h1 { margin: 0; font-size: 20px; }
    .sub { color: #64748b; font-size: 11px; margin: 4px 0 16px; }
    h2 { font-size: 13px; margin: 0; color: #0f172a; }
    .section-top { margin-top: 18px; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { text-align: left; background: #0f172a; color: #fff; padding: 6px 8px; font-weight: 600; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    td.num { color: #94a3b8; }
    .mono { font-family: Consolas, monospace; }
    .cap { text-transform: capitalize; }
    .muted { color: #94a3b8; font-size: 10px; }
    tr:nth-child(even) td { background: #f8fafc; }
    .cats span { display: inline-block; margin-right: 10px; }
    .cat { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .cat-1 { background: #fee2e2; color: #b91c1c; } .cat-2 { background: #ffedd5; color: #c2410c; }
    .cat-3 { background: #fef3c7; color: #b45309; } .cat-4 { background: #e0f2fe; color: #0369a1; }
    .cat-5 { background: #d1fae5; color: #047857; }
    .foot { margin-top: 20px; color: #94a3b8; font-size: 10px; }
    @media print { body { padding: 0; } .section-top { page-break-inside: auto; } }
  </style></head><body>
    <h1>Ghana DSRS — ${esc(title)}</h1>
    <div class="sub">${institutions.length} end users · ${sources.length} sources · total activity ≈ ${fmtTbq(totalTbq)} · generated ${stamp}</div>

    <table>
      <thead><tr><th>#</th><th>End user</th><th>Code</th><th>Telephone</th><th>License No.</th><th>RPO / RPE</th></tr></thead>
      <tbody>${endUserRows}</tbody>
    </table>

    <div class="section-top cats">
      <h2>Category mix</h2>
      <p class="sub">
        ${[1, 2, 3, 4, 5].map((c) => `<span>Cat ${c}: <strong>${catCount[c]}</strong></span>`).join(' ')}
      </p>
    </div>

    ${sections}

    <div class="foot">DSRS — Disused Sealed Radioactive Sources Inventory System. Confidential regulatory record.</div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

function fmtTbq(v) {
  if (!v) return '0 TBq';
  if (v >= 1000) return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} TBq`;
  if (v >= 1) return `${v.toFixed(2)} TBq`;
  if (v >= 1e-3) return `${(v * 1e3).toFixed(1)} GBq`;
  if (v >= 1e-6) return `${(v * 1e6).toFixed(1)} MBq`;
  return `${(v * 1e12).toFixed(0)} Bq`;
}