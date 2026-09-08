export const UNIT_TO_TBQ = {
  TBq: 1,
  GBq: 1e-3,
  MBq: 1e-6,
  kBq: 1e-9,
  Bq: 1e-12,
  Ci: 3.7e-2,
  mCi: 3.7e-5,
  uCi: 3.7e-8,
};

export function toTbq(activity, unit) {
  if (!activity || !unit) return null;
  return activity * (UNIT_TO_TBQ[unit] || 0);
}

export function classifySource(activityTbq, dValueTbq) {
  if (!activityTbq || !dValueTbq || dValueTbq <= 0) return null;
  const ad = activityTbq / dValueTbq;
  if (ad >= 1000) return 1;
  if (ad >= 10) return 2;
  if (ad >= 1) return 3;
  if (ad >= 0.01) return 4;
  return 5;
}

export function categoryLabel(cat) {
  if (!cat) return 'N/A';
  return `Category ${cat}`;
}

export function categoryBadge(cat) {
  const colors = {
    1: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    2: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    3: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    4: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    5: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  };
  return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${colors[cat] || 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`;
}

export const categoryMeta = {
  1: { label: 'Category 1', dot: 'bg-red-500', desc: 'Catastrophic danger', chart: '#dc2626' },
  2: { label: 'Category 2', dot: 'bg-orange-500', desc: 'Very dangerous', chart: '#f97316' },
  3: { label: 'Category 3', dot: 'bg-amber-500', desc: 'Dangerous', chart: '#f59e0b' },
  4: { label: 'Category 4', dot: 'bg-blue-500', desc: 'Unlikely to be dangerous', chart: '#3b82f6' },
  5: { label: 'Category 5', dot: 'bg-emerald-500', desc: 'Lowest hazard', chart: '#10b981' },
};

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString();
}