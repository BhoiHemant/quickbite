import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurantStore } from '../store/useRestaurantStore';
import { MainLayout } from '../layouts/MainLayout';
import { Plus, Package, IndianRupee, Printer, CheckCircle, Search, ClipboardList } from 'lucide-react';
import { useParcelOrders, useRealtimeSync } from '../hooks/useQueries';

export const ParcelOrdersScreen: React.FC = () => {
  const { hotel } = useRestaurantStore();
  const navigate = useNavigate();

  const hotelId = hotel?.id;

  // Real-time synchronization subscription
  useRealtimeSync(hotelId);

  // Fetch parcel orders register via TanStack Query
  const { data: orders = [], isLoading } = useParcelOrders(hotelId);

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [searchToken, setSearchToken] = useState('');

  // Filter parcel orders (status is 'active' for pending, and 'paid' for completed)
  const filteredParcels = React.useMemo(() => {
    return orders.filter((p) => {
      const matchesTab = activeTab === 'pending' ? p.status === 'active' : p.status === 'paid';
      const matchesSearch = p.parcel_token?.toLowerCase().includes(searchToken.toLowerCase()) || false;
      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchToken]);

  const pendingCount = React.useMemo(() => orders.filter(p => p.status === 'active').length, [orders]);
  const completedCount = React.useMemo(() => orders.filter(p => p.status === 'paid').length, [orders]);

  return (
    <MainLayout>
      <div className="space-y-4">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white">Parcel Orders</h2>
          <button
            onClick={() => navigate('/table-order/parcel')}
            className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs active-tap flex items-center gap-1"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Parcel</span>
          </button>
        </div>

        {/* Tab Selection Filter */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2 text-center rounded-lg text-xs font-black transition-all active-tap ${
              activeTab === 'pending' 
                ? 'bg-slate-950 text-amber-500 border border-slate-800' 
                : 'text-slate-400'
            }`}
          >
            Pending ({isLoading ? '...' : pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2 text-center rounded-lg text-xs font-black transition-all active-tap ${
              activeTab === 'completed' 
                ? 'bg-slate-950 text-amber-500 border border-slate-800' 
                : 'text-slate-400'
            }`}
          >
            Settle/Paid ({isLoading ? '...' : completedCount})
          </button>
        </div>

        {/* Instant Token Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search Token (e.g. P-001)..."
            value={searchToken}
            onChange={(e) => setSearchToken(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
          />
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
        </div>

        {/* Active List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredParcels.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/billing/${p.id}`)}
                className="p-4 bg-slate-900 hover:bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col gap-3 cursor-pointer transition-all active-tap"
              >
                
                {/* Order token and amount */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                      <Package className="w-4 h-4" />
                    </span>
                    <div className="text-left">
                      <span className="text-sm font-black text-white">{p.parcel_token}</span>
                      <span className="text-[10px] text-slate-500 block font-medium">
                        {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline font-black text-white gap-0.5">
                    <IndianRupee className="w-3.5 h-3.5 self-center text-amber-500" />
                    <span className="text-[15px]">{Number(p.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Items listing inside parcel */}
                <div className="text-[11px] text-slate-400 border-t border-slate-800/60 pt-2.5 text-left">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {p.order_items?.map((item) => (
                      <span key={item.id} className="font-semibold">
                        {item.menu_items?.name}{' '}
                        {item.menu_variants?.variant_name && (
                          <strong className="text-amber-500 font-medium">({item.menu_variants.variant_name})</strong>
                        )}{' '}
                        <strong className="text-slate-350">x{item.quantity}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Instant Status Button Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-800/60 pt-2.5">
                  {p.status === 'active' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/billing/${p.id}`);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase active-tap flex items-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3 stroke-[3]" />
                      <span>Collect Payment</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/billing/${p.id}`);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-extrabold text-[10px] uppercase active-tap flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Print Duplicate</span>
                    </button>
                  )}
                </div>

              </div>
            ))}

            {filteredParcels.length === 0 && (
              <div className="py-12 bg-slate-900/50 border border-slate-900/50 rounded-2xl text-center space-y-2">
                <ClipboardList className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-xs text-slate-500 italic">No {activeTab} parcels found.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </MainLayout>
  );
};
