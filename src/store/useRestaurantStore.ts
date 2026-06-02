import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Hotel, CartItem, MenuItem, MenuVariant } from '../types';

export interface AuthUser {
  id: string;
  email: string;
  role: 'owner';
}

interface RestaurantState {
  hotel: Hotel | null;
  dineInCarts: { [tableId: string]: CartItem[] };
  parcelCart: CartItem[];
  currentUserId: string | null;
  setupCompleted: boolean;
  
  // Global Auth State
  user: AuthUser | null;
  authLoading: boolean;
  authError: string | null;
  authInitialized: boolean;
  
  // Actions
  setHotel: (hotel: Hotel | null) => void;
  setUserId: (userId: string | null) => void;
  setSetupCompleted: (setupCompleted: boolean) => void;
  setUser: (user: AuthUser | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  setAuthInitialized: (initialized: boolean) => void;
  clearAllData: () => void;
  
  // Transient Cart Actions
  addToCart: (tableId: string | null, item: MenuItem, variant: MenuVariant) => void;
  removeFromCart: (tableId: string | null, itemId: string, variantId: string) => void;
  updateCartQuantity: (tableId: string | null, itemId: string, variantId: string, change: number) => void;
  clearCart: (tableId: string | null) => void;
}

export const useRestaurantStore = create<RestaurantState>()(
  persist(
    (set) => ({
      hotel: null,
      dineInCarts: {},
      parcelCart: [],
      currentUserId: null,
      setupCompleted: false,

      // Initial Auth States
      user: null,
      authLoading: true,
      authError: null,
      authInitialized: false,

      setHotel: (hotel) => set({ hotel }),
      setUserId: (currentUserId) => set({ currentUserId }),
      setSetupCompleted: (setupCompleted) => set({ setupCompleted }),
      setUser: (user) => set({ user }),
      setAuthLoading: (authLoading) => set({ authLoading }),
      setAuthError: (authError) => set({ authError }),
      setAuthInitialized: (authInitialized) => set({ authInitialized }),

      clearAllData: () => {
        set({
          hotel: null,
          dineInCarts: {},
          parcelCart: [],
          currentUserId: null,
          setupCompleted: false,
          user: null,
          authLoading: false,
          authError: null,
          authInitialized: false
        });
      },

      addToCart: (tableId, item, variant) => {
        if (tableId) {
          // Dine-In cart
          set((state) => {
            const tableCart = state.dineInCarts[tableId] || [];
            
            // Match same item AND same variant ID
            const existing = tableCart.find(
              (ci) => ci.menuItem.id === item.id && ci.variant.id === variant.id
            );
            
            let newCart;
            if (existing) {
              newCart = tableCart.map((ci) => 
                (ci.menuItem.id === item.id && ci.variant.id === variant.id)
                  ? { ...ci, quantity: ci.quantity + 1 }
                  : ci
              );
            } else {
              newCart = [...tableCart, { menuItem: item, variant, quantity: 1 }];
            }
            return {
              dineInCarts: {
                ...state.dineInCarts,
                [tableId]: newCart
              }
            };
          });
        } else {
          // Parcel cart
          set((state) => {
            const existing = state.parcelCart.find(
              (ci) => ci.menuItem.id === item.id && ci.variant.id === variant.id
            );
            
            let newCart;
            if (existing) {
              newCart = state.parcelCart.map((ci) => 
                (ci.menuItem.id === item.id && ci.variant.id === variant.id)
                  ? { ...ci, quantity: ci.quantity + 1 }
                  : ci
              );
            } else {
              newCart = [...state.parcelCart, { menuItem: item, variant, quantity: 1 }];
            }
            return { parcelCart: newCart };
          });
        }
      },

      removeFromCart: (tableId, itemId, variantId) => {
        if (tableId) {
          set((state) => {
            const tableCart = state.dineInCarts[tableId] || [];
            const newCart = tableCart.filter(
              (ci) => !(ci.menuItem.id === itemId && ci.variant.id === variantId)
            );
            return {
              dineInCarts: {
                ...state.dineInCarts,
                [tableId]: newCart
              }
            };
          });
        } else {
          set((state) => ({
            parcelCart: state.parcelCart.filter(
              (ci) => !(ci.menuItem.id === itemId && ci.variant.id === variantId)
            )
          }));
        }
      },

      updateCartQuantity: (tableId, itemId, variantId, change) => {
        if (tableId) {
          set((state) => {
            const tableCart = state.dineInCarts[tableId] || [];
            const newCart = tableCart.map((ci) => {
              if (ci.menuItem.id === itemId && ci.variant.id === variantId) {
                const newQty = ci.quantity + change;
                return { ...ci, quantity: newQty > 0 ? newQty : 1 };
              }
              return ci;
            }).filter((ci) => ci.quantity > 0);
            return {
              dineInCarts: {
                ...state.dineInCarts,
                [tableId]: newCart
              }
            };
          });
        } else {
          set((state) => {
            const newCart = state.parcelCart.map((ci) => {
              if (ci.menuItem.id === itemId && ci.variant.id === variantId) {
                const newQty = ci.quantity + change;
                return { ...ci, quantity: newQty > 0 ? newQty : 1 };
              }
              return ci;
            }).filter((ci) => ci.quantity > 0);
            return { parcelCart: newCart };
          });
        }
      },

      clearCart: (tableId) => {
        if (tableId) {
          set((state) => {
            const newCarts = { ...state.dineInCarts };
            delete newCarts[tableId];
            return { dineInCarts: newCarts };
          });
        } else {
          set({ parcelCart: [] });
        }
      }
    }),
    {
      name: 'quickbite-restaurant-storage',
      partialize: (state) => ({
        hotel: state.hotel,
        dineInCarts: state.dineInCarts,
        parcelCart: state.parcelCart,
        currentUserId: state.currentUserId,
        setupCompleted: state.setupCompleted
      })
    }
  )
);
