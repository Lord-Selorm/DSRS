import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiX, FiShield, FiInbox } from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const emptyForm = { username: '', password: '', full_name: '', email: '', role: 'operator' };

const roleStyle = {
  admin: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  operator: 'bg-brand-50 text-brand-800 ring-1 ring-brand-200',
  viewer: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

export default function UsersAdmin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = () => api.get('/users').then(({ data }) => setUsers(data));

  useEffect(() => { if (user?.role === 'admin') load().catch(console.error); }, [user]);

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state py-24">
        <FiShield size={40} className="mb-3 text-slate-300" />
        <p className="font-medium text-slate-500">Administrators only</p>
        <p className="text-sm mt-1">You do not have permission to manage users.</p>
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { username, ...rest } = form;
        await api.put(`/users/${editingId}`, rest);
        toast.success('User updated');
      } else {
        await api.post('/users', form);
        toast.success('User created');
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setForm({ username: u.username, password: '', full_name: u.full_name, email: u.email, role: u.role });
    setShowForm(true);
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
      toast.success(u.is_active ? 'User deactivated' : 'User activated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Administrators &amp; system operators</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }} className="btn-primary">
          <FiPlus size={16} /> Add User
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800">{editingId ? `Edit: ${form.username}` : 'New User'}</h3>
            <button type="button" onClick={closeForm} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <FiX size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="field-label">Username *</label>
              <input value={form.username} disabled={!!editingId} onChange={(e) => setForm({ ...form, username: e.target.value })}
                className={`input ${editingId ? 'bg-slate-100' : ''}`} required />
            </div>
            <div>
              <label className="field-label">{editingId ? 'New Password (blank = keep)' : 'Password *'}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input" required={!editingId} />
            </div>
            <div>
              <label className="field-label">Full Name *</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </div>
            <div>
              <label className="field-label">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary">{editingId ? 'Update' : 'Create'}</button>
            <button type="button" onClick={closeForm} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'opacity-50'}>
                  <td className="font-mono font-medium text-slate-900">{u.username}</td>
                  <td className="text-slate-700">{u.full_name}</td>
                  <td className="text-slate-600">{u.email || '—'}</td>
                  <td>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleStyle[u.role] || ''}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-rose'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-2 text-sm">
                      <button onClick={() => startEdit(u)} className="px-2 py-1 rounded-lg text-brand-600 hover:bg-brand-50 font-medium">
                        Edit
                      </button>
                      <button onClick={() => toggleActive(u)} className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100">
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="empty-state">
            <FiInbox size={40} className="mb-3 text-slate-300" />
            <p className="font-medium text-slate-500">No users</p>
          </div>
        )}
      </div>
    </div>
  );
}