import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const SIZES = [10, 25, 50, 100];

export default function Pager({ total, page, size, onPage, onSize }) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / size));
  const safe = Math.min(Math.max(1, page), pages);
  const from = (safe - 1) * size + 1;
  const to = Math.min(safe * size, total);

  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <select
          value={size}
          onChange={(e) => { onSize(Number(e.target.value)); onPage(1); }}
          className="input !w-auto !py-1.5 !px-2 text-xs"
        >
          {SIZES.map((s) => (
            <option key={s} value={s}>{s} / page</option>
          ))}
        </select>
        <button
          onClick={() => onPage(safe - 1)}
          disabled={safe <= 1}
          className="btn-secondary !px-2.5 !py-1.5 disabled:opacity-40"
          aria-label="Previous page"
        >
          <FiChevronLeft size={14} />
        </button>
        <span className="text-xs text-slate-600 font-medium">Page {safe} of {pages}</span>
        <button
          onClick={() => onPage(safe + 1)}
          disabled={safe >= pages}
          className="btn-secondary !px-2.5 !py-1.5 disabled:opacity-40"
          aria-label="Next page"
        >
          <FiChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}