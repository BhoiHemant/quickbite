import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, RefreshCw, AlertTriangle, FileText, Database } from 'lucide-react';

interface StartupHealthCheckProps {
  children: React.ReactNode;
}

interface Checkpoint {
  name: string;
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
    console.log('[Diagnostic Startup] Running startup connectivity audit...');

    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const initialCheckpoints: Checkpoint[] = [
      {
        name: 'Environment Variables Configuration',
        status: 'pending',
        resolution: 'Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are declared in your local .env configuration file.'
      },
      {
        name: 'Supabase Client Initialization',
        status: 'pending',
        resolution: 'Ensure that the Client instance in src/lib/supabase.ts receives non-empty credentials.'
      },
      {
        name: 'Supabase Auth Gateway Reachability',
        status: 'pending',
        resolution: 'Check your internet connection or verify if your Supabase project instance has not been paused by the cloud provider.'
      },
      {
        name: 'Database Tables Provisioning',
        status: 'pending',
        resolution: 'Your Supabase database is reachable, but one or more tables are missing. Please execute the supabase_schema.sql script in your Supabase SQL Editor.'
      }
    ];

    setCheckpoints(initialCheckpoints);

    // 1. Env check
    if (!envUrl || !envKey) {
      initialCheckpoints[0].status = 'failed';
      initialCheckpoints[0].errorDetail = 'Credentials undefined at runtime. VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.';
      setCheckpoints([...initialCheckpoints]);
      setHasFailed(true);
      setLoading(false);
      return;
    }
    initialCheckpoints[0].status = 'success';
    setCheckpoints([...initialCheckpoints]);

    // 2. Client check
    if (!supabase) {
      initialCheckpoints[1].status = 'failed';
      initialCheckpoints[1].errorDetail = 'createClient call returned null or undefined instance.';
      setCheckpoints([...initialCheckpoints]);
      setHasFailed(true);
      setLoading(false);
      return;
    }
    initialCheckpoints[1].status = 'success';
    setCheckpoints([...initialCheckpoints]);

    // 3. Auth Check
    try {
      console.log('[Diagnostic Startup] Querying Auth Gateway session...');
      const { error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      initialCheckpoints[2].status = 'success';
      setCheckpoints([...initialCheckpoints]);
    } catch (err: any) {
      console.error('[Diagnostic Startup] Auth check failed:', err.message);
      initialCheckpoints[2].status = 'failed';
      initialCheckpoints[2].errorDetail = err.message || 'Auth gateway ping failed.';
      setCheckpoints([...initialCheckpoints]);
      setHasFailed(true);
      setLoading(false);
      return;
    }

    // 4. Tables check
    try {
      console.log('[Diagnostic Startup] Auditing PostgreSQL database tables...');
      const tablesToCheck = [
        'hotels', 
        'restaurant_tables', 
        'menu_items', 
        'menu_variants', 
        'orders', 
        'order_items'
      ];
      
      const missingTables: string[] = [];

      for (const tableName of tablesToCheck) {
        // Query zero rows to check table existence
        const { error } = await supabase.from(tableName).select('*').limit(0);
        
        // Code '42P01' is the postgres code for undefined_table
        if (error && error.code === '42P01') {
          console.error(`[Diagnostic Startup] Table not found: ${tableName}`);
          missingTables.push(tableName);
        }
      }

      if (missingTables.length > 0) {
        initialCheckpoints[3].status = 'failed';
        initialCheckpoints[3].errorDetail = `Missing database tables: ${missingTables.join(', ')}.`;
        setCheckpoints([...initialCheckpoints]);
        setHasFailed(true);
        setLoading(false);
        return;
      }

      initialCheckpoints[3].status = 'success';
      setCheckpoints([...initialCheckpoints]);
      console.log('[Diagnostic Startup] All startup connection audits passed successfully.');
    } catch (err: any) {
      console.error('[Diagnostic Startup] Tables audit throw:', err.message);
      initialCheckpoints[3].status = 'failed';
      initialCheckpoints[3].errorDetail = err.message || 'Postgres table validation error.';
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
          Auditing Connectivity...
        </span>
      </div>
    );
  }

  if (hasFailed) {
    return (
      <div className="min-h-screen min-h-svh bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 py-12 select-none animate-in fade-in duration-200 text-left">
        <div className="w-full max-w-lg space-y-6">
          
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-900 pb-4">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white uppercase tracking-wider">Startup Health Alert</h1>
              <p className="text-xs text-slate-500 mt-0.5">QuickBite POS database connectivity check failed.</p>
            </div>
          </div>

          {/* Diagnostic checkpoints cards */}
          <div className="space-y-3">
            {checkpoints.map((cp, idx) => (
              <div 
                key={idx} 
                className={`p-4 bg-slate-900 border rounded-2xl flex flex-col gap-2 transition-all ${
                  cp.status === 'failed' 
                    ? 'border-rose-500/30 bg-rose-500/[0.01]' 
                    : cp.status === 'success'
                    ? 'border-slate-800 bg-slate-900/50'
                    : 'border-slate-900 opacity-40'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <span className={`text-xs font-black uppercase tracking-wide text-left ${
                    cp.status === 'failed' ? 'text-rose-400' : cp.status === 'success' ? 'text-slate-350' : 'text-slate-550'
                  }`}>
                    {cp.name}
                  </span>
                  
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                    cp.status === 'failed' 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                      : cp.status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-950 text-slate-650'
                  }`}>
                    {cp.status === 'failed' ? 'Failed' : cp.status === 'success' ? 'Passed' : 'Pending'}
                  </span>
                </div>

                {cp.status === 'failed' && (
                  <div className="text-[11px] space-y-2 border-t border-slate-850 pt-2.5">
                    <p className="text-rose-400 font-bold flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                      <span>{cp.errorDetail}</span>
                    </p>
                    
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-slate-400">
                      <strong className="text-[10px] font-black uppercase text-amber-500 block">Resolution Steps:</strong>
                      <p className="leading-relaxed font-semibold">{cp.resolution}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Special migration notification if database is missing tables */}
          {checkpoints[3]?.status === 'failed' && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex gap-2 text-amber-500 font-black text-xs uppercase tracking-wider items-center">
                <Database className="w-4 h-4" />
                <span>SQL Setup Required</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                You must execute the <code className="text-amber-500">supabase_schema.sql</code> script on your Supabase dashboard to set up hotel registries, sequences, and secure RLS policies.
              </p>
              
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-850 text-slate-600 text-[10px] font-semibold flex justify-center gap-1.5 items-center">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Open supabase_schema.sql in the workspace to copy SQL.</span>
              </div>
            </div>
          )}

          {/* Trigger button */}
          <div className="flex gap-3">
            <button
              onClick={runDiagnostics}
              className="flex-1 h-12 rounded-xl bg-amber-500 text-slate-950 font-bold active-tap flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Diagnostic Tests</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  return <>{children}</>;
};
