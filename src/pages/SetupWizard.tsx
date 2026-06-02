import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurantStore } from '../store/useRestaurantStore';
import * as api from '../api/restaurantApi';
import { Utensils, ClipboardEdit, PhoneCall, Grid, CheckCircle2 } from 'lucide-react';

export const SetupWizard: React.FC = () => {
  const [hotelName, setHotelName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [numberOfTables, setNumberOfTables] = useState(6);
  const [loading, setLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const { setHotel, currentUserId } = useRestaurantStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWizardError(null);

    if (!hotelName.trim() || !ownerName.trim() || !phone.trim()) {
      setWizardError('Please fill in all fields');
      return;
    }

    if (!currentUserId) {
      setWizardError('No authenticated user profile found. Please re-login.');
      return;
    }

    setLoading(true);
    try {
      // Commit Hotel & provision Tables directly to Supabase!
      const newHotel = await api.createHotel(
        currentUserId,
        hotelName.trim(),
        ownerName.trim(),
        phone.trim(),
        numberOfTables
      );

      // Save to lightweight Zustand cache
      setHotel(newHotel);
      
      // Seed default menu items for a new hotel
      await api.createMenuItem(newHotel.id, 'Veg Hakka Noodles', 'Chinese', [
        { variant_name: 'Half', price: 70 },
        { variant_name: 'Full', price: 120 }
      ]);
      await api.createMenuItem(newHotel.id, 'Adrak Elaichi Chai', 'Beverages', [
        { variant_name: 'Cup', price: 20 },
        { variant_name: 'Flask', price: 60 }
      ]);
      await api.createMenuItem(newHotel.id, 'Vada Pav', 'Snacks', [
        { variant_name: 'Piece', price: 25 }
      ]);

      navigate('/');
    } catch (err: any) {
      setWizardError(err.message || 'Initialization failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-screen min-h-svh bg-slate-950 px-6 py-8 text-slate-100 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm mx-auto space-y-6">
        
        {/* Step Indicator */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Setup Wizard</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Configure Restaurant</h1>
          <p className="text-xs text-slate-400">
            Let's customize your tables and default menu items to start taking orders.
          </p>
        </div>

        {/* Error Banner */}
        {wizardError && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs text-center font-bold">
            {wizardError}
          </div>
        )}

        {/* Wizard Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              <Utensils className="w-3.5 h-3.5 text-amber-500" />
              <span>Hotel / Restaurant Name</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Chai Point or Chow Mein Express"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 transition-colors text-xs"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              <ClipboardEdit className="w-3.5 h-3.5 text-amber-500" />
              <span>Owner Name</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 transition-colors text-xs"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-amber-500" />
              <span>Mobile Phone Number</span>
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 transition-colors text-xs"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              <Grid className="w-3.5 h-3.5 text-amber-500" />
              <span>Dine-In Tables count ({numberOfTables})</span>
            </label>
            
            <div className="flex items-center gap-4 mt-2">
              <button
                type="button"
                onClick={() => setNumberOfTables(Math.max(1, numberOfTables - 1))}
                className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 font-bold active-tap text-slate-300"
              >
                -
              </button>
              <div className="flex-1 text-center font-bold text-xs text-white uppercase tracking-wider">
                {numberOfTables} Tables
              </div>
              <button
                type="button"
                onClick={() => setNumberOfTables(Math.min(100, numberOfTables + 1))}
                className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 font-bold active-tap text-slate-300"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-6 rounded-xl bg-amber-500 text-slate-950 font-bold active-tap flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{loading ? 'Configuring Database...' : 'Launch SaaS Store & Seed Menu'}</span>
          </button>
        </form>

      </div>
    </div>
  );
};
