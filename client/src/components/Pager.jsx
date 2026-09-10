import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';

const SIZES = [10, 25, 50, 100];

export default function Pager({ total, page, size, onPage, onSize }) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / size));
  const safe = Math.min(Math.max(1, page), pages);
  const from = (safe - 1) * size + 1;
  const to = Math.min(safe * size, total);

  // Windowed page numbers around the current page, capped to first/last
  const win = [];
  for (let p = Math.max(1, safe - 2); p <= Math.min(pages, safe + 2); p++) win.push(p);

  const pageBtn = (p) => (
    <button
      key={p}
      onClick={() => onPage(p)}
      disabled={p === safe}
      className={`!px-2.5 !py-1.5 text-xs rounded-lg transition-colors ${
        p === safe
          ? 'bg-brand-600 text-white font-semibold'
          : 'btn-secondary !border-slate-300 text-slate-600 hover:bg-slate-100'
      }`}
    >
      {p}
    </button>
  );

  const navBtn = (label, disabled, onClick, children) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="btn-secondary !px-2.5 !py-1.5 disabled:opacity-40"
    >
      {children}
    </button>
  );

  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {total} source(s)
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={size}
          onChange={(e) => { onSize(Number(e.target.value)); onPage(1); }}
          className="input !w-auto !py-1.5 !px-2 text-xs"
        >
          {SIZES.map((s) => (
            <option key={s} value={s}>{s} / page</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          {navBtn('First page', safe <= 1, () => onPage(1), <FiChevronsLeft size={14} />)}
          {navBtn('Previous page', safe <= 1, () => onPage(safe - 1), <FiChevronLeft size={14} />)}
          {win[0] > 1 && (
            <>
              {pageBtn(1)}
              {win[0] > 2 && <span className="text-xs text-slate-400 px-0.5">…</span>}
            </>
          )}
          {win.map(pageBtn)}
          {win[win.length - 1] < pages && (
            <>
              {win[win.length - 1] < pages - 1 && <span className="text-xs text-slate-400 px-0.5">…</span>}
              {pageBtn(pages)}
            </>
          )}
          {navBtn('Next page', safe >= pages, () => onPage(safe + 1), <FiChevronRight size={14} />)}
          {navBtn('Last page', safe >= pages, () => onPage(pages), <FiChevronsRight size={14} />)}
        </div>
      </div>
    </div>
  );
}