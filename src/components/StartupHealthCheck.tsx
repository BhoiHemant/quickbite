import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  RefreshCw, 
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
        resolution: 'Configure VITE_SUPABASE_URL in Vercel settings.'
      },
      {
        id: 'supabase_key',
        name: 'Supabase Anon Key Configuration',
        description: 'Verifying VITE_SUPABASE_ANON_KEY environment variable.',
        status: 'pending',
        resolution: 'Configure VITE_SUPABASE_ANON_KEY in Vercel settings.'
      },
      {
        id: 'supabase_connection',
        name: 'Supabase Server Connection',
        description: 'Testing connection reachability and mapping status response codes.',
        status: 'pending',
        resolution: 'Check your network, or make sure your Supabase project instance URL is correct.'
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
      setBannerMessage('Supabase URL configuration is missing. Cloud database features are disabled.');
      setShowBanner(true);
      setIsRetrying(false);
      return;
    }
    initialCheckpoints[0].status = 'success';

    // 2. Check Supabase Anon Key
    if (!envKey || envKey.includes('placeholder-anon-key') || envKey.includes('your_supabase_anon_key_here')) {
      initialCheckpoints[1].status = 'failed';
      initialCheckpoints[1].errorDetail = 'VITE_SUPABASE_ANON_KEY is missing or set to placeholder value.';
      setBannerMessage('Supabase Anon Key configuration is missing. Cloud database features are disabled.');
      setShowBanner(true);
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
    // Run background diagnostics on boot
    runBackgroundDiagnostics();
  }, []);

  // 100% Non-blocking Flow: Always render the children routes instantly.
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
