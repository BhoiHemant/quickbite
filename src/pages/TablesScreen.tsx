import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurantStore } from '../store/useRestaurantStore';
import { MainLayout } from '../layouts/MainLayout';
import { IndianRupee, Plus, FileText, ArrowRight, CircleDot, Settings } from 'lucide-react';
import { useTables, useOrders, useRealtimeSync } from '../hooks/useQueries';
import type { Table } from '../types';

export const TablesScreen: React.FC = () => {
  const { hotel } = useRestaurantStore();
  const navigate = useNavigate();

  const hotelId = hotel?.id;

  // Subscribe to real-time updates for orders and tables
  useRealtimeSync(hotelId);

  // Fetch tables and active orders via TanStack Query
  const { data: tables = [], isLoading: isTablesLoading } = useTables(hotelId);
  const { data: activeOrders = [], isLoading: isOrdersLoading } = useOrders(hotelId);

  const [filter, setFilter] = useState<'all' | 'empty' | 'active'>('all');

  // Compute a map of occupied table IDs to their active order objects
  const tableActiveOrderMap = useMemo(() => {
    const map = new Map<string, typeof activeOrders[0]>();
    activeOrders.forEach(o => {
      if (o.order_type === 'table' && o.table_id) {
        map.set(o.table_id, o);
      }
    });
    return map;
  }, [activeOrders]);

  // Filtered tables (Display only active tables configured in Settings)
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (!t.active) return false;
      const isOccupied = tableActiveOrderMap.has(t.id);
      if (filter === 'empty') return !isOccupied;
      if (filter === 'active') return isOccupied;
      return true;
    });
  }, [tables, filter, tableActiveOrderMap]);

  const handleTableClick = (table: Table) => {
    // Navigate to place or append orders for this table
    navigate(`/table-order/${table.id}`);
  };

  const isLoading = isTablesLoading || isOrdersLoading;

  return (
    <MainLayout>
      <div className="space-y-5">
        
        {/* Screen Header & Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">Restaurant Tables</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-full">
                {tables.filter(t => t.active).length} Active
              </span>
              <button
                onClick={() => navigate('/tables/settings')}
                className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-amber-500 hover:text-amber-400 active-tap"
                title="Table Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Ergonomic Horizontal Segment Filter */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-black transition-all active-tap ${
                filter === 'all' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400'
              }`}
            >
              All Tables
            </button>
            <button
              onClick={() => setFilter('empty')}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-black transition-all active-tap ${
                filter === 'empty' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400'
              }`}
            >
              Empty
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-black transition-all active-tap ${
                filter === 'active' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400'
              }`}
            >
              Occupied
            </button>
          </div>
        </div>

        {/* Tables Grid Layout */}
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
            {filteredTables.map((t) => {
              const activeOrder = tableActiveOrderMap.get(t.id);
              const isOccupied = !!activeOrder;
              const amount = activeOrder ? Number(activeOrder.total_amount) : 0;
              
              return (
                <div
                  key={t.id}
                  onClick={() => handleTableClick(t)}
                  className={`relative overflow-hidden p-4 rounded-2xl border flex flex-col justify-between h-[120px] transition-all cursor-pointer active-tap ${
                    isOccupied
                      ? 'bg-rose-500/5 border-rose-500/30 hover:border-rose-500/55'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Table Name & Status Pill */}
                  <div className="flex items-start justify-between">
                    <span className="text-lg font-black text-white truncate max-w-[110px]" title={t.table_name}>
                      {t.table_name}
                    </span>
                    
                    {/* Small round colored indicator */}
                    <span className={`flex h-2 w-2 rounded-full mt-1.5 ${
                      isOccupied ? 'bg-rose-500' : 'bg-slate-700'
                    }`} />
                  </div>

                  {/* Table Sub-details */}
                  <div className="space-y-1">
                    {!isOccupied ? (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                        <Plus className="w-3 h-3 text-amber-500" />
                        <span>TAP TO PLACE ORDER</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-baseline text-slate-200 font-black">
                          <IndianRupee className="w-3.5 h-3.5 self-center shrink-0" />
                          <span className="text-[14px]">{amount.toFixed(0)}</span>
                        </div>
                        
                        {/* Check out receipt indicator */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/billing/${activeOrder.id}`);
                            }}
                            className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 active-tap"
                            title="Generate Bill"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State Banner */}
        {!isLoading && filteredTables.length === 0 && (
          <div className="py-12 bg-slate-900/50 border border-slate-900 rounded-2xl text-center space-y-2">
            <CircleDot className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No tables matching this status filter.</p>
          </div>
        )}

        {/* Color-Coding Guide Legend */}
        <div className="flex justify-center items-center gap-5 p-3.5 bg-slate-900/80 border border-slate-900 rounded-xl text-[10px] font-black tracking-wider uppercase text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span>Empty / Vacant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Occupied</span>
          </div>
        </div>

      </div>
    </MainLayout>
  );
};
