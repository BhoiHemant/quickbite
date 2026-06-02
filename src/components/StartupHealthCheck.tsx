import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShieldAlert, 
  RefreshCw, 
  Key, 
  XCircle, 
  X,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

interface StartupHealthCheckProps {
  children: React.ReactNode;
}

interface Checkpoint {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'success' | 'failed';
  errorDetail?: string;
  resolution?: string;
}

export const StartupHealthCheck: React.FC<StartupHealthCheckProps> = ({ children }) => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const isConfigured = !!(envUrl && envKey && !envUrl.includes('placeholder-url') && !envKey.includes('placeholder-anon-key'));

  // If variables are configured, do NOT block the screen; load the application immediately.
  const [isBlocking, setIsBlocking] = useState(!isConfigured);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

  const runBackgroundDiagnostics = async () => {
    setIsRetrying(true);
    console.log('[Diagnostic Startup] Auditing Supabase reachability in background...');

    const initialCheckpoints: Checkpoint[] = [
      {
        id: 'supabase_url',
        name: 'Supabase URL Configuration',
        description: 'Verifying VITE_SUPABASE_URL environment variable.',
        status: 'pending',
        resolution: 'Configure VITE_SUPABASE_URL in your deployment environments (Vercel Project Settings -> Environment Variables or local .env file).'
      },
      {
        id: 'supabase_key',
        name: 'Supabase Anon Key Configuration',
        description: 'Verifying VITE_SUPABASE_ANON_KEY environment variable.',
        status: 'pending',
        resolution: 'Configure VITE_SUPABASE_ANON_KEY in your deployment environments (Vercel Settings -> Environment Variables or local .env file).'
      },
      {
        id: 'supabase_connection',
        name: 'Supabase Server Connection',
        description: 'Testing connection reachability and mapping status response codes.',
        status: 'pending',
        resolution: 'Check your network, or make sure your Supabase project instance URL is correct and the server has not been paused.'
      },
      {
        id: 'database_access',
        name: 'Database Access (Tables)',
        description: 'Verifying permissions and schema layouts on core tables.',
        status: 'pending',
        resolution: 'Verify that database migrations have been executed in your Supabase SQL Editor.'
      },
      {
        id: 'auth_gate',
        name: 'Authentication Gate status',
        description: 'Validating Auth Gateway session and protocol handling.',
        status: 'pending',
        resolution: 'Supabase Auth server failed to respond. Check if Auth is enabled.'
      }
    ];

    // 1. Check Supabase URL
    if (!envUrl || envUrl.includes('placeholder-url') || envUrl.includes('your_supabase_project_url_here')) {
      initialCheckpoints[0].status = 'failed';
      initialCheckpoints[0].errorDetail = 'VITE_SUPABASE_URL is missing or set to placeholder value.';
      setIsBlocking(true);
      setIsRetrying(false);
      return;
    }
    initialCheckpoints[0].status = 'success';

    // 2. Check Supabase Anon Key
    if (!envKey || envKey.includes('placeholder-anon-key') || envKey.includes('your_supabase_anon_key_here')) {
      initialCheckpoints[1].status = 'failed';
      initialCheckpoints[1].errorDetail = 'VITE_SUPABASE_ANON_KEY is missing or set to placeholder value.';
      setIsBlocking(true);
      setIsRetrying(false);
      return;
    }
    initialCheckpoints[1].status = 'success';

    // 3. Supabase Connection Check (with precise HTTP mapping)
    let connErrorDetail = '';
    try {
      console.log('[Diagnostic Startup] Hitting REST endpoint for HTTP status mapping...');
      // Perform direct fetch to inspect HTTP status code
      const response = await fetch(`${envUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: envKey
        }
      });

      console.log(`[Diagnostic Startup] HTTP REST response code: ${response.status}`);

      if (response.status === 200) {
        initialCheckpoints[2].status = 'success';
        initialCheckpoints[2].description = 'Server Status: ✅ Connected (HTTP 200)';
      } else if (response.status === 401) {
        // 401 means server is reachable, network works, but credential format is rejected for root path.
        initialCheckpoints[2].status = 'success'; // Safe success as it is reachable!
        initialCheckpoints[2].description = 'Server Status: ✅ Reachable / Authentication Checkpoint (HTTP 401)';
      } else if (response.status === 403) {
        initialCheckpoints[2].status = 'failed';
        initialCheckpoints[2].errorDetail = 'Permission Denied: Server responded with HTTP 403 Forbidden. Check your anon key credentials.';
        connErrorDetail = 'HTTP 403 Forbidden';
      } else if (response.status === 404) {
        initialCheckpoints[2].status = 'failed';
        initialCheckpoints[2].errorDetail = 'Endpoint Issue: Server returned HTTP 404 Not Found. Check if the URL is correct.';
        connErrorDetail = 'HTTP 404 Not Found';
      } else if (response.status >= 500) {
        initialCheckpoints[2].status = 'failed';
        initialCheckpoints[2].errorDetail = `Server Error: Database server returned HTTP ${response.status}. Instance might be restarting or paused.`;
        connErrorDetail = `HTTP ${response.status} Server Error`;
      } else {
        initialCheckpoints[2].status = 'failed';
        initialCheckpoints[2].errorDetail = `Unexpected Server Code: HTTP ${response.status}.`;
        connErrorDetail = `HTTP ${response.status}`;
      }
    } catch (err: any) {
      console.error('[Diagnostic Startup] Connection test failed with network/CORS error:', err);
      initialCheckpoints[2].status = 'failed';
      initialCheckpoints[2].errorDetail = err.message || 'Connection Failed: Network offline or host unreachable.';
      connErrorDetail = 'Network Offline / DNS Unreachable';
    }

    if (initialCheckpoints[2].status === 'failed') {
      setBannerMessage(`Supabase connection error (${connErrorDetail}). Real-time Sync and Cloud DB are currently offline.`);
      setShowBanner(true);
      setIsRetrying(false);
      return;
    }

    // 4. Database Access Check (Official client database ping)
    try {
      console.log('[Diagnostic Startup] Pinging database hotels table via official client...');
      const { error } = await supabase.from('hotels').select('id').limit(1);
      
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Database relation "hotels" does not exist. Your cloud database is online, but Supabase tables have not been provisioned.');
        } else {
          throw new Error(`Database access denied [${error.code}]: ${error.message}`);
        }
      }
      
      initialCheckpoints[3].status = 'success';
    } catch (err: any) {
      console.error('[Diagnostic Startup] Database access query failed:', err);
      setBannerMessage('Database schema verification failed. Cloud tables are missing or RLS blocks query.');
      setShowBanner(true);
      setIsRetrying(false);
      return;
    }

    // 5. Auth Gate Check (Official client Auth session ping)
    try {
      console.log('[Diagnostic Startup] Querying Auth endpoint via client...');
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      
      initialCheckpoints[4].status = 'success';
      console.log('[Diagnostic Startup] All background diagnostic health checks passed successfully.');
      setShowBanner(false); // Clear banner if connection fully restores
    } catch (err: any) {
      console.error('[Diagnostic Startup] Auth Gateway check failed:', err);
      setBannerMessage('Supabase authentication gateway is currently offline or unreachable.');
      setShowBanner(true);
      setIsRetrying(false);
      return;
    }

    setIsRetrying(false);
  };

  useEffect(() => {
    if (isConfigured) {
      runBackgroundDiagnostics();
    }
  }, []);

  // Blocking Flow: ONLY active when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing entirely.
  if (isBlocking) {
    return (
      <div className="min-h-screen min-h-svh bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 py-12 select-none animate-in fade-in duration-200 text-left">
        <div className="w-full max-w-xl space-y-6">
          
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-900 pb-5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-wider">Configuration Missing</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                QuickBite POS requires Supabase credentials to bootstrap.
              </p>
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">
              Supabase credentials not found at runtime
            </h2>
            <p className="text-xs text-slate-450 leading-relaxed font-semibold">
              The application could not detect your database credentials. Please declare these key parameters inside your Vercel deployment variables or in your local <code className="text-amber-500">.env</code> configuration file.
            </p>
            
            <div className="grid grid-cols-1 gap-2.5 pt-2">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-rose-500" />
                  <span className="font-mono text-[10px] text-slate-400">VITE_SUPABASE_URL</span>
                </div>
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-400 bg-rose-950/20 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3 text-rose-500" />
                  <span>Missing</span>
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-rose-500" />
                  <span className="font-mono text-[10px] text-slate-400">VITE_SUPABASE_ANON_KEY</span>
                </div>
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-400 bg-rose-950/20 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3 text-rose-500" />
                  <span>Missing</span>
                </span>
              </div>
            </div>
          </div>

          {/* Vercel Setup Instruction Card */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex gap-2 text-amber-500 font-black text-xs uppercase tracking-wider items-center">
              <Key className="w-4 h-4 text-amber-500" />
              <span>Vercel Environment Setup</span>
            </div>
            
            <div className="space-y-1.5 p-3.5 bg-slate-950 border border-slate-850 rounded-xl font-mono text-[10px] text-slate-350 leading-relaxed font-semibold">
              <div>1. Go to <strong className="text-white">Vercel Dashboard</strong> &rarr; Select your project</div>
              <div>2. Navigate to <strong className="text-white">Settings</strong> &rarr; <strong className="text-white">Environment Variables</strong></div>
              <div>3. Create two new variables:</div>
              <div className="pl-4 pt-1 text-amber-500 font-bold">VITE_SUPABASE_URL = (your URL)</div>
              <div className="pl-4 text-amber-500 font-bold">VITE_SUPABASE_ANON_KEY = (your public anon key)</div>
              <div className="pt-1.5 text-slate-500 font-bold">4. Trigger a new deployment in Vercel to load changes.</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                const refreshedUrl = import.meta.env.VITE_SUPABASE_URL;
                const refreshedKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                if (refreshedUrl && refreshedKey && !refreshedUrl.includes('placeholder-url')) {
                  setIsBlocking(false);
                  window.location.reload();
                } else {
                  alert('Supabase credentials still missing in environment. Please redeploy Vercel or configure your local .env file.');
                }
              }}
              className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-bold transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 animate-spin-reverse" />
              <span>Re-check Environment Configuration</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Non-blocking Flow: Render the router children immediately. Render a sticky warning banner at top if background diagnostic fails.
  return (
    <>
      {showBanner && (
        <div className="fixed top-0 inset-x-0 z-[9999] bg-rose-600 text-white shadow-xl select-none animate-in slide-in-from-top duration-300 font-semibold text-xs py-2.5 px-4 flex items-center justify-between gap-3 border-b border-rose-700/50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-white animate-pulse" />
            <span className="font-bold tracking-wide">
              {bannerMessage}
            </span>
          </div>
          
          <div className="flex items-center gap-3.5 shrink-0">
            <button 
              onClick={runBackgroundDiagnostics}
              disabled={isRetrying}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-50 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all border border-white/20 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Retrying...' : 'Retry Connection'}</span>
            </button>
            
            <a 
              href="/diagnostics"
              className="px-3 py-1 bg-rose-950/40 hover:bg-rose-950/60 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all border border-rose-950/20 flex items-center gap-1"
            >
              <span>Audit Panel</span>
              <ArrowRight className="w-3 h-3" />
            </a>

            <button 
              onClick={() => setShowBanner(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-all text-white/80 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
};
