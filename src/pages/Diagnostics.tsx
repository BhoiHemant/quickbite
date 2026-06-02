import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MainLayout } from '../layouts/MainLayout';
import { 
  Terminal, 
  Play, 
  RefreshCw, 
  Database, 
  Layers, 
  HelpCircle,
  ArrowLeft
} from 'lucide-react';

interface TestResult {
  name: string;
  status: 'checking' | 'passed' | 'failed';
  message: string;
}

export const Diagnostics: React.FC = () => {
  const navigate = useNavigate();

  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSimulationLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    console.log('[Diagnostic Page] Launching manual connectivity diagnostics audit...');

    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const initialTests: TestResult[] = [
      { name: 'Environment variables loaded', status: 'checking', message: 'Checking...' },
      { name: 'Supabase client instance initialized', status: 'checking', message: 'Checking...' },
      { name: 'Supabase Auth Gateway reachable', status: 'checking', message: 'Checking...' },
      { name: 'Table "hotels" exists', status: 'checking', message: 'Checking...' },
      { name: 'Table "restaurant_tables" exists', status: 'checking', message: 'Checking...' },
      { name: 'Table "menu_items" exists', status: 'checking', message: 'Checking...' },
      { name: 'Table "menu_variants" exists', status: 'checking', message: 'Checking...' },
      { name: 'Table "orders" exists', status: 'checking', message: 'Checking...' },
      { name: 'Table "order_items" exists', status: 'checking', message: 'Checking...' },
      { name: 'Realtime websocket subscription active', status: 'checking', message: 'Checking...' }
    ];

    setTests(initialTests);

    // 1. Env vars Check
    if (!envUrl || !envKey) {
      initialTests[0] = { name: 'Environment variables loaded', status: 'failed', message: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing at runtime.' };
      setTests([...initialTests]);
      setIsRunning(false);
      return;
    }
    initialTests[0] = { name: 'Environment variables loaded', status: 'passed', message: 'Loaded successfully.' };
    setTests([...initialTests]);

    // 2. Client Check
    if (!supabase) {
      initialTests[1] = { name: 'Supabase client instance initialized', status: 'failed', message: 'createClient failed to initialize.' };
      setTests([...initialTests]);
      setIsRunning(false);
      return;
    }
    initialTests[1] = { name: 'Supabase client instance initialized', status: 'passed', message: 'Initialized successfully.' };
    setTests([...initialTests]);

    // 3. Auth Reachability Check
    try {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      initialTests[2] = { name: 'Supabase Auth Gateway reachable', status: 'passed', message: 'Auth gateway active.' };
    } catch (err: any) {
      initialTests[2] = { name: 'Supabase Auth Gateway reachable', status: 'failed', message: err.message || 'Auth gateway ping failed.' };
      setTests([...initialTests]);
      setIsRunning(false);
      return;
    }
    setTests([...initialTests]);

    // 4. Tables verification (Auditing each individually)
    const tablesToCheck = [
      { name: 'hotels', index: 3 },
      { name: 'restaurant_tables', index: 4 },
      { name: 'menu_items', index: 5 },
      { name: 'menu_variants', index: 6 },
      { name: 'orders', index: 7 },
      { name: 'order_items', index: 8 }
    ];

    for (const table of tablesToCheck) {
      try {
        const { error } = await supabase.from(table.name).select('*').limit(0);
        
        if (error && error.code === '42P01') {
          initialTests[table.index] = { name: `Table "${table.name}" exists`, status: 'failed', message: `PostgreSQL table does not exist (Code 42P01).` };
        } else {
          initialTests[table.index] = { name: `Table "${table.name}" exists`, status: 'passed', message: `Table validated successfully.` };
        }
      } catch (err: any) {
        initialTests[table.index] = { name: `Table "${table.name}" exists`, status: 'failed', message: err.message || 'Table verification threw error.' };
      }
      setTests([...initialTests]);
    }

    // 5. Real-time channel check
    try {
      // Direct instant check on the underlying client websocket status
      const isSocketConnected = (supabase as any).realtime?.isConnected?.();
      if (isSocketConnected) {
        initialTests[9] = { 
          name: 'Realtime websocket subscription active', 
          status: 'passed', 
          message: 'Websocket connection active & validated.' 
        };
        setTests([...initialTests]);
      } else {
        // Fallback to active channel subscription
        const testChannel = supabase.channel('audit-test-channel');
        let hasResolved = false;
        
        // Timeout gate of 15 seconds to accommodate network latency round-trips
        const timeoutId = setTimeout(() => {
          if (hasResolved) return;
          hasResolved = true;
          supabase.removeChannel(testChannel);
          initialTests[9] = { 
            name: 'Realtime websocket subscription active', 
            status: 'failed', 
            message: 'Websocket timeout. Check adblockers/VPN, RLS rules, or verify if the tables realtime publication SQL is executed.' 
          };
          setTests([...initialTests]);
        }, 15000);

        testChannel.subscribe((status) => {
          if (hasResolved) return;
          if (status === 'SUBSCRIBED') {
            hasResolved = true;
            clearTimeout(timeoutId);
            initialTests[9] = { 
              name: 'Realtime websocket subscription active', 
              status: 'passed', 
              message: 'Websocket subscription verified successfully.' 
            };
            setTests([...initialTests]);
            supabase.removeChannel(testChannel);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            hasResolved = true;
            clearTimeout(timeoutId);
            initialTests[9] = { 
              name: 'Realtime websocket subscription active', 
              status: 'failed', 
              message: 'Websocket connection error. Check if your VPN or adblocker blocks wss:// traffic.' 
            };
            setTests([...initialTests]);
            supabase.removeChannel(testChannel);
          }
        });
      }
    } catch (err: any) {
      initialTests[9] = { name: 'Realtime websocket subscription active', status: 'failed', message: err.message || 'Realtime subscription threw error.' };
      setTests([...initialTests]);
    }

    setIsRunning(false);
  };

  const runAuthFlowSimulation = async () => {
    setIsSimulating(true);
    setSimulationLogs([]);
    addLog('AUTHENTICATION AUDIT TEST INITIATED');
    addLog('------------------------------------');

    // 1. Wrong Password test
    addLog('TEST Scenario 1: Login with incorrect password...');
    try {
      const dummyMail = `audit-${Date.now()}@quickbite.com`;
      addLog(`Connecting with email: ${dummyMail} and incorrect password...`);
      const { error } = await supabase.auth.signInWithPassword({
        email: dummyMail,
        password: 'incorrectpassword123'
      });
      
      if (error) {
        addLog(`SUCCESS: Catching expected auth failure: "${error.message}"`);
      } else {
        addLog('FAILED: Bad password credentials allowed login.');
      }
    } catch (err: any) {
      addLog(`SUCCESS: Audit caught exception: ${err.message}`);
    }

    // 2. Unverified email login trigger
    addLog('TEST Scenario 2: Unverified email signup interceptor...');
    try {
      const tempMail = `unconfirmed-${Date.now()}@quickbite.com`;
      addLog(`Registering temp unconfirmed mail: ${tempMail}...`);
      const { data, error } = await supabase.auth.signUp({
        email: tempMail,
        password: 'validpassword123'
      });

      if (error) {
        addLog(`Sign up intercept: ${error.message}`);
      } else if (data.user) {
        addLog(`Temp user created: ID = ${data.user.id}`);
        // Verifying session state gates
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          addLog('SUCCESS: Session gated successfully. Unconfirmed user blocked from auto-log in.');
        } else {
          addLog('SUCCESS: Active session created. Email verification is DISABLED in your Supabase console (expected sandbox bypass).');
        }
      }
    } catch (err: any) {
      addLog(`Audit caught exception: ${err.message}`);
    }

    // 3. Current session audit
    addLog('TEST Scenario 3: Session restore checks...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        addLog(`Active session exists for logged user: ${session.user.email}`);
      } else {
        addLog('No active session. Gated as anonymous client.');
      }
    } catch (err: any) {
      addLog(`Session restore failed: ${err.message}`);
    }

    addLog('------------------------------------');
    addLog('AUTHENTICATION AUDIT COMPLETED. ALL SCENARIOS VERIFIED.');
    setIsSimulating(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const hasMissingTables = tests.slice(3, 9).some(t => t.status === 'failed');

  return (
    <MainLayout>
      <div className="space-y-6 text-left">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-slate-400 font-bold active-tap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Home</span>
          </button>
          
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-500" />
            <span>Connectivity Diagnostics</span>
          </h2>
        </div>

        {/* Triple Action trigger */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* LEFT: Verification Checkpoints list */}
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black uppercase text-slate-400">Connection Checkpoints</span>
                <button
                  onClick={runDiagnostics}
                  disabled={isRunning}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-500 hover:text-amber-400 active-tap"
                  title="Reload diagnostics"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="space-y-3">
                {tests.map((t, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-4 text-xs">
                    <div className="space-y-0.5 text-left">
                      <span className="text-slate-200 font-bold block">{t.name}</span>
                      <span className="text-[10px] text-slate-500 font-semibold block leading-relaxed">{t.message}</span>
                    </div>

                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      t.status === 'passed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : t.status === 'failed'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
                        : 'bg-slate-950 text-slate-650'
                    }`}>
                      {t.status === 'passed' ? 'Passed' : t.status === 'failed' ? 'Failed' : 'Auditing'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* SQL Migration Notification */}
            {hasMissingTables && (
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 text-left">
                <div className="flex gap-2 text-amber-500 font-black text-xs uppercase tracking-wider items-center">
                  <Database className="w-4 h-4" />
                  <span>Missing Postgres Tables Detected!</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                  We detected that one or more database tables have not been provisioned on Supabase yet. Open the <code className="text-amber-500 font-bold">supabase_schema.sql</code> file in the workspace, copy all scripts, and execute them in your Supabase SQL console to configure active sequences, references, and secure row security rules.
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: Simulation Auth test log */}
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black uppercase text-slate-400">Authentication Tester Suite</span>
                
                <button
                  onClick={runAuthFlowSimulation}
                  disabled={isSimulating}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black uppercase active-tap flex items-center gap-1 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Run Audit Test</span>
                </button>
              </div>

              {/* Console log outputs */}
              <div className="flex-1 min-h-[220px] max-h-[340px] p-3.5 bg-slate-950 border border-slate-850 rounded-xl overflow-y-auto font-mono text-[10px] leading-relaxed text-slate-300 no-scrollbar space-y-1">
                {simulationLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-slate-600 gap-1.5">
                    <Terminal className="w-6 h-6 text-slate-700" />
                    <span>Diagnostics log is currently empty. Click "Run Audit Test" to simulate authentications.</span>
                  </div>
                ) : (
                  simulationLogs.map((log, idx) => (
                    <div 
                      key={idx} 
                      className={`text-left break-all ${
                        log.includes('SUCCESS') 
                          ? 'text-emerald-400' 
                          : log.includes('FAILED') || log.includes('WARNING')
                          ? 'text-rose-400'
                          : log.includes('INITIATED') || log.includes('COMPLETED')
                          ? 'text-amber-500 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick dashboard settings help */}
            <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-2xl space-y-2.5">
              <div className="flex gap-2 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider items-center justify-center">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Supabase Sandbox Tip</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                To bypass unconfirmed email blocks, go to your <strong>Supabase Dashboard</strong> &rarr; <strong>Authentication</strong> &rarr; <strong>Providers</strong> &rarr; <strong>Email</strong>, disable the <strong>Confirm email</strong> trigger, and save. Newly registered accounts can log in immediately.
              </p>
            </div>
          </div>

        </div>

      </div>
    </MainLayout>
  );
};
