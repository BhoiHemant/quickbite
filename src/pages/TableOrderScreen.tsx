import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRestaurantStore } from '../store/useRestaurantStore';
import { MainLayout } from '../layouts/MainLayout';
import { 
  Plus, 
  Minus, 
  Search, 
  ArrowLeft, 
  Check, 
  FileText, 
  ShoppingCart, 
  CheckCircle
} from 'lucide-react';
import { useTables, useMenuItems, useOrders, useCreateOrder, useRealtimeSync } from '../hooks/useQueries';
import type { MenuItem, MenuVariant } from '../types';

export const TableOrderScreen: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  const { 
    hotel,
    dineInCarts, 
    parcelCart, 
    addToCart, 
    removeFromCart, 
    updateCartQuantity, 
    clearCart
  } = useRestaurantStore();

  const hotelId = hotel?.id;

  // Real-time synchronization
  useRealtimeSync(hotelId);

  // TanStack queries
  const { data: tables = [], isLoading: isTablesLoading } = useTables(hotelId);
  const { data: menuItems = [], isLoading: isMenuLoading } = useMenuItems(hotelId);
  const { data: activeOrders = [], isLoading: isOrdersLoading } = useOrders(hotelId);
  const createOrderMutation = useCreateOrder();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Smart Bottom Sheet Selector States
  const [activeItemForSheet, setActiveItemForSheet] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuVariant | null>(null);
  
  // Quick Success toast confirmation
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isParcel = !tableId || tableId === 'parcel';
  const table = tables.find((t) => t.id === tableId);

  // Active Cart Items (Drafts)
  const cartItems = useMemo(() => {
    if (isParcel) return parcelCart;
    return dineInCarts[tableId!] || [];
  }, [isParcel, parcelCart, dineInCarts, tableId]);

  // Existing order items if table already has an active order
  const existingOrder = useMemo(() => {
    if (isParcel || !tableId) return null;
    return activeOrders.find(o => o.order_type === 'table' && o.table_id === tableId);
  }, [isParcel, tableId, activeOrders]);

  // Categories list
  const categories = useMemo(() => {
    const list = new Set(menuItems.filter(item => item.active).map((item) => item.category));
    return ['All', ...Array.from(list)];
  }, [menuItems]);

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.active) return false;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  const cartItemCount = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);
  const cartTotalAmount = cartItems.reduce((sum, ci) => sum + ci.variant.price * ci.quantity, 0);

  const handleOpenVariantSheet = (item: MenuItem) => {
    const vars = item.menu_variants || [];
    if (vars.length === 0) return; // No variants config found
    
    if (vars.length === 1) {
      // Bypasses bottom sheet and instantly adds to cart since there's only one default variant!
      addToCart(isParcel ? null : tableId!, item, vars[0]);
      setToastMessage(`${item.name} added successfully!`);
      setTimeout(() => setToastMessage(null), 1500);
      return;
    }
    
    setActiveItemForSheet(item);
    setSelectedVariant(vars[0]); // Auto-select first variant
  };

  const handleAddVariantToOrder = () => {
    if (!activeItemForSheet || !selectedVariant) return;

    addToCart(isParcel ? null : tableId!, activeItemForSheet, selectedVariant);
    
    // Trigger brief success toast
    setToastMessage(`${activeItemForSheet.name} (${selectedVariant.variant_name}) added!`);
    setTimeout(() => setToastMessage(null), 2000);

    // Reset bottom sheet states
    setActiveItemForSheet(null);
    setSelectedVariant(null);
  };

  const handleQuantityAdjust = (itemId: string, variantId: string, change: number) => {
    const found = cartItems.find((ci) => ci.menuItem.id === itemId && ci.variant.id === variantId);
    if (!found) return;

    if (found.quantity + change <= 0) {
      removeFromCart(isParcel ? null : tableId!, itemId, variantId);
    } else {
      updateCartQuantity(isParcel ? null : tableId!, itemId, variantId, change);
    }
  };

  const handleConfirmOrder = () => {
    if (cartItems.length === 0 || !hotelId) return;

    const items = cartItems.map(ci => ({
      menuItemId: ci.menuItem.id,
      menuVariantId: ci.variant.id,
      quantity: ci.quantity,
      price: ci.variant.price
    }));

    createOrderMutation.mutate({
      hotelId,
      orderType: isParcel ? 'parcel' : 'table',
      tableId: isParcel ? null : tableId!,
      parcelToken: isParcel ? `P-${Date.now().toString().slice(-4)}` : null,
      items
    }, {
      onSuccess: (newOrder) => {
        clearCart(isParcel ? null : tableId!);
        if (isParcel) {
          navigate(`/billing/${newOrder.id}`);
        } else {
          navigate('/tables');
        }
      },
      onError: (err) => {
        alert('Failed to place order: ' + (err as Error).message);
      }
    });
  };

  const handleClear = () => {
    clearCart(isParcel ? null : tableId!);
  };

  const isScreenLoading = isTablesLoading || isMenuLoading || isOrdersLoading;

  return (
    <MainLayout>
      <div className="space-y-4 pb-28 lg:pb-6 relative text-left">
        
        {/* Floating brief success message */}
        {toastMessage && (
          <div className="fixed top-[70px] left-4 right-4 z-50 p-3.5 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle className="w-4 h-4 stroke-[3]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Responsive Dual Pane Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ========================================================
              LEFT COLUMN: MENU CATALOG (lg:col-span-7)
              ======================================================== */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Header with back button */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <button 
                onClick={() => navigate(isParcel ? '/' : '/tables')}
                className="flex items-center gap-1.5 text-xs text-slate-400 font-bold active-tap animate-in slide-in-from-left duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <h2 className="text-xs font-black text-white tracking-widest uppercase">
                {isParcel ? (
                  <span className="text-amber-500">NEW PARCEL ORDER</span>
                ) : (
                  <span>ORDERING: {table?.table_name}</span>
                )}
              </h2>

              <button
                onClick={handleClear}
                disabled={cartItems.length === 0}
                className="text-[10px] uppercase font-bold text-rose-500 disabled:opacity-40 active-tap"
              >
                Clear Draft
              </button>
            </div>

            {/* Tactile Category Pill Sliders */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 shrink-0 rounded-full text-xs font-black transition-all active-tap ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Double-Action Instant Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search Adrak Chai, Noodles, Burger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
              />
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            </div>

            {/* Menu Items Touch-friendly Grid Listing */}
            {isScreenLoading ? (
              <div className="flex justify-center items-center py-16">
                <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredMenuItems.map((item) => {
                  const vars = item.menu_variants || [];
                  const totalQtyInCart = cartItems
                    .filter(ci => ci.menuItem.id === item.id)
                    .reduce((sum, ci) => sum + ci.quantity, 0);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenVariantSheet(item)}
                      className={`p-3.5 bg-slate-900 hover:bg-slate-900/80 border rounded-xl flex items-center justify-between transition-all cursor-pointer select-none active-tap ${
                        totalQtyInCart > 0 ? 'border-amber-500/40 bg-amber-500/[0.01]' : 'border-slate-800'
                      }`}
                    >
                      <div className="space-y-1 text-left flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-black text-white truncate max-w-[150px]">{item.name}</h3>
                          {totalQtyInCart > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[9px] shrink-0">
                              x{totalQtyInCart}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider">
                            {item.category}
                          </span>
                          
                          <div className="flex gap-1 flex-wrap">
                            {vars.map(v => (
                              <span key={v.id} className="text-[9px] bg-slate-950 border border-slate-800/80 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                                {v.variant_name}: ₹{v.price}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-black uppercase text-amber-500 active-tap shrink-0">
                        + Add
                      </div>
                    </div>
                  );
                })}

                {filteredMenuItems.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-500 italic text-xs">
                    No items matching filter/search.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================
              RIGHT COLUMN: ACTIVE ORDERS & CART SUMMARY (lg:col-span-5)
              ======================================================== */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
            
            {/* Existing Order Display (KOT rounds already sent to kitchen) */}
            {existingOrder && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 pb-2">
                  <span>Sent to Kitchen (KOT)</span>
                  <span className="text-amber-500 font-black">Total: ₹{Number(existingOrder.total_amount).toFixed(2)}</span>
                </div>
                
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
                  {existingOrder.order_items?.map((oi) => (
                    <div key={oi.id} className="flex justify-between text-[11px] text-slate-350">
                      <span>
                        {oi.menu_items?.name}{' '}
                        {oi.menu_variants?.variant_name && (
                          <strong className="text-amber-500/90 font-medium">({oi.menu_variants.variant_name})</strong>
                        )}{' '}
                        <strong className="text-white font-black">x{oi.quantity}</strong>
                      </span>
                      <span>₹{(Number(oi.item_price) * oi.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate(`/billing/${existingOrder.id}`)}
                  className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-black uppercase text-amber-400 active-tap flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>Checkout & Settle Table Bill</span>
                </button>
              </div>
            )}

            {/* DRAFT ITEMS REVIEW BOARD (Shows Cart items in side panel on large viewports) */}
            {cartItems.length > 0 ? (
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-lg">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
                  <ShoppingCart className="w-4 h-4 text-amber-500" />
                  <span>Current Draft Items</span>
                </h3>

                <div className="space-y-3 max-h-[220px] overflow-y-auto no-scrollbar">
                  {cartItems.map((ci) => (
                    <div 
                      key={`${ci.menuItem.id}-${ci.variant.id}`} 
                      className="flex items-center justify-between text-xs font-bold"
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-white">{ci.menuItem.name}</span>
                        <span className="text-[9px] text-amber-500 font-bold uppercase mt-0.5">
                          {ci.variant.variant_name} (₹{ci.variant.price})
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleQuantityAdjust(ci.menuItem.id, ci.variant.id, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-slate-300 active-tap"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        
                        <span className="w-4 text-center text-sm font-black text-amber-500">
                          {ci.quantity}
                        </span>

                        <button
                          onClick={() => handleQuantityAdjust(ci.menuItem.id, ci.variant.id, 1)}
                          className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-slate-300 active-tap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal summary and submit actions for widescreen viewports */}
                <div className="border-t border-slate-800 pt-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400">Draft Total</span>
                    <span className="text-lg font-black text-amber-500">₹{cartTotalAmount.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={handleConfirmOrder}
                    disabled={createOrderMutation.isPending}
                    className="w-full h-12 rounded-xl bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider active-tap flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>{createOrderMutation.isPending ? 'Submitting...' : isParcel ? 'Settle & Print' : 'Confirm & Send KOT'}</span>
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center py-16 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl text-center space-y-2.5">
                <ShoppingCart className="w-8 h-8 text-slate-700" />
                <span className="text-xs text-slate-500 italic font-medium">Draft is vacant. Add items from the left catalog grid.</span>
              </div>
            )}
          </div>

        </div>

        {/* Sticky Double-Action Floating Bar (Only displays on mobile below lg breakpoint) */}
        {cartItems.length > 0 && (
          <div className="fixed bottom-[80px] left-4 right-4 z-30 max-w-lg mx-auto bg-amber-500 text-slate-950 px-4 py-3.5 rounded-2xl shadow-xl shadow-amber-500/10 flex lg:hidden items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black tracking-widest uppercase text-slate-950/70">
                {cartItemCount} In Draft
              </span>
              <div className="flex items-baseline font-black leading-none mt-0.5">
                <span className="text-lg">₹{cartTotalAmount.toFixed(0)}</span>
              </div>
            </div>

            <button
              onClick={handleConfirmOrder}
              disabled={createOrderMutation.isPending}
              className="px-5 py-2.5 bg-slate-950 text-amber-500 rounded-xl text-xs font-black tracking-wide uppercase active-tap flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{createOrderMutation.isPending ? 'Submitting...' : isParcel ? 'Settle & Print' : 'Confirm Order'}</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================
            SMART VARIANT SELECTION BOTTOM SHEET MODAL
            ======================================================== */}
        {activeItemForSheet && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 select-none">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
              
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2.5">
                <div className="flex flex-col text-left">
                  <span className="text-[9px] uppercase font-black tracking-widest text-slate-500">Select Variant</span>
                  <h3 className="text-sm font-black text-white">
                    {activeItemForSheet.name}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setActiveItemForSheet(null);
                    setSelectedVariant(null);
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 active-tap"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-2">
                {(activeItemForSheet.menu_variants || []).map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`p-4 rounded-2xl border text-left flex justify-between items-center transition-all cursor-pointer active-tap ${
                        isSelected
                          ? 'bg-amber-500 border-amber-500 text-slate-950'
                          : 'bg-slate-950 border-slate-800 text-slate-350 hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-black uppercase tracking-wider">{v.variant_name}</span>
                      <div className="flex items-baseline font-black gap-0.5">
                        <span className="text-xs">₹</span>
                        <span className="text-sm">{v.price}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleAddVariantToOrder}
                disabled={!selectedVariant}
                className="w-full h-12 rounded-xl bg-amber-500 text-slate-950 font-black active-tap flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Add To Order</span>
              </button>

            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
};
