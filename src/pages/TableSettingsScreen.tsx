import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useRestaurantStore } from '../store/useRestaurantStore';
import { MainLayout } from '../layouts/MainLayout';
import * as api from '../api/restaurantApi';
import { useTables } from '../hooks/useQueries';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  ToggleLeft, 
  ToggleRight, 
  Settings, 
  Grid 
} from 'lucide-react';
import type { Table } from '../types';

export const TableSettingsScreen: React.FC = () => {
  const { hotel } = useRestaurantStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const hotelId = hotel?.id;

  // Fetch current tables
  const { data: tables = [], isLoading } = useTables(hotelId);
  const [newTableName, setNewTableName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidateTables = () => {
    queryClient.invalidateQueries({ queryKey: ['tables', hotelId] });
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim() || !hotelId) return;

    setIsSubmitting(true);
    try {
      const nextDisplayOrder = tables.length > 0 
        ? Math.max(...tables.map(t => t.display_order)) + 1 
        : 0;

      await api.createTable(hotelId, newTableName.trim(), nextDisplayOrder);
      setNewTableName('');
      invalidateTables();
    } catch (err) {
      console.error('Error adding table:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRename = async (tableId: string, name: string) => {
    try {
      // Optimistic cache update for buttery smooth typing
      queryClient.setQueryData(['tables', hotelId], (oldData: Table[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(t => t.id === tableId ? { ...t, table_name: name } : t);
      });

      await api.updateTable(tableId, { table_name: name });
    } catch (err) {
      console.error('Error renaming table:', err);
      invalidateTables();
    }
  };

  const handleToggleActive = async (table: Table) => {
    try {
      // Optimistic update
      queryClient.setQueryData(['tables', hotelId], (oldData: Table[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(t => t.id === table.id ? { ...t, active: !table.active } : t);
      });

      await api.updateTable(table.id, { active: !table.active });
      invalidateTables();
    } catch (err) {
      console.error('Error toggling table active state:', err);
      invalidateTables();
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    
    try {
      await api.deleteTable(tableId);
      invalidateTables();
    } catch (err) {
      console.error('Error deleting table:', err);
    }
  };

  // Move table display order up (swap with previous item)
  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const tableA = tables[index];
    const tableB = tables[index - 1];

    try {
      // Swapping display orders in parallel
      await Promise.all([
        api.updateTable(tableA.id, { display_order: tableB.display_order }),
        api.updateTable(tableB.id, { display_order: tableA.display_order })
      ]);
      invalidateTables();
    } catch (err) {
      console.error('Error swapping display order up:', err);
    }
  };

  // Move table display order down (swap with next item)
  const handleMoveDown = async (index: number) => {
    if (index === tables.length - 1) return;
    const tableA = tables[index];
    const tableB = tables[index + 1];

    try {
      // Swapping display orders in parallel
      await Promise.all([
        api.updateTable(tableA.id, { display_order: tableB.display_order }),
        api.updateTable(tableB.id, { display_order: tableA.display_order })
      ]);
      invalidateTables();
    } catch (err) {
      console.error('Error swapping display order down:', err);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <button 
            onClick={() => navigate('/tables')}
            className="flex items-center gap-1.5 text-xs text-slate-400 font-bold active-tap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tables</span>
          </button>
          
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-amber-500" />
            <span>Table Settings</span>
          </h2>
        </div>

        {/* Add Table form */}
        <form onSubmit={handleAddTable} className="flex gap-2 p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <input
            type="text"
            required
            placeholder="e.g. VIP Room, Corner Table"
            value={newTableName}
            disabled={isSubmitting}
            onChange={(e) => setNewTableName(e.target.value)}
            className="flex-1 h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 text-xs disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 px-4 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs active-tap flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add</span>
          </button>
        </form>

        {/* Dynamic Table items list */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-slate-800 border-t-amber-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {tables.map((t, idx) => (
              <div
                key={t.id}
                className={`p-3 bg-slate-900 border rounded-xl flex flex-col gap-3 transition-opacity ${
                  !t.active ? 'opacity-50 border-slate-800' : 'border-slate-800/80'
                }`}
              >
                
                {/* Row 1: Rename Input and Status Actions */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="p-1.5 bg-slate-950 rounded-lg text-slate-500 border border-slate-800 shrink-0">
                      <Grid className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={t.table_name}
                      onChange={(e) => handleRename(t.id, e.target.value)}
                      className="w-full h-9 px-2 rounded-lg bg-slate-950 border border-slate-850 text-white font-bold text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleActive(t)}
                      className="p-1 rounded text-slate-400 active-tap"
                      title={t.active ? 'Disable Table' : 'Enable Table'}
                    >
                      {t.active ? (
                        <ToggleRight className="w-6 h-6 text-amber-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-700" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleDeleteTable(t.id)}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-rose-500 active-tap"
                      title="Delete Table"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Reordering buttons (move up / down) */}
                <div className="flex items-center justify-between border-t border-slate-800/50 pt-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">
                  <span>Display Order</span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-350 disabled:opacity-30 disabled:pointer-events-none active-tap"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === tables.length - 1}
                      className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-350 disabled:opacity-30 disabled:pointer-events-none active-tap"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            ))}

            {tables.length === 0 && (
              <div className="py-12 text-center text-slate-500 italic text-xs">
                No tables in restaurant configuration.
              </div>
            )}
          </div>
        )}

      </div>
    </MainLayout>
  );
};
