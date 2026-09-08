import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiUsers, FiInbox, FiSave, FiX, FiPhone, FiMapPin } from 'react-icons/fi';
import api from '../services/api';

const emptyForm = { name: '', contact_phone: '', address: '', license_number: '', rpo_rpe_name: '' };

export default function EndUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    return api.get('/institutions')
      .then(({ data }) => setUsers(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load().catch(console.error); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.code, u.contact_person, u.contact_phone, u.address, u.license_number, u.rpo_rpe_name]
        .some((v) => v && String(v).toLowerCase().includes(q))
    );
  }, [users, search]);

  const allSelected = filtered.length > 0 && filtered.every((u) => selected.includes(u.id));

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/institutions/${editingId}`, form);
        toast.success('End user updated');
      } else {
        await api.post('/institutions', form);
        toast.success('End user added');
      }
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setForm({
      name: u.name, contact_phone: u.contact_phone, address: u.address,
      license_number: u.license_number, rpo_rpe_name: u.rpo_rpe_name,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

  const remove = async (id) => {
    if (!confirm('Delete this end user? Their record history is kept.')) return;
    try {
      await api.delete(`/institutions/${id}`);
      toast.success('End user removed');
      setSelected((s) => s.filter((x) => x !== id));
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.length} selected end user(s)?`)) return;
    try {
      await Promise.all(selected.map((id) => api.delete(`/institutions/${id}`)));
      toast.success(`${selected.length} end user(s) removed`);
      setSelected([]);
      load();
    } catch (err) {
      toast.error('Bulk delete failed');
    }
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : filtered.map((u) => u.id));
  };

  const toggle = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <div className="p-6 h-full">
      <div className="mb-5">
        <h1 className="page-title">End Users</h1>
        <p className="text-sm text-slate-500 mt-0.5">Licensed facilities that own or operate radioactive sources</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5 items-start">
        {/* ===== Left: form ===== */}
        <section className="card overflow-hidden xl:sticky xl:top-0">
          <header className="card-header">
            <div className="flex items-center gap-2">
              <FiUsers size={16} className="text-brand-600" />
              <h2 className="font-semibold text-sm text-slate-800">{editingId ? 'Edit End User' : 'Add End User'}</h2>
            </div>
            {editingId && (
              <button onClick={cancelEdit} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <FiX size={13} /> cancel
              </button>
            )}
          </header>
          <form onSubmit={onSubmit} className="p-5 space-y-4">
            <div>
              <label className="field-label">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Korle Bu Teaching Hospital" required />
            </div>
            <div>
              <label className="field-label">Telephone</label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="input pl-9" placeholder="+233 …" />
              </div>
            </div>
            <div>
              <label className="field-label">Address</label>
              <div className="relative">
                <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input pl-9" placeholder="Street, city, region" />
              </div>
            </div>
            <div>
              <label className="field-label">License Number</label>
              <input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} className="input font-mono" placeholder="NRA/…/Lic" />
            </div>
            <div>
              <label className="field-label">RPO / RPE Name</label>
              <input value={form.rpo_rpe_name} onChange={(e) => setForm({ ...form, rpo_rpe_name: e.target.value })} className="input" placeholder="Radiation Protection Officer" />
            </div>
            <button type="submit" className="btn-primary w-full">
              {editingId ? <><FiSave size={15} /> Update end user</> : <><FiPlus size={15} /> Add end user</>}
            </button>
          </form>
        </section>

        {/* ===== Right: searchable list ===== */}
        <section className="card overflow-hidden">
          <div className="card-header">
            <div>
              <h2 className="font-semibold text-sm text-slate-800">Registered end users</h2>
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} of {users.length} facilities</p>
            </div>
            {selected.length > 0 && (
              <button onClick={bulkDelete} className="btn-danger !px-3 !py-1.5 text-xs">
                <FiTrash2 size={13} /> Delete {selected.length} selected
              </button>
            )}
          </div>

          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
                placeholder="Search by name, license, RPO, address…"
              />
            </div>
          </div>

          <div className="table-wrap max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
            <table className="data-table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      title={allSelected ? 'Clear selection' : 'Select all'}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </th>
                  <th>Name</th>
                  <th>Telephone</th>
                  <th>License No.</th>
                  <th>RPO / RPE</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className={selected.includes(u.id) ? 'bg-brand-50/60 border-l-4 border-l-brand-500' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(u.id)}
                        onChange={() => toggle(u.id)}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="min-w-[180px]">
                      <p className="font-semibold text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.address || '—'}</p>
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{u.contact_phone || '—'}</td>
                    <td className="text-slate-600">{u.license_number || '—'}</td>
                    <td className="text-slate-600">{u.rpo_rpe_name || '—'}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50" title="Edit">
                          <FiEdit size={15} />
                        </button>
                        <button onClick={() => remove(u.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete">
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div className="empty-state">
                <FiInbox size={38} className="mb-3 text-slate-300" />
                <p className="font-medium text-slate-500">No end users found</p>
              </div>
            )}
            {loading && (
              <div className="py-16 flex items-center justify-center">
                <span className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}