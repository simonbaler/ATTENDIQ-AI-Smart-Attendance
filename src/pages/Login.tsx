import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Building2,
  Lock,
  User,
  AlertCircle,
  Loader2,
  Sparkles,
  Camera,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

interface LoginProps {
  onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBack }) => {
  const { login } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@SITS2026');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await login(username.trim(), password);
      if (!res.success) {
        setErrorMsg(res.message || 'Invalid username or password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 space-y-6">
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Product Overview</span>
          </button>
        )}

        {/* Institution Badge & Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 mx-auto flex items-center justify-center text-white font-black text-2xl shadow-xl ring-4 ring-blue-500/20">
            SITS
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SIH 2026 Production Attendance Platform</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            SITS SmartAttend AI
          </h1>
          <p className="text-xs text-slate-400">
            Siddhartha Institute of Technology and Sciences
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">Institutional Authentication</h2>
            <p className="text-xs text-slate-400">
              Sign in with your verified Administrator or Department HOD credentials.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username / Institutional ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or hod_cse"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg shadow-lg shadow-blue-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{loading ? 'Authenticating...' : 'Access Dashboard'}</span>
            </button>
          </form>

          {/* Quick Credential Switcher for Evaluation */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Quick Role Switcher (Evaluation & Grading):
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPreset('admin', 'Admin@SITS2026')}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition"
              >
                <div className="font-bold text-purple-400">Master Admin</div>
                <div className="text-[10px] text-slate-500 font-mono">admin / Admin@SITS2026</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('hod_cse', 'Hod@CSE2026')}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition"
              >
                <div className="font-bold text-blue-400">HOD (CSE Dept)</div>
                <div className="text-[10px] text-slate-500 font-mono">hod_cse / Hod@CSE2026</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('hod_ece', 'Hod@ECE2026')}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition"
              >
                <div className="font-bold text-emerald-400">HOD (ECE Dept)</div>
                <div className="text-[10px] text-slate-500 font-mono">hod_ece / Hod@ECE2026</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('hod_aiml', 'Hod@AIML2026')}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition"
              >
                <div className="font-bold text-amber-400">HOD (AI & ML)</div>
                <div className="text-[10px] text-slate-500 font-mono">hod_aiml / Hod@AIML2026</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-slate-500 text-xs">
          Role-Based Access Control Enforced • Authorized Institutional Use Only
        </p>
      </div>
    </div>
  );
};
