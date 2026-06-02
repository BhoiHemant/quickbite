import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, RefreshCw, AlertTriangle, FileText, Database, Key, Server, Lock, CheckCircle2, XCircle } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [hasFailed, setHasFailed] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    setHasFailed(false);
    console.log('[Diagnostic Startup] Running production readiness connection audit...');

    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const initialCheckpoints: Checkpoint[] = [
      {
        id: 'supabase_url',
        name: 'Supabase URL Configuration',
        description: 'Verifying if VITE_SUPABASE_URL environment variable is loaded.',
        status: 'pending',
        resolution: 'Configure VITE_SUPABASE_URL in your deployment environments (Vercel Project Settings -> Environment Variables or local .env file).'
      },
      {
        id: 'supabase_key',
        name: 'Supabase Anon Key Configuration',
        description: 'Verifying if VITE_SUPABASE_ANON_KEY environment variable is loaded.',
        status: 'pending',
        resolution: 'Configure VITE_SUPABASE_ANON_KEY in your deployment environments (Vercel Project Settings -> Environment Variables or local .env file).'
      },
      {
        id: 'supabase_connection',
        name: 'Supabase Server Connection',
        description: 'Testing connection reachability to your Supabase API endpoint.',
        status: 'pending',
        resolution: 'Check your internet connection, or make sure your Supabase project instance URL is correct and the server has not been paused by Supabase.'
      },
      {
        id: 'database_access',
        name: 'Database Access (Tables)',
        description: 'Verifying permissions and schema layouts on core tables.',
        status: 'pending',
        resolution: 'Database is reachable, but tables are missing or RLS is misconfigured. Execute your supabase_schema.sql migrations in your Supabase SQL Editor.'
      },
      {
        id: 'auth_gate',
        name: 'Authentication Gate status',
        description: 'Validating Auth Gateway session and protocol handling.',
        status: 'pending',
        resolution: 'Supabase Auth server failed to respond or returned an API error. Check if Auth is enabled and email provider configurations are correct.'
      }
    ];

    setCheckpoints(initialCheckpoints);

    // 1. Check Supabase URL
    if (!envUrl || envUrl.includes('placeholder-url') || envUrl.includes('your_supabase_project_url_here')) {
      initialCheckpoints[0].status = 'failed';
      initialCheckpoints[0].errorDetail = 'VITE_SUPABASE_URL is missing or set to placeholder value.';
      setCheckpoints([...initialCheckpoints]);
      setHasFailed(true);
      setLoading(false);
      return;
    }
    initialCheckpoints[0].status = 'success';
    setCheckpoints([...initialCheckpoints]);

    // 2. Check Supabase Anon Key
    if (!envKey || envKey.includes('placeholder-anon-key') || envKey.includes('your_supabase_anon_key_here')) {
      initialCheckpoints[1].status = 'failed';
      initialCheckpoints[1].errorDetail = 'VITE_SUPABASE_ANON_KEY is missing or set to placeholder value.';
      setCheckpoints([...initialCheckpoints]);
      setHasFailed(true);
      setLoading(false);
      return;
    }
    initialCheckpoints[1].status = 'success';
    setCheckpoints([...initialCheckpoints]);

    // 3. Supabase Connection Check
    try {
      console.log('[Diagnostic Startup] Attempting to reach Supabase API...');
      const response = await fetch(`${envUrl}/rest/v1/`, {
        headers: {
          apikey: envKey
        }
      });
      
      if (!response.ok && response.status !== 404) {
        throw new Error(`Server returned HTTP status ${response.status} ${response.statusText}`);
      }
      initialCheckpoints[2].status = 'success';
      setCheckpoints([...initialCheckpoints]);
    } catch (err: any) {
      console.error('[Diagnostic Startup] Server Connection failed:', err);
      initialCheckpoints[2].status = 'failed';
      initialCheckpoints[2].errorDetail = err.message || 'Supabase API is completely unreachable. Potential network failure or incorrect URL.';
      setCheckpoints([...initialCheckpoints]);
      setHasFailed(true);
      setLoading(false);
      return;
    }

    // 4. Database Access (Tables) Check
    try {
      console.log('[Diagnostic Startup] Checking database access on base table (hotels)...');
      // Query zero rows to check table existence/accessibility
      const { error } = await supabase.from('hotels').select('id').limit(0);
      
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Relation "hotels" does not exist. Migrations have not been run on this Supabase project.');
        } else {
          throw new Error(`Database error [${error.code}]: ${error.message}`);
        }
      }
      
      initialCheckpoints[3].status = 'success';
      setCheckpoints([...initialCheckpoints]);
    } catch (err: any) {
      console.error('[Diagnostic Startup] Database Access failed:', err);
      initialCheckpoints[3].status = 'failed';
      initialCheckpoints[3].errorDetail = err.message || 'Postgres table validation failed.';
      setCheckpoints([...initialCheckpoints]);
      setHasFailed(true);
      setLoading(false);
      return;
    }

    // 5. Auth Gate Check
    try {
      console.log('[Diagnostic Startup] Querying Auth Gateway session...');
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      
      initialCheckpoints[4].status = 'success';
      setCheckpoints([...initialCheckpoints]);
      console.log('[Diagnostic Startup] All diagnostics successfully passed.');
    } catch (err: any) {
      console.error('[Diagnostic Startup] Auth check failed:', err);
      initialCheckpoints[4].status = 'failed';
      initialCheckpoints[4].errorDetail = err.message || 'Supabase Auth endpoint is failing or misconfigured.';
      setCheckpoints([...initialCheckpoints]);
      setHasFailed(true);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen min-h-svh bg-slate-950 text-slate-400 gap-3 select-none">
        <div className="w-10 h-10 rounded-full border-4 border-slate-900 border-t-amber-500 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">
          Auditing Production Readiness...
        </span>
      </div>
    );
  }

  if (hasFailed) {
    const isEnvMissing = checkpoints[0].status === 'failed' || checkpoints[1].status === 'failed';

    return (
      <div className="min-h-screen min-h-svh bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 py-12 select-none animate-in fade-in duration-200 text-left">
        <div className="w-full max-w-xl space-y-6">
          
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-900 pb-5">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-wider">Configuration Alert</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEnvMissing 
                  ? 'Supabase environment variables are missing.' 
                  : 'QuickBite POS database connectivity check failed.'}
              </p>
            </div>
          </div>

          {/* Diagnostic checkpoints cards */}
          <div className="grid grid-cols-1 gap-3">
            {checkpoints.map((cp) => {
              const Icon = cp.id === 'supabase_url' || cp.id === 'supabase_key' ? Key : cp.id === 'supabase_connection' ? Server : cp.id === 'database_access' ? Database : Lock;
              
              return (
                <div 
                  key={cp.id} 
                  className={`p-4 bg-slate-900 border rounded-2xl flex flex-col gap-2 transition-all ${
                    cp.status === 'failed' 
                      ? 'border-rose-500/30 bg-rose-500/[0.01]' 
                      : cp.status === 'success'
                      ? 'border-slate-800/80 bg-slate-900/50'
                      : 'border-slate-950 opacity-40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        cp.status === 'failed' ? 'bg-rose-500/10 text-rose-450' : cp.status === 'success' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-slate-950 text-slate-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wide text-white">
                          {cp.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                          {cp.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      {cp.status === 'failed' ? (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-950/20 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          <span>Missing / Failed</span>
                        </span>
                      ) : cp.status === 'success' ? (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Present / OK</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-950 text-slate-650">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {cp.status === 'failed' && (
                    <div className="text-[11px] space-y-2.5 border-t border-slate-850 pt-3 mt-1.5">
                      <p className="text-rose-400 font-bold flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                        <span>{cp.errorDetail}</span>
                      </p>
                      
                      <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1 text-slate-400">
                        <strong className="text-[9px] font-black uppercase text-amber-500 tracking-wider block">Resolution Action:</strong>
                        <p className="leading-relaxed font-semibold">{cp.resolution}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Vercel Guide Notification Card */}
          {isEnvMissing && (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex gap-2 text-amber-500 font-black text-xs uppercase tracking-wider items-center">
                <FileText className="w-4 h-4" />
                <span>Vercel Deployment Guide</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                To fix the blank screen on your Vercel URL, you need to configure environment variables.
              </p>
              
              <div className="space-y-1.5 p-3 bg-slate-950 border border-slate-850 rounded-xl font-mono text-[9px] text-slate-350">
                <div>1. Go to <strong className="text-white">Vercel Dashboard</strong> &rarr; Select your project</div>
                <div>2. Navigate to <strong className="text-white">Settings</strong> &rarr; <strong className="text-white">Environment Variables</strong></div>
                <div>3. Add variables with the exact values from Supabase:</div>
                <div className="pl-4 pt-1 text-amber-500 font-bold">VITE_SUPABASE_URL = (your supabase url)</div>
                <div className="pl-4 text-amber-500 font-bold">VITE_SUPABASE_ANON_KEY = (your supabase anon key)</div>
                <div className="pt-1 text-slate-500">4. Redeploy your application in Vercel.</div>
              </div>
            </div>
          )}

          {/* Special migration notification if database is missing tables */}
          {!isEnvMissing && checkpoints[3]?.status === 'failed' && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex gap-2 text-amber-500 font-black text-xs uppercase tracking-wider items-center">
                <Database className="w-4 h-4" />
                <span>SQL Database Setup Required</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                You must execute the <code className="text-amber-500">supabase_schema.sql</code> script on your Supabase dashboard to set up hotel registries, sequences, and secure RLS policies.
              </p>
              
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-850 text-slate-600 text-[10px] font-semibold flex justify-center gap-1.5 items-center">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Run migrations or copy schema script from your supabase_schema.sql file.</span>
              </div>
            </div>
          )}

          {/* Trigger buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={runDiagnostics}
              className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Diagnostic Checks</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  return <>{children}</>;
};
