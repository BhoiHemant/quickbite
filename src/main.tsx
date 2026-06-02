import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ========================================================
// AUTOMATIC SANDBOX SCHEMA MIGRATION DETECTOR
// Checks if browser localStorage is holding legacy, separate items
// (e.g. items with 'price' properties, or names containing 'Half'/'Full').
// If found, it clears the stale cache once to mount our unified variant menu.
// ========================================================
try {
  const cachedStorage = localStorage.getItem('quickbite-restaurant-storage');
  if (cachedStorage) {
    const parsed = JSON.parse(cachedStorage);
    const menuItems = parsed.state?.menuItems || [];
    
    const hasStaleSchema = menuItems.some((m: any) => 
      'price' in m || 
      m.name.toLowerCase().includes('half ') || 
      m.name.toLowerCase().includes('full ') ||
      m.name.toLowerCase() === 'full manchurian' ||
      m.name.toLowerCase() === 'half manchurian'
    );

    if (hasStaleSchema) {
      console.log('Stale local storage seeder detected. Resetting cache to initialize unified variant menu...');
      localStorage.removeItem('quickbite-restaurant-storage');
      // Perform a clean reload to initialize the mock data fresh
      window.location.href = window.location.origin + window.location.pathname;
    }
  }
} catch (err) {
  console.error('Migration check skipped:', err);
}

import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
