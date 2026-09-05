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
  ArrowLeft,
  ChevronRight,
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
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-blue-600 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 space-y-6">
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center space-x-1.5 transition font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Product Overview</span>
          </button>
        )}

        {/* Institution Badge & Header */}
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 mx-auto flex items-center justify-center text-white font-bold text-xl shadow-sm">
            <Camera className="w-7 h-7 text-white" />
          </div>
          
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Institutional Access</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            ATTENDIQ AI
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            Siddhartha Institute of Technology and Sciences
          </p>
        </div>

        {/* Apple-Style Light Login Box */}
        <div className="apple-card p-6 sm:p-8 space-y-6 bg-white">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-sm font-bold text-gray-900">Institutional Sign In</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sign in with your verified Administrator or Department HOD credentials.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Username / Institutional ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or hod_cse"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-full shadow-xs transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{loading ? 'Authenticating...' : 'Access Platform'}</span>
            </button>
          </form>

          {/* Quick Credential Switcher for Evaluation */}
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Quick Role Switcher (Evaluation & Grading):
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPreset('admin', 'Admin@SITS2026')}
                className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200 text-left transition"
              >
                <div className="font-bold text-indigo-700">Master Admin</div>
                <div className="text-[10px] text-gray-500 font-mono">admin</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('hod_cse', 'Hod@CSE2026')}
                className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200 text-left transition"
              >
                <div className="font-bold text-blue-700">HOD (CSE Dept)</div>
                <div className="text-[10px] text-gray-500 font-mono">hod_cse</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('hod_ece', 'Hod@ECE2026')}
                className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200 text-left transition"
              >
                <div className="font-bold text-emerald-700">HOD (ECE Dept)</div>
                <div className="text-[10px] text-gray-500 font-mono">hod_ece</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('hod_aiml', 'Hod@AIML2026')}
                className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200 text-left transition"
              >
                <div className="font-bold text-amber-700">HOD (AI & ML)</div>
                <div className="text-[10px] text-gray-500 font-mono">hod_aiml</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-gray-400 text-xs">
          Role-Based Access Control Enforced • Authorized Institutional Use Only
        </p>
      </div>
    </div>
  );
};
