import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { Lock, Mail, User, ArrowRight, ShieldCheck, Eye, EyeOff, LayoutDashboard } from 'lucide-react';

interface LoginSignupProps {
  onSuccess: () => void;
}

export const LoginSignup: React.FC<LoginSignupProps> = ({ onSuccess }) => {
  const { setSession } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset');
    }
  }, []);

  const resetMessages = () => {
    setError(null);
    setInfo(null);
    setDevResetLink(null);
  };

  const switchMode = (nextMode: typeof mode) => {
    resetMessages();
    setMode(nextMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await api.post('/auth/login', { email, password });
        setSession(data.token, data.employee);
        onSuccess();
      } else if (mode === 'signup') {
        const data = await api.post('/auth/signup', { name, email, password });
        setSession(data.token, data.employee);
        onSuccess();
      } else if (mode === 'forgot') {
        const data = await api.post('/auth/forgot-password', { email });
        setInfo(data.message || 'Password reset link sent.');
        if (data.devToken) {
          setDevResetLink(`http://localhost:5173/?token=${data.devToken}`);
        }
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await api.post('/auth/reset-password', { token: resetToken, password });
        setInfo('Password reset successfully. You can now log in.');
        setMode('login');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const heading = {
    login: 'Welcome back',
    signup: 'Create workspace account',
    forgot: 'Reset access credentials',
    reset: 'Choose new password',
  }[mode];

  const subheading = {
    login: 'Sign in to manage assets, bookings, audits, and maintenance work.',
    signup: 'Register as an employee to start tracking assigned resources.',
    forgot: 'Enter your email to receive a password reset token.',
    reset: 'Set a new password for your AssetFlow account.',
  }[mode];

  return (
    <div className="min-h-screen auth-shell flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary-500 text-white flex items-center justify-center shadow-sm shadow-primary-500/20">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">AssetFlow</h1>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">Workspace</p>
          </div>
        </div>

        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-100 text-primary-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure access</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight">{heading}</h2>
          <p className="text-slate-500 text-sm leading-relaxed">{subheading}</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg text-center mb-6">
            {error}
          </div>
        )}

        {info && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg text-center mb-6">
            {info}
          </div>
        )}

        {devResetLink && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg text-left space-y-2 mb-6">
            <div className="font-bold uppercase tracking-wider text-[10px]">Hackathon Debug Info</div>
            <p>Click below to simulate email link redirection:</p>
            <a
              href={devResetLink}
              onClick={() => {
                const token = devResetLink.split('token=')[1];
                setResetToken(token);
                setMode('reset');
              }}
              className="text-primary-700 hover:text-primary-600 hover:underline block break-all"
            >
              {devResetLink}
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-lg text-slate-950 outline-none text-sm transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {mode !== 'reset' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-lg text-slate-950 outline-none text-sm transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Reset Token</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Token from terminal or dev banner"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-lg text-slate-950 outline-none text-sm transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">
                  {mode === 'reset' ? 'New Password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-primary-700 hover:text-primary-600 hover:underline outline-none"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-white border border-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-lg text-slate-950 outline-none text-sm transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-lg text-slate-950 outline-none text-sm transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold text-sm tracking-wide rounded-lg shadow-sm active:scale-[0.98] outline-none flex items-center justify-center gap-2 transition-all mt-6 cursor-pointer"
          >
            <span>{loading ? 'Processing...' : 'Continue'}</span>
            {!loading && <ArrowRight className="w-4.5 h-4.5" />}
          </button>
        </form>

        <div className="border-t border-slate-200 mt-8 pt-6 text-center text-xs text-slate-500">
          {mode === 'login' && (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="font-semibold text-primary-700 hover:text-primary-600 hover:underline outline-none"
              >
                Sign up as Employee
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-semibold text-primary-700 hover:text-primary-600 hover:underline outline-none"
              >
                Sign in instead
              </button>
            </p>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-semibold text-primary-700 hover:text-primary-600 hover:underline outline-none"
            >
              Return to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default LoginSignup;
