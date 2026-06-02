import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import * as api from '../api/restaurantApi';
import type { OrderType } from '../types';

// ========================================================
// 1. DYNAMIC REALTIME SYNC HOOK (SUPABASE CHANNELS)
// ========================================================
export const useRealtimeSync = (hotelId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!hotelId) return;

    // Listen to orders, order_items, and table modifications for this hotel
    const channel = supabase
      .channel(`hotel-realtime-${hotelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `hotel_id=eq.${hotelId}` },
        () => {
          // Invalidate orders and analytics caches instantly
          queryClient.invalidateQueries({ queryKey: ['orders', hotelId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', hotelId] });
          queryClient.invalidateQueries({ queryKey: ['tables', hotelId] });
          queryClient.invalidateQueries({ queryKey: ['parcelOrders', hotelId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_tables', filter: `hotel_id=eq.${hotelId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tables', hotelId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotelId, queryClient]);
};

// ========================================================
// 2. RESTAURANT TABLES QUERIES
// ========================================================
export const useTables = (hotelId: string | undefined) => {
  return useQuery({
    queryKey: ['tables', hotelId],
    queryFn: () => api.getTables(hotelId!),
    enabled: !!hotelId,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });
};

// ========================================================
// 3. MENU CATALOG ITEMS QUERIES
// ========================================================
export const useMenuItems = (hotelId: string | undefined) => {
  return useQuery({
    queryKey: ['menuItems', hotelId],
    queryFn: () => api.getMenuItems(hotelId!),
    enabled: !!hotelId,
    staleTime: 1000 * 60 * 10 // Cache menu for 10 minutes
  });
};

// ========================================================
// 4. ACTIVE ORDERS QUERIES
// ========================================================
export const useOrders = (hotelId: string | undefined) => {
  return useQuery({
    queryKey: ['orders', hotelId],
    queryFn: () => api.getActiveOrders(hotelId!),
    enabled: !!hotelId,
    staleTime: 1000 * 30 // 30 seconds stale bounds
  });
};

// ========================================================
// 5. TRANSACTIONAL ORDERS MUTATIONS
// ========================================================
export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (variables: {
      hotelId: string;
      orderType: OrderType;
      tableId: string | null;
      parcelToken: string | null;
      items: { menuItemId: string; menuVariantId: string; quantity: number; price: number }[];
    }) => api.createOrder(
      variables.hotelId, 
      variables.orderType, 
      variables.tableId, 
      variables.parcelToken, 
      variables.items
    ),
    onSuccess: (data) => {
      const hotelId = data.hotel_id;
      // Optimistic cache invalidations
      queryClient.invalidateQueries({ queryKey: ['orders', hotelId] });
      queryClient.invalidateQueries({ queryKey: ['tables', hotelId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', hotelId] });
    }
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (variables: {
      orderId: string;
      status: 'paid' | 'cancelled';
      hotelId: string;
    }) => api.closeOrder(variables.orderId, variables.status),
    onSuccess: (_, variables) => {
      const hotelId = variables.hotelId;
      queryClient.invalidateQueries({ queryKey: ['orders', hotelId] });
      queryClient.invalidateQueries({ queryKey: ['tables', hotelId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', hotelId] });
    }
  });
};

// ========================================================
// 6. DASHBOARD ANALYTICS QUERIES
// ========================================================
export const useDashboard = (hotelId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard', hotelId],
    queryFn: async () => {
      if (!hotelId) throw new Error('hotelId is required');
      
      const [todaySales, totalOrders, topSellingItems] = await Promise.all([
        api.getTodaySales(hotelId),
        api.getTotalOrders(hotelId),
        api.getTopSellingItems(hotelId)
      ]);

      return {
        todaySales,
        totalOrders,
        topSellingItems
      };
    },
    enabled: !!hotelId,
    staleTime: 1000 * 60 // Cache analytics for 1 minute
  });
};

// ========================================================
// 7. SPECIFIC ORDER QUERY
// ========================================================
export const useOrder = (orderId: string | undefined) => {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.getOrderById(orderId!),
    enabled: !!orderId,
    staleTime: 1000 * 30 // 30 seconds stale bounds
  });
};

// ========================================================
// 8. PARCEL ORDERS REGISTER QUERY
// ========================================================
export const useParcelOrders = (hotelId: string | undefined) => {
  return useQuery({
    queryKey: ['parcelOrders', hotelId],
    queryFn: () => api.getParcelOrders(hotelId!),
    enabled: !!hotelId,
    staleTime: 1000 * 30 // 30 seconds stale bounds
  });
};

