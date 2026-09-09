import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiRadio, FiUser, FiLock } from 'react-icons/fi';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center shadow-lg shadow-brand-700/20 mb-3">
            <FiRadio className="text-white" size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ghana DSRS Registry</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Disused Sealed Radioactive Sources<br />National Radioactive Source Registry
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 shadow-panel">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-5">Enter your operator credentials to continue.</p>

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
                  placeholder="operator"
                  autoFocus
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div>
              <label className="field-label">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full !py-2.5">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Access is monitored. Unauthorized use is prohibited.
        </p>
      </div>
    </div>
  );
}