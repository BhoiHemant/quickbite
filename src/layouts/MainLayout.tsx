import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Grid3X3, Package, UtensilsCrossed, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useRestaurantStore } from '../store/useRestaurantStore';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { logout, isMock } = useAuth();
  const { hotel } = useRestaurantStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
    { to: '/tables', label: 'Tables', icon: Grid3X3 },
    { to: '/parcels', label: 'Parcels', icon: Package },
    { to: '/menu', label: 'Menu', icon: UtensilsCrossed }
  ];

  return (
    <div className="min-h-screen min-h-svh bg-slate-950 text-slate-100 flex select-none">
      
      {/* ========================================================
          1. DESKTOP/TABLET LEFT SIDEBAR NAVIGATION (lg:flex, hidden on mobile)
          ======================================================== */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 fixed left-0 top-0 bottom-0 z-30 justify-between p-5">
        <div className="space-y-6">
          {/* Logo Branding */}
          <div className="flex flex-col border-b border-slate-800 pb-4 text-left">
            <span className="text-xl font-black tracking-tight text-white">
              Quick<span className="text-amber-500">Bite</span>
            </span>
            {hotel ? (
              <span className="text-xs text-slate-400 font-semibold mt-1 truncate" title={hotel.name}>
                {hotel.name}
              </span>
            ) : (
              <span className="text-xs text-amber-500/80 font-semibold mt-1">Pending Setup</span>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 text-left">
            {navItems.map((item) => (
              <NavLink 
                key={item.to}
                to={item.to}
                className={({ isActive }) => 
                  `flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black transition-all active-tap ${
                    isActive 
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="space-y-4 border-t border-slate-800 pt-4">
          {/* Connection Status Badge */}
          {isMock ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <WifiOff className="w-4 h-4 animate-pulse" />
              <span>Offline Sandbox</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wifi className="w-4 h-4" />
              <span>Connection Online</span>
            </div>
          )}

          {/* Logout Action */}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black text-rose-500 hover:bg-rose-500/10 transition-all active-tap text-left"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Log Out Profile</span>
          </button>
        </div>
      </aside>

      {/* ========================================================
          2. MOBILE TOP HEADER (lg:hidden, sticky for touch navigation)
          ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 flex lg:hidden items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
          <div className="flex flex-col text-left">
            <span className="text-lg font-bold tracking-tight text-amber-500">QuickBite</span>
            {hotel ? (
              <span className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]">
                {hotel.name}
              </span>
            ) : (
              <span className="text-[11px] text-amber-500/80">Pending Wizard</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status Badge */}
            {isMock ? (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <WifiOff className="w-3 h-3 animate-pulse" />
                <span>Sandbox</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wifi className="w-3 h-3" />
                <span>Online</span>
              </div>
            )}

            {/* Quick Logout */}
            <button 
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 active:bg-slate-800 active-tap"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ========================================================
            3. MAIN CONTENT CONTAINER (Fully fluid grids for all aspect ratios)
            ======================================================== */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 xl:p-10 overflow-y-auto">
          {children}
        </main>

        {/* ========================================================
            4. MOBILE ERGONOMIC BOTTOM NAV DOCK (lg:hidden, thumb reachable)
            ======================================================== */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 lg:hidden">
          <div className="flex items-center justify-around h-[68px] max-w-lg mx-auto">
            {navItems.map((item) => (
              <NavLink 
                key={item.to}
                to={item.to}
                className={({ isActive }) => 
                  `flex flex-col items-center justify-center w-full h-full text-slate-400 active-tap ${
                    isActive ? 'text-amber-500 font-extrabold' : ''
                  }`
                }
              >
                <item.icon className="w-[22px] h-[22px] mb-1" />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

    </div>
  );
};
