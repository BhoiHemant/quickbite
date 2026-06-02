import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRestaurantStore } from '../store/useRestaurantStore';
import { MainLayout } from '../layouts/MainLayout';
import { 
  IndianRupee, 
  ArrowLeft, 
  Coins, 
  QrCode, 
  CreditCard, 
  Printer, 
  Receipt 
} from 'lucide-react';
import { useOrder, useUpdateOrder } from '../hooks/useQueries';

export const BillingScreen: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const { hotel } = useRestaurantStore();
  const hotelId = hotel?.id;

  // Fetch the specific order from Supabase
  const { data: order, isLoading, error } = useOrder(orderId);
  const updateOrderMutation = useUpdateOrder();

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');

  const showBillLabel = useMemo(() => {
    if (!order) return '';
    return order.order_type === 'parcel' 
      ? order.parcel_token || 'Parcel Order' 
      : order.restaurant_tables?.table_name || 'Dine-In';
  }, [order]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="py-12 text-center text-slate-500 space-y-3">
          <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin mx-auto" />
          <p className="text-xs">Fetching invoice details...</p>
        </div>
      </MainLayout>
    );
  }

  if (error || !order || !hotelId) {
    return (
      <MainLayout>
        <div className="py-12 text-center text-slate-500 space-y-3">
          <Receipt className="w-12 h-12 text-slate-700 mx-auto" />
          <p className="text-xs">Invoice or configuration not found.</p>
          <button 
            onClick={() => navigate('/')}
            className="text-xs text-amber-500 font-bold underline"
          >
            Go Home
          </button>
        </div>
      </MainLayout>
    );
  }

  const handleSettle = () => {
    if (order.status === 'paid') {
      // Just trigger print utility for settled order duplicate
      window.print();
      return;
    }

    updateOrderMutation.mutate({
      orderId: order.id,
      status: 'paid',
      hotelId
    }, {
      onSuccess: () => {
        // Trigger thermal receipt print layout
        setTimeout(() => {
          window.print();
          
          // Redirect based on type
          if (order.order_type === 'parcel') {
            navigate('/parcels');
          } else {
            navigate('/tables');
          }
        }, 150);
      },
      onError: (err) => {
        alert('Failed to settle order: ' + (err as Error).message);
      }
    });
  };

  return (
    <>
      {/* Standard App View (Hidden during print via no-print class) */}
      <div className="no-print">
        <MainLayout>
          <div className="space-y-5">
            
            {/* Header Row */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <button 
                onClick={() => navigate(order.order_type === 'parcel' ? '/parcels' : '/tables')}
                className="flex items-center gap-1.5 text-xs text-slate-400 font-bold active-tap"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Settle Invoice
              </h2>

              <span className="text-[10px] font-black uppercase bg-slate-900 text-amber-500 px-3 py-1 rounded-full border border-slate-800">
                {showBillLabel}
              </span>
            </div>

            {/* Bill Summary Receipt Card */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <div className="text-center space-y-1">
                <Receipt className="w-7 h-7 text-amber-500 mx-auto" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Order Items</h3>
                <span className="text-[9px] text-slate-500 font-bold">
                  Order ID: {order.id.slice(0, 8).toUpperCase()} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Items List */}
              <div className="border-t border-dashed border-slate-800/80 pt-3 space-y-2 max-h-[160px] overflow-y-auto no-scrollbar">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-350 text-left">
                      {item.menu_items?.name}
                      {item.menu_variants?.variant_name && (
                        <span className="text-amber-500/90 font-medium text-[10px] ml-1">
                          ({item.menu_variants.variant_name})
                        </span>
                      )}{' '}
                      <strong className="text-white">x{item.quantity}</strong>
                    </span>
                    <span className="text-slate-200">
                      ₹{(Number(item.item_price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grand Total */}
              <div className="border-t border-dashed border-slate-800/80 pt-3.5 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-400">Grand Total</span>
                <div className="flex items-baseline text-amber-500 font-black">
                  <IndianRupee className="w-4 h-4 self-center stroke-[3]" />
                  <span className="text-xl">{Number(order.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Tactile Payment Methods Grid */}
            <div className="space-y-2.5">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">
                Select Payment Mode
              </span>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 active-tap transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Coins className="w-5 h-5 stroke-[2.5]" />
                  <span className="text-[10px] font-black uppercase">Cash</span>
                </button>

                <button
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 active-tap transition-all ${
                    paymentMethod === 'upi'
                      ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode className="w-5 h-5 stroke-[2.5]" />
                  <span className="text-[10px] font-black uppercase">UPI / QR</span>
                </button>

                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 active-tap transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CreditCard className="w-5 h-5 stroke-[2.5]" />
                  <span className="text-[10px] font-black uppercase">Card</span>
                </button>
              </div>
            </div>

            {/* UPI Dynamic QR Code Drawer */}
            {paymentMethod === 'upi' && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center text-center space-y-2">
                <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-800">
                  <div className="w-[120px] h-[120px] bg-slate-950 flex flex-wrap p-1.5 gap-[2px] opacity-90 animate-pulse">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-[26px] h-[26px] rounded-sm ${
                          i % 3 === 0 ? 'bg-amber-500' : i % 2 === 0 ? 'bg-white' : 'bg-slate-950'
                        }`} 
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-black text-slate-200">Scan for Instant Payment</span>
                  <span className="text-[9px] text-slate-500 block font-bold uppercase">
                    ₹{Number(order.total_amount).toFixed(2)} • {hotel.name} Terminal
                  </span>
                </div>
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              onClick={handleSettle}
              disabled={updateOrderMutation.isPending}
              className="w-full h-13 rounded-2xl bg-amber-500 text-slate-950 font-black active-tap flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Printer className="w-5 h-5" />
              <span>
                {updateOrderMutation.isPending 
                  ? 'Processing Settlement...' 
                  : order.status === 'paid' 
                  ? 'Print Duplicate Bill' 
                  : 'Print & Settle Order'}
              </span>
            </button>

          </div>
        </MainLayout>
      </div>

      {/* ========================================================
          THERMAL PRINT RECEIPT CONTAINER (Activated only during printing)
          ======================================================== */}
      <div className="hidden print:block print-container">
        <div className="print-text-center">
          <h2 className="print-bold" style={{ fontSize: '18px', margin: '0 0 4px 0' }}>
            {hotel?.name || 'QuickBite Stall'}
          </h2>
          <p style={{ margin: '0 0 2px 0' }}>Owner: {hotel?.owner_name}</p>
          <p style={{ margin: '0 0 8px 0' }}>Ph: {hotel?.phone}</p>
          <div className="print-divider"></div>
          <h3 className="print-bold" style={{ margin: '4px 0' }}>
            INVOICE ({order.order_type.toUpperCase()})
          </h3>
          <p style={{ margin: '2px 0' }}>Ref: {showBillLabel}</p>
          <p style={{ margin: '2px 0' }}>
            Date: {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="print-divider"></div>

        {/* Itemized Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid black' }}>
              <th style={{ textAlign: 'left' }} className="print-bold">Item</th>
              <th style={{ textAlign: 'center' }} className="print-bold">Qty</th>
              <th style={{ textAlign: 'right' }} className="print-bold">Price</th>
              <th style={{ textAlign: 'right' }} className="print-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((oi) => (
              <tr key={oi.id}>
                <td style={{ padding: '4px 0', textAlign: 'left' }}>
                  {oi.menu_items?.name}
                  {oi.menu_variants?.variant_name && ` (${oi.menu_variants.variant_name})`}
                </td>
                <td style={{ textAlign: 'center', padding: '4px 0' }}>{oi.quantity}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{Number(oi.item_price).toFixed(0)}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{(Number(oi.item_price) * oi.quantity).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-divider"></div>

        {/* Totals Summary */}
        <div style={{ fontSize: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>Subtotal</span>
            <span>₹{Number(order.total_amount).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }} className="print-bold">
            <span>GRAND TOTAL</span>
            <span>₹{Number(order.total_amount).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '10px', fontStyle: 'italic' }}>
            <span>Payment Mode:</span>
            <span>{paymentMethod.toUpperCase()}</span>
          </div>
        </div>

        <div className="print-divider"></div>

        <div className="print-text-center" style={{ fontSize: '10px', marginTop: '10px' }}>
          <p className="print-bold">Thank You! Visit Again.</p>
          <p>Powered by QuickBite Terminal</p>
        </div>
      </div>
    </>
  );
};
