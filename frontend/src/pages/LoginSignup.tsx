import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { Lock, Mail, User, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface LoginSignupProps {
  onSuccess: () => void;
}

export const LoginSignup: React.FC<LoginSignupProps> = ({ onSuccess }) => {
  const { setSession } = useAuthStore();

  // Mode can be 'login' | 'signup' | 'forgot' | 'reset'
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  
  // Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  // Check if token in URL for reset mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setDevResetLink(null);
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
        // Clean URL params
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a13] relative flex items-center justify-center p-4 overflow-hidden select-none">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-sky-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>

      <div className="glass-card max-w-lg w-full rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-600 animate-pulse"></div>

        {/* Head */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center space-x-2 bg-primary-500/10 border border-primary-500/20 text-primary-400 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4.5 h-4.5" />
            <span>Secure Access Control</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'signup' && 'Create Workspace Account'}
            {mode === 'forgot' && 'Reset Access Credentials'}
            {mode === 'reset' && 'Choose New Password'}
          </h2>
          <p className="text-slate-400 text-sm">
            {mode === 'login' && 'Sign in to access your dashboard'}
            {mode === 'signup' && 'Register as an Employee to track assigned resources'}
            {mode === 'forgot' && 'Enter your email to receive a password reset token'}
            {mode === 'reset' && 'Please select a secure, strong password'}
          </p>
        </div>

        {/* Messaging Panels */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center mb-6">
            {error}
          </div>
        )}

        {info && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl text-center mb-6">
            {info}
          </div>
        )}

        {devResetLink && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl text-left space-y-2 mb-6">
            <div className="font-bold uppercase tracking-wider text-[10px]">Hackathon Debug Info:</div>
            <p>Click below to simulate email link redirection:</p>
            <a
              href={devResetLink}
              onClick={() => {
                const token = devResetLink.split('token=')[1];
                setResetToken(token);
                setMode('reset');
              }}
              className="text-sky-400 hover:underline block break-all"
            >
              {devResetLink}
            </a>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                  <User className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition-all placeholder:text-slate-500"
                />
              </div>
            </div>
          )}

          {mode !== 'reset' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition-all placeholder:text-slate-500"
                />
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Reset Token</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Token from terminal or dev banner"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition-all placeholder:text-slate-500"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300">
                  {mode === 'reset' ? 'New Password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setInfo(null);
                      setDevResetLink(null);
                      setMode('forgot');
                    }}
                    className="text-xs text-primary-400 hover:text-primary-300 hover:underline outline-none"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition-all placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-400 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition-all placeholder:text-slate-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm tracking-wide rounded-xl shadow-lg hover:shadow-primary-500/20 active:scale-[0.98] outline-none flex items-center justify-center space-x-2 transition-all mt-6 cursor-pointer"
          >
            <span>{loading ? 'Processing...' : 'Continue'}</span>
            {!loading && <ArrowRight className="w-4.5 h-4.5" />}
          </button>
        </form>

        {/* Footer links */}
        <div className="border-t border-slate-800/60 mt-8 pt-6 text-center text-xs text-slate-400">
          {mode === 'login' && (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setDevResetLink(null);
                  setMode('signup');
                }}
                className="font-semibold text-primary-400 hover:text-primary-300 hover:underline outline-none"
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
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setDevResetLink(null);
                  setMode('login');
                }}
                className="font-semibold text-primary-400 hover:text-primary-300 hover:underline outline-none"
              >
                Sign in instead
              </button>
            </p>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setInfo(null);
                setDevResetLink(null);
                setMode('login');
              }}
              className="font-semibold text-primary-400 hover:text-primary-300 hover:underline outline-none"
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
