import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurantStore } from '../store/useRestaurantStore';
import { MainLayout } from '../layouts/MainLayout';
import { 
  IndianRupee, 
  Coffee, 
  TrendingUp, 
  ArrowRight, 
  Users, 
  PlusCircle 
} from 'lucide-react';
import { useDashboard, useTables, useOrders, useRealtimeSync } from '../hooks/useQueries';

export const Dashboard: React.FC = () => {
  const { hotel } = useRestaurantStore();
  const navigate = useNavigate();

  // Redirect if no hotel is configured yet
  React.useEffect(() => {
    if (!hotel) {
      navigate('/setup');
    }
  }, [hotel, navigate]);

  const hotelId = hotel?.id;

  // Real-time synchronization subscription
  useRealtimeSync(hotelId);

  // TanStack queries for metrics, tables, and active orders
  const { data: dashboard, isLoading: isDashboardLoading } = useDashboard(hotelId);
  const { data: tables = [], isLoading: isTablesLoading } = useTables(hotelId);
  const { data: activeOrders = [], isLoading: isOrdersLoading } = useOrders(hotelId);

  // Active tables list
  const activeTablesList = React.useMemo(() => {
    return tables.filter(t => t.active);
  }, [tables]);

  // Compute Occupied tables set
  const occupiedTableIds = React.useMemo(() => {
    const ids = new Set<string>();
    activeOrders.forEach(o => {
      if (o.order_type === 'table' && o.table_id) {
        ids.add(o.table_id);
      }
    });
    return ids;
  }, [activeOrders]);

  const occupiedTablesCount = occupiedTableIds.size;
  const todaySales = dashboard?.todaySales || 0;
  const totalDineIn = dashboard?.totalOrders?.tableCount || 0;
  const totalParcels = dashboard?.totalOrders?.parcelCount || 0;
  const topSellingItems = dashboard?.topSellingItems || [];

  const isLoading = isDashboardLoading || isTablesLoading || isOrdersLoading;

  return (
    <MainLayout>
      <div className="space-y-6 text-left">
        
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Today's Overview</span>
            <h2 className="text-xl font-black text-white mt-0.5">Namaste, {hotel?.owner_name || 'Owner'}!</h2>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-500 font-bold block">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Top Row Grid: Sales Card & Metrics Cards for Widescreen */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Primary Earning Metric Card (lg:col-span-7) */}
          <div className="relative overflow-hidden p-6 bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl text-slate-950 shadow-lg shadow-amber-500/10 lg:col-span-7 flex flex-col justify-between min-h-[140px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-6 -translate-y-6 pointer-events-none"></div>
            
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-900/70 block">
                TODAY'S TOTAL SALES
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <IndianRupee className="w-6 h-6 stroke-[3] self-center" />
                <span className="text-3xl font-black tracking-tight">
                  {isLoading ? '...' : todaySales.toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-slate-950/80 bg-white/15 px-2.5 py-1 rounded-full w-max">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Active Operations Running Smoothly</span>
            </div>
          </div>

          {/* Triple Quick Metrics Grid (lg:col-span-5) */}
          <div className="grid grid-cols-3 gap-3 lg:col-span-5">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Orders</span>
              <div className="flex items-baseline gap-0.5 mt-1.5">
                <span className="text-xl font-black text-white">{isLoading ? '...' : totalDineIn}</span>
                <span className="text-[9px] text-slate-500 font-semibold ml-0.5">Dine</span>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Parcels</span>
              <div className="flex items-baseline gap-0.5 mt-1.5">
                <span className="text-xl font-black text-amber-500">{isLoading ? '...' : totalParcels}</span>
                <span className="text-[9px] text-slate-500 font-semibold ml-0.5">Pkgs</span>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Occupied</span>
              <div className="flex items-baseline gap-0.5 mt-1.5">
                <span className="text-xl font-black text-rose-500">{isLoading ? '...' : occupiedTablesCount}</span>
                <span className="text-[9px] text-slate-500 font-semibold ml-0.5">/ {activeTablesList.length}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Double-Column Layout for bottom sections on Widescreen */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ========================================================
              LEFT COLUMN: OCCUPANCY & QUICK COUNTER (lg:col-span-7)
              ======================================================== */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Occupancy Mini Board */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-500" />
                  <span>Dine-In Table Occupancy</span>
                </h3>
                <button 
                  onClick={() => navigate('/tables')}
                  className="text-[10px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-0.5 active-tap"
                >
                  <span>View Grid</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              
              {isLoading ? (
                <div className="flex justify-center items-center py-6">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-800 border-t-amber-500 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                  {activeTablesList.map((t) => {
                    const isOccupied = occupiedTableIds.has(t.id);
                    return (
                      <div 
                        key={t.id}
                        onClick={() => navigate('/tables')}
                        className={`py-2.5 px-1.5 rounded-xl border text-center font-black text-xs cursor-pointer active-tap truncate ${
                          isOccupied 
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                        title={t.table_name}
                      >
                        {t.table_name}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {!isLoading && activeTablesList.length === 0 && (
                <p className="text-[10px] text-center text-slate-500 font-medium italic pt-1">
                  No tables active. Go to Table Settings to configure.
                </p>
              )}
            </div>

            {/* Quick Launch Action Button */}
            <button
              onClick={() => navigate('/parcels')}
              className="w-full h-13 rounded-2xl bg-slate-900 border border-amber-500/20 active:border-amber-500/50 text-slate-200 font-extrabold active-tap flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-amber-500" />
              <span>New Quick Order / Parcel Counter</span>
            </button>
          </div>

          {/* ========================================================
              RIGHT COLUMN: TOP SELLERS LIST (lg:col-span-5)
              ======================================================== */}
          <div className="lg:col-span-5 space-y-6">
            {/* Top Selling Items */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                <Coffee className="w-4 h-4 text-amber-500" />
                <span>Today's Top Sellers</span>
              </h3>

              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-800 border-t-amber-500 animate-spin" />
                </div>
              ) : topSellingItems.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-500 italic">No orders logged today yet.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {topSellingItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-medium border-b border-slate-800/40 pb-2 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5.5 h-5.5 flex items-center justify-center rounded-lg bg-slate-950 font-extrabold border border-slate-800 text-amber-500">
                          {idx + 1}
                        </span>
                        <span className="text-slate-200 font-bold text-left">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block font-semibold">{item.count} sold</span>
                        <span className="text-[11px] text-amber-500 font-black">₹{item.total.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </MainLayout>
  );
};
