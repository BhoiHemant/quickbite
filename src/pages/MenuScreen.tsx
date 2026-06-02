import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRestaurantStore } from '../store/useRestaurantStore';
import { MainLayout } from '../layouts/MainLayout';
import * as api from '../api/restaurantApi';
import { useMenuItems } from '../hooks/useQueries';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  ToggleLeft, 
  ToggleRight, 
  Check, 
  UtensilsCrossed 
} from 'lucide-react';
import type { MenuItem } from '../types';

export const MenuScreen: React.FC = () => {
  const { hotel } = useRestaurantStore();
  const queryClient = useQueryClient();

  const hotelId = hotel?.id;

  // Fetch menu catalog from Supabase via TanStack Query
  const { data: menuItems = [], isLoading } = useMenuItems(hotelId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Drawer/Modal Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [enableVariants, setEnableVariants] = useState(true);
  const [formVariants, setFormVariants] = useState<{ variant_name: string; price: number }[]>([
    { variant_name: 'Full', price: 120 }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const invalidateMenu = () => {
    queryClient.invalidateQueries({ queryKey: ['menuItems', hotelId] });
  };

  // Extract categories for horizontal scrolling filter list
  const categories = useMemo(() => {
    const list = new Set(menuItems.map(item => item.category));
    return ['All', ...Array.from(list)];
  }, [menuItems]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  const handleOpenAddForm = () => {
    setEditingItem(null);
    setName('');
    setCategory(categories[1] || 'Beverages');
    setIsActive(true);
    setEnableVariants(true);
    setFormVariants([{ variant_name: 'Full', price: 120 }, { variant_name: 'Half', price: 70 }]);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setIsActive(item.active);
    setFormError(null);
    
    // Load variants from nested list
    const vars = item.menu_variants || [];
    if (vars.length > 0) {
      setFormVariants(vars.map(v => ({ variant_name: v.variant_name, price: Number(v.price) })));
      
      // If there's exactly one variant named 'Regular', treat it as a standard/non-variant item
      const isStandardItem = vars.length === 1 && vars[0].variant_name === 'Regular';
      setEnableVariants(!isStandardItem);
    } else {
      setFormVariants([{ variant_name: 'Regular', price: 0 }]);
      setEnableVariants(false);
    }
    
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    console.log('[Menu Audit Log] STEP 1: Form submit triggered');

    if (!name.trim()) {
      setFormError('Please enter an item name');
      console.warn('[Menu Audit Log] Validation failed: Missing Item Name');
      return;
    }
    if (!category.trim()) {
      setFormError('Please enter a category name');
      console.warn('[Menu Audit Log] Validation failed: Missing Category Name');
      return;
    }
    if (!hotelId) {
      setFormError('Configuration error: Missing hotel_id');
      console.warn('[Menu Audit Log] Validation failed: Missing hotel_id');
      return;
    }

    // Filter out blank variants or NaN prices
    let validVariants = formVariants.filter(
      v => v.variant_name.trim() !== '' && !isNaN(v.price) && v.price >= 0
    );

    if (!enableVariants) {
      // Force it to a single 'Regular' standard variant behind the scenes
      validVariants = [{ variant_name: 'Regular', price: formVariants[0]?.price || 0 }];
    }

    if (validVariants.length === 0) {
      setFormError('Please configure at least one valid price variant');
      console.warn('[Menu Audit Log] Validation failed: No valid variants configured');
      return;
    }

    console.log('[Menu Audit Log] STEP 2: Validation passed');

    const payload = {
      hotel_id: hotelId,
      name: name.trim(),
      category: category.trim(),
      active: isActive,
      variants: validVariants
    };
    console.log('[Menu Audit Log] STEP 3: Payload generated:', JSON.stringify(payload, null, 2));

    setIsSubmitting(true);
    try {
      if (editingItem) {
        console.log('[Menu Audit Log] STEP 4: Supabase update request sent for ID:', editingItem.id);
        await api.updateMenuItem(editingItem.id, {
          name: name.trim(),
          category: category.trim(),
          active: isActive
        }, validVariants);
        console.log('[Menu Audit Log] STEP 5: Supabase response received (Update successful)');
      } else {
        console.log('[Menu Audit Log] STEP 4: Supabase insert request sent');
        const newItem = await api.createMenuItem(hotelId, name.trim(), category.trim(), validVariants, isActive);
        console.log('[Menu Audit Log] STEP 5: Supabase response received (Insert successful):', JSON.stringify(newItem, null, 2));
      }

      console.log('[Menu Audit Log] STEP 6: React Query cache invalidated');
      invalidateMenu();

      console.log('[Menu Audit Log] STEP 7: Menu list refreshed');
      
      // Show elegant success alert
      setSuccessToast(editingItem ? '✅ Menu Item Updated Successfully' : '✅ Menu Item Created Successfully');
      setTimeout(() => {
        setSuccessToast(null);
      }, 4000);

      setIsFormOpen(false);
    } catch (err: any) {
      console.error('[Menu Audit Log] Database execution failed:', err);
      // Detailed human-friendly translation of database/Supabase errors
      const errorMsg = err?.message || String(err);
      if (errorMsg.includes('row-level security') || errorMsg.includes('42501')) {
        setFormError('RLS policy blocked insert. Verify your owner registration status.');
      } else if (errorMsg.includes('foreign key') || errorMsg.includes('23503')) {
        setFormError('Database integrity violation: Missing hotel_id reference.');
      } else if (errorMsg.includes('duplicate key') || errorMsg.includes('23505')) {
        setFormError('A variant with this name already exists for this item.');
      } else {
        setFormError(`Database connection failed: ${errorMsg}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: MenuItem) => {
    try {
      // Optimistic cache update for seamless toggles
      queryClient.setQueryData(['menuItems', hotelId], (oldData: MenuItem[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(m => m.id === item.id ? { ...m, active: !item.active } : m);
      });

      await api.updateMenuItem(item.id, { active: !item.active });
      invalidateMenu();
    } catch (err) {
      console.error('Error toggling menu item status:', err);
      invalidateMenu();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;

    try {
      await api.deleteMenuItem(itemId);
      invalidateMenu();
    } catch (err) {
      console.error('Error deleting menu item:', err);
    }
  };

  const handleAddFormVariantRow = () => {
    setFormVariants([...formVariants, { variant_name: '', price: 0 }]);
  };

  const handleRemoveFormVariantRow = (index: number) => {
    setFormVariants(formVariants.filter((_, i) => i !== index));
  };

  const handleVariantRowChange = (index: number, field: 'name' | 'price', value: string) => {
    const updated = [...formVariants];
    if (field === 'name') {
      updated[index].variant_name = value;
    } else {
      updated[index].price = parseFloat(value) || 0;
    }
    setFormVariants(updated);
  };

  return (
    <MainLayout>
      {/* Success Toast Notification Banner */}
      {successToast && (
        <div className="fixed top-4 right-4 z-[9999] bg-emerald-600 text-white font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-500 animate-in slide-in-from-top-4 duration-300">
          <Check className="w-4 h-4 shrink-0 stroke-[3]" />
          <span>{successToast}</span>
        </div>
      )}

      <div className="space-y-4">
        
        {/* Screen Title & Add Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white">Menu Management</h2>
          <button
            onClick={handleOpenAddForm}
            className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs active-tap flex items-center gap-1"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Item</span>
          </button>
        </div>

        {/* Categories sliding list filter */}
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

        {/* Dynamic Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search items to edit or disable..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
          />
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
        </div>

        {/* Product Catalog Items list */}
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const itemVars = item.menu_variants || [];
              const isStandardOnly = itemVars.length === 1 && itemVars[0].variant_name === 'Regular';
              
              return (
                <div
                  key={item.id}
                  className={`p-3.5 bg-slate-900 border rounded-xl flex flex-col gap-2.5 transition-colors border-slate-800/80 ${
                    !item.active ? 'opacity-50' : ''
                  }`}
                >
                  {/* Row 1: Icon, Title, Actions */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="p-2 bg-slate-950 rounded-xl text-slate-400 border border-slate-800 shrink-0">
                        <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                      </span>
                      
                      <div className="space-y-0.5 text-left">
                        <h3 className="text-sm font-black text-white">{item.name}</h3>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className="p-1 rounded text-slate-400 active-tap"
                        title={item.active ? 'Mark Inactive' : 'Mark Active'}
                      >
                        {item.active ? (
                          <ToggleRight className="w-6 h-6 text-amber-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-700" />
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenEditForm(item)}
                        className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-350 hover:text-white active-tap"
                        title="Edit Item"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-rose-500 active-tap"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Chip display of current variants and prices */}
                  <div className="flex flex-wrap gap-1.5 border-t border-slate-850 pt-2.5">
                    {isStandardOnly ? (
                      <span className="text-[10px] text-slate-400 font-bold">
                        Standard Price: <strong className="text-amber-500 font-extrabold text-xs">₹{Number(itemVars[0].price).toFixed(2)}</strong>
                      </span>
                    ) : (
                      itemVars.map((v) => (
                        <span 
                          key={v.id} 
                          className="text-[9px] bg-slate-950 border border-slate-800/80 text-slate-400 font-extrabold px-2 py-0.5 rounded animate-in fade-in duration-200"
                        >
                          {v.variant_name}: <strong className="text-amber-500">₹{Number(v.price).toFixed(0)}</strong>
                        </span>
                      ))
                    )}
                    {itemVars.length === 0 && (
                      <span className="text-[9px] text-rose-400 italic">No variants configured.</span>
                    )}
                  </div>

                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="py-12 text-center text-slate-500 italic text-xs">
                No items in menu catalog.
              </div>
            )}
          </div>
        )}

        {/* Dynamic bottom-sheet styled catalog builder drawer */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
              
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2.5">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {editingItem ? 'Edit Menu Item' : 'New Menu Item'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-350 active-tap"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                {/* Form Error Banner */}
                {formError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold leading-normal flex items-start gap-2 animate-in fade-in duration-200">
                    <span className="shrink-0 font-extrabold text-[13px] leading-none">⚠️</span>
                    <span>{formError}</span>
                  </div>
                )}
                {/* Item Name */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Veg Hakka Noodles, Adrak Chai"
                    value={name}
                    disabled={isSubmitting}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 text-xs disabled:opacity-50"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chinese, Beverages, Snacks"
                    value={category}
                    disabled={isSubmitting}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 text-xs disabled:opacity-50"
                  />
                </div>

                {/* Enable Variants Switch */}
                <div className="flex items-center justify-between py-1 px-1 border-t border-b border-slate-800/50 my-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Enable Item Variants (Full/Half)
                  </span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      const nextVal = !enableVariants;
                      setEnableVariants(nextVal);
                      if (!nextVal) {
                        setFormVariants([{ variant_name: 'Regular', price: formVariants[0]?.price || 100 }]);
                      } else {
                        setFormVariants([{ variant_name: 'Full', price: 120 }, { variant_name: 'Half', price: 70 }]);
                      }
                    }}
                    className="p-1 rounded text-slate-400 active-tap disabled:opacity-50"
                  >
                    {enableVariants ? (
                      <ToggleRight className="w-7 h-7 text-amber-500" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-700" />
                    )}
                  </button>
                </div>

                {/* Display either single standard price or dynamic variant row builder */}
                {!enableVariants ? (
                  /* Standard Single Price Input */
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Standard Price (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g. 50"
                      disabled={isSubmitting}
                      value={formVariants[0]?.price || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormVariants([{ variant_name: 'Regular', price: val }]);
                      }}
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 text-xs disabled:opacity-50"
                    />
                  </div>
                ) : (
                  /* Dynamic Variants List row builder */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Configure Variants
                      </label>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleAddFormVariantRow}
                        className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[9px] font-black text-amber-500 uppercase active-tap disabled:opacity-50"
                      >
                        + Add Variant
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[140px] overflow-y-auto no-scrollbar pr-0.5">
                      {formVariants.map((v, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            required
                            placeholder="e.g. Full, Half"
                            disabled={isSubmitting}
                            value={v.variant_name === 'Regular' ? '' : v.variant_name}
                            onChange={(e) => handleVariantRowChange(idx, 'name', e.target.value)}
                            className="flex-1 h-9 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs disabled:opacity-50"
                          />
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="Price ₹"
                            disabled={isSubmitting}
                            value={v.price || ''}
                            onChange={(e) => handleVariantRowChange(idx, 'price', e.target.value)}
                            className="w-20 h-9 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs disabled:opacity-50"
                          />
                          {formVariants.length > 1 && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleRemoveFormVariantRow(idx)}
                              className="p-1.5 text-rose-500 bg-slate-950 border border-slate-800 rounded-lg active-tap shrink-0 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available in stock switch */}
                <div className="flex items-center justify-between py-1 px-1 border-t border-slate-850 pt-2.5">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wide">
                    Available in stock
                  </span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsActive(!isActive)}
                    className="p-1 rounded text-slate-400 active-tap disabled:opacity-50"
                  >
                    {isActive ? (
                      <ToggleRight className="w-7 h-7 text-amber-500" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-700" />
                    )}
                  </button>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-amber-500 text-slate-950 font-black active-tap flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    {isSubmitting 
                      ? 'Saving changes...' 
                      : editingItem 
                      ? 'Save Item Changes' 
                      : 'Add to Catalog'}
                  </span>
                </button>
              </form>

            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
};
