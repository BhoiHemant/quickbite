import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database, AlertTriangle, Copy, Terminal, Check } from 'lucide-react';

interface DatabaseHealthCheckProps {
  children: React.ReactNode;
}

interface MismatchReport {
  tableName: string;
  missingCols: string[];
  doesNotExist: boolean;
}

export const DatabaseHealthCheck: React.FC<DatabaseHealthCheckProps> = ({ children }) => {
  const [isValidating, setIsValidating] = useState(true);
  const [mismatches, setMismatches] = useState<MismatchReport[]>([]);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);

  const tableExpectations: { [table: string]: string[] } = {
    hotels: ['id', 'owner_id', 'name', 'owner_name', 'phone', 'created_at'],
    restaurant_tables: ['id', 'hotel_id', 'table_name', 'display_order', 'active', 'created_at'],
    menu_items: ['id', 'hotel_id', 'name', 'category', 'active', 'created_at'],
    menu_variants: ['id', 'menu_item_id', 'variant_name', 'price', 'created_at'],
    orders: ['id', 'hotel_id', 'order_type', 'table_id', 'parcel_token', 'status', 'total_amount', 'created_at', 'closed_at'],
    order_items: ['id', 'order_id', 'menu_item_id', 'menu_variant_id', 'quantity', 'item_price', 'subtotal', 'created_at'],
    settings: ['id', 'hotel_id', 'setup_completed', 'restaurant_config']
  };

  const runSchemaValidation = async () => {
    setIsValidating(true);
    setHasError(false);
    const discoveredMismatches: MismatchReport[] = [];

    try {
      for (const [tableName, expectedCols] of Object.entries(tableExpectations)) {
        // 1. Check if table exists
        const { error: existErr } = await supabase.from(tableName).select('*').limit(0);
        
        if (existErr && existErr.code === '42P01') {
          discoveredMismatches.push({
            tableName,
            missingCols: expectedCols,
            doesNotExist: true
          });
          continue;
        }

        // 2. Perform a single batch query for all columns to avoid 44 round-trips!
        const { error: batchErr } = await supabase.from(tableName).select(expectedCols.join(',')).limit(0);
        
        if (batchErr) {
          // If there is an error, pinpoint the exact missing columns
          const missingCols: string[] = [];
          for (const colName of expectedCols) {
            const { error: colErr } = await supabase.from(tableName).select(colName).limit(0);
            if (colErr && (colErr.code === '42703' || colErr.message.includes('column') || colErr.message.includes('does not exist'))) {
              missingCols.push(colName);
            }
          }

          if (missingCols.length > 0) {
            discoveredMismatches.push({
              tableName,
              missingCols,
              doesNotExist: false
            });
          }
        }
      }

      setMismatches(discoveredMismatches);
      if (discoveredMismatches.length > 0) {
        setHasError(true);
      }
    } catch (err) {
      console.error('Startup schema health check failed:', err);
      setHasError(true);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    runSchemaValidation();
  }, []);

  const masterSql = `-- Master SQL Schema Migration & Reconcile
-- Run this SQL in your Supabase SQL Editor to make the system 100% production-ready.

-- 1. Reconcile Orders Table Columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='type') THEN
    ALTER TABLE public.orders RENAME COLUMN type TO order_type;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='token') THEN
    ALTER TABLE public.orders RENAME COLUMN token TO parcel_token;
  END IF;
END $$;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;

-- Ensure orders status and check constraints
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('active', 'paid', 'cancelled'));

-- 2. Reconcile Order Items Table Columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='variant_id') THEN
    ALTER TABLE public.order_items RENAME COLUMN variant_id TO menu_variant_id;
  END IF;
END $$;

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS item_price numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (item_price >= 0);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS subtotal numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0);

-- 3. Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  setup_completed boolean NOT NULL DEFAULT false,
  restaurant_config jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(owner_id)
);

-- Enable RLS on settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage their hotel's settings" ON public.settings;
CREATE POLICY "Owners can manage their hotel's settings"
  ON public.settings
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(masterSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen min-h-svh bg-slate-950 text-slate-400 gap-3 select-none text-center">
        <div className="w-9 h-9 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 animate-pulse">
          Auditing Database Integrity...
        </span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen min-h-svh bg-slate-950 text-slate-100 flex flex-col justify-center p-6 text-left select-none animate-in fade-in duration-200">
        <div className="w-full max-w-xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center gap-3.5 border-b border-slate-900 pb-4">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-0.5">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                Production Release Audit Block
              </span>
              <h2 className="text-lg font-black text-white uppercase tracking-wide">
                Database Schema Out-Of-Sync!
              </h2>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-400 font-semibold">
            We completed a live reverse-engineering check on boot and detected that your Supabase database schema does not match the POS system requirements. Apply the idempotent SQL release migration below to reconcile all differences automatically.
          </p>

          {/* Mismatch Matrix */}
          <div className="p-4 bg-slate-900 border border-slate-850 rounded-2xl space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-500" />
              <span>Missing Components detected</span>
            </h3>

            <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
              {mismatches.map((m, idx) => (
                <div key={idx} className="flex justify-between items-start gap-4 text-xs font-semibold">
                  <div className="space-y-0.5">
                    <span className="text-slate-200 font-bold block">{m.tableName}</span>
                    <span className="text-[10px] text-rose-400 font-bold block leading-relaxed">
                      {m.doesNotExist 
                        ? '❌ Table does not exist in public schema' 
                        : `❌ Missing columns: ${m.missingCols.join(', ')}`}
                    </span>
                  </div>
                  
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full shrink-0">
                    Fix Needed
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Copyable SQL Panel */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-500" />
                <span>SQL Release Migration Script</span>
              </span>

              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-[10px] font-bold text-amber-500 active-tap flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied script!' : 'Copy Script'}</span>
              </button>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl font-mono text-[9px] leading-relaxed text-slate-400 max-h-[180px] overflow-y-auto no-scrollbar scroll-smooth">
              <pre className="text-left select-text whitespace-pre-wrap">{masterSql}</pre>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-2xl space-y-2.5">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">
              Reconcile Instructions
            </h4>
            <ol className="list-decimal pl-4.5 text-[10px] text-slate-550 leading-relaxed font-semibold space-y-1.5 text-left">
              <li>Copy the SQL script using the button above.</li>
              <li>Go to your **Supabase Dashboard** for this project.</li>
              <li>Open the **SQL Editor** in the left sidebar, paste the script, and click **Run**.</li>
              <li>Go to **API Settings** &rarr; **Database** and click **Reload Schema Cache**.</li>
              <li>Reload this browser tab. All systems will pass and boot instantly!</li>
            </ol>
          </div>

        </div>
      </div>
    );
  }

  return <>{children}</>;
};
