import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiLock, FiShield, FiKey, FiUser } from 'react-icons/fi';

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;

export default function ChangePassword({ forced }) {
  const { user, setSession } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [username, setUsername] = useState(user?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const uname = username.trim();
    if (!uname || !USERNAME_RE.test(uname)) {
      toast.error('Username must be 3–32 characters: letters, numbers, or . _ -');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/auth/password', {
        current_password: currentPassword,
        new_password: newPassword,
        new_username: uname,
      });
      setSession(data);
      toast.success(forced ? 'Login set up. Welcome!' : 'Credentials updated successfully');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update credentials');
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => navigate('/');

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center shadow-lg shadow-brand-700/20 mb-3">
            <FiShield className="text-white" size={26} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {forced ? 'Set up your login' : 'Update credentials'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            {forced
              ? 'Choose your own username and password before continuing.'
              : 'Change your username and/or password. Leave the username as is to keep it.'}
          </p>
        </div>

        <div className="card p-6 shadow-panel">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="field-label">Username</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pl-10"
                  placeholder="Choose your username"
                  required
                />
              </div>
            </div>
            <div>
              <label className="field-label">Current password</label>
              <div className="relative">
                <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <div>
              <label className="field-label">New password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <div>
              <label className="field-label">Confirm new password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="Repeat the new password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full !py-2.5">
              {saving ? 'Saving…' : forced ? 'Set login & continue' : 'Save changes'}
            </button>
            {!forced && (
              <button type="button" onClick={onCancel} className="btn-secondary w-full">
                Cancel
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}