import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UtensilsCrossed, ShieldAlert, CheckCircle, Mail, HelpCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // States for verification flow
  const [showVerificationAlert, setShowVerificationAlert] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const { login, signup, resendVerification, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setShowVerificationAlert(false);
    setResendSuccess(false);

    if (!email || !password) {
      setAuthError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }

    const { user, error } = isRegistering 
      ? await signup(email, password)
      : await login(email, password);

    if (error) {
      // Normalizing Supabase auth unverified email errors
      const isUnconfirmed = 
        error === 'email_not_confirmed' || 
        error.toLowerCase().includes('email not confirmed') ||
        error.toLowerCase().includes('confirmation_required') ||
        error.toLowerCase().includes('email_not_confirmed');

      if (isUnconfirmed) {
        setShowVerificationAlert(true);
        setAuthError('Email address is not verified yet. Please check your inbox.');
      } else {
        // Detailed translation of common auth messages
        if (error.toLowerCase().includes('invalid login credentials')) {
          setAuthError('Invalid email or password. Please verify credentials.');
        } else if (error.toLowerCase().includes('user already exists')) {
          setAuthError('An account with this email already exists. Try logging in.');
        } else {
          setAuthError(error);
        }
      }
    } else if (user && !showVerificationAlert) {
      navigate('/');
    }
  };

  const handleResendLink = async () => {
    if (!email) return;
    setResendLoading(true);
    setResendSuccess(false);
    
    try {
      const { error: resendError } = await resendVerification(email);
      if (resendError) {
        setAuthError(resendError);
      } else {
        setResendSuccess(true);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to resend confirmation email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-screen min-h-svh bg-slate-950 px-6 py-12 text-slate-100 select-none animate-in fade-in duration-200 text-left">
      <div className="w-full max-w-sm mx-auto space-y-6">
        
        {/* Branding header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl text-amber-500">
            <UtensilsCrossed className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Quick<span className="text-amber-500">Bite</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs">
            Supabase-powered high performance restaurant order & billing system.
          </p>
        </div>

        {/* Auth Error Banner */}
        {authError && !showVerificationAlert && (
          <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold leading-normal">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{authError}</span>
          </div>
        )}

        {/* Dynamic Verification Alert UI Component */}
        {showVerificationAlert && (
          <div className="p-4 bg-slate-900 border border-amber-500/20 rounded-2xl space-y-3.5 text-left shadow-lg">
            <div className="flex gap-2 text-amber-500 font-extrabold text-xs uppercase tracking-wide items-center">
              <Mail className="w-4 h-4 text-amber-500" />
              <span>Email Verification Required</span>
            </div>
            
            <p className="text-[11px] text-slate-350 leading-relaxed font-semibold">
              We've created your account, but you must confirm your email before logging in. Check your inbox and spam folder for the confirmation link.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleResendLink}
                disabled={resendLoading}
                className="w-full h-10 rounded-xl bg-amber-500 text-slate-950 font-bold active-tap text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {resendLoading ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                <span>{resendLoading ? 'Sending...' : 'Resend Verification Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVerificationAlert(false)}
                className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-semibold hover:text-slate-200 active-tap"
              >
                Back to Login Form
              </button>
            </div>

            {resendSuccess && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-bold mt-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Verification link resent! Check spam if not found.</span>
              </div>
            )}
          </div>
        )}

        {/* Credentials Form */}
        {!showVerificationAlert && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. owner@quickbite.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-amber-500 text-slate-950 font-bold active-tap flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Processing...' : isRegistering ? 'Create SaaS Account' : 'Log In'}</span>
            </button>
          </form>
        )}

        {/* Toggle link */}
        {!showVerificationAlert && (
          <div className="text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError(null);
              }}
              className="text-xs text-amber-500 font-semibold underline decoration-amber-500/30 active-tap"
            >
              {isRegistering ? 'Already have an account? Log In' : "Don't have a SaaS account? Sign Up"}
            </button>
          </div>
        )}

        {/* Developer Sandbox Instructions Panel */}
        <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-2xl space-y-2.5">
          <div className="flex gap-2 text-slate-400 font-extrabold text-[10px] uppercase tracking-wide items-center justify-center">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Developer Sandbox Guide</span>
          </div>
          
          <div className="text-[10px] text-slate-500 leading-relaxed font-semibold space-y-1">
            <p>To disable email confirmation for immediate sandbox log in:</p>
            <ol className="list-decimal pl-4 space-y-1 text-slate-400 text-left">
              <li>Open your <strong>Supabase Dashboard</strong>.</li>
              <li>Go to <strong>Authentication</strong> &rarr; <strong>Providers</strong> &rarr; <strong>Email</strong>.</li>
              <li>Toggle off <strong>Confirm email</strong> and click <strong>Save</strong>.</li>
            </ol>
          </div>
        </div>

      </div>
    </div>
  );
};
