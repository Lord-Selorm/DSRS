export const ROLE_LABELS = {
  admin: 'Manager',
  operator: 'User',
  viewer: 'Viewer',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || '—';
}