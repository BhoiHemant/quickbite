import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';
import { useRestaurantStore } from './store/useRestaurantStore';

// Screen Page Components
import { Login } from './pages/Login';
import { SetupWizard } from './pages/SetupWizard';
import { Dashboard } from './pages/Dashboard';
import { TablesScreen } from './pages/TablesScreen';
import { TableOrderScreen } from './pages/TableOrderScreen';
import { ParcelOrdersScreen } from './pages/ParcelOrdersScreen';
import { BillingScreen } from './pages/BillingScreen';
import { MenuScreen } from './pages/MenuScreen';
import { TableSettingsScreen } from './pages/TableSettingsScreen';
import { Diagnostics } from './pages/Diagnostics';
import { DatabaseHealthCheck } from './components/DatabaseHealthCheck';

// 1. Initialize TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents aggressive background refreshes
      retry: 1, // Rapid failure checks
      staleTime: 1000 * 30 // 30 seconds stale default
    }
  }
});

// 2. Protected Route Gate (Requires Auth AND completed Setup Wizard)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { hotel, setupCompleted } = useRestaurantStore();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen min-h-svh bg-slate-950 text-slate-400 gap-3 select-none text-center">
        <div className="w-9 h-9 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 animate-pulse">
          Initializing QuickBite...
        </span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hotel || !setupCompleted) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
};

// 3. Wizard Route Gate (Requires Auth, but block if hotel already set up)
const WizardRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { hotel, setupCompleted } = useRestaurantStore();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen min-h-svh bg-slate-950 text-slate-400 gap-3 select-none text-center">
        <div className="w-9 h-9 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 animate-pulse">
          Loading Setup...
        </span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (hotel && setupCompleted) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <DatabaseHealthCheck>
        <Router>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<Login />} />

            {/* Public Diagnostics Route */}
            <Route path="/diagnostics" element={<Diagnostics />} />

            {/* Setup Wizard Route (Requires auth, redirects if hotel already set up) */}
            <Route 
              path="/setup" 
              element={
                <WizardRoute>
                  <SetupWizard />
                </WizardRoute>
              } 
            />

            {/* Protected Dashboard Page */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />

            {/* Protected Tables Screen */}
            <Route 
              path="/tables" 
              element={
                <ProtectedRoute>
                  <TablesScreen />
                </ProtectedRoute>
              } 
            />

            {/* Protected Table Settings Screen */}
            <Route 
              path="/tables/settings" 
              element={
                <ProtectedRoute>
                  <TableSettingsScreen />
                </ProtectedRoute>
              } 
            />

            {/* Protected Table Order Page */}
            <Route 
              path="/table-order/:tableId" 
              element={
                <ProtectedRoute>
                  <TableOrderScreen />
                </ProtectedRoute>
              } 
            />

            {/* Protected Parcel Page Counter */}
            <Route 
              path="/parcels" 
              element={
                <ProtectedRoute>
                  <ParcelOrdersScreen />
                </ProtectedRoute>
              } 
            />

            {/* Protected Settle / Billing Page */}
            <Route 
              path="/billing/:orderId" 
              element={
                <ProtectedRoute>
                  <BillingScreen />
                </ProtectedRoute>
              } 
            />

            {/* Protected Menu Management Catalog */}
            <Route 
              path="/menu" 
              element={
                <ProtectedRoute>
                  <MenuScreen />
                </ProtectedRoute>
              } 
            />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </DatabaseHealthCheck>
    </QueryClientProvider>
  );
};

export default App;
