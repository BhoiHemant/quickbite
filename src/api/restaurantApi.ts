import { supabase } from '../lib/supabase';
import type { Hotel, Table, MenuItem, MenuVariant, Order, OrderItem, OrderType } from '../types';

// ========================================================
// 1. HOTEL SETUP API
// ========================================================
export const getHotelByOwner = async (ownerId: string): Promise<Hotel | null> => {
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const createHotel = async (
  ownerId: string, 
  name: string, 
  ownerName: string, 
  phone: string,
  numberOfTables: number
): Promise<Hotel> => {
  // Create hotel record
  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .insert([{ owner_id: ownerId, name, owner_name: ownerName, phone }])
    .select()
    .single();

  if (hotelError) throw hotelError;

  // Auto-generate tables
  if (numberOfTables > 0) {
    const tableInserts = Array.from({ length: numberOfTables }, (_, i) => ({
      hotel_id: hotel.id,
      table_name: `Table ${i + 1}`,
      display_order: i,
      active: true
    }));

    const { error: tablesError } = await supabase
      .from('restaurant_tables')
      .insert(tableInserts);

    if (tablesError) throw tablesError;
  }

  return hotel;
};

// ========================================================
// 2. TABLES MANAGEMENT API
// ========================================================
export const getTables = async (hotelId: string): Promise<Table[]> => {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createTable = async (hotelId: string, tableName: string, displayOrder: number): Promise<Table> => {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .insert([{ hotel_id: hotelId, table_name: tableName, display_order: displayOrder, active: true }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTable = async (tableId: string, updated: Partial<Table>): Promise<Table> => {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .update(updated)
    .eq('id', tableId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteTable = async (tableId: string): Promise<void> => {
  const { error } = await supabase
    .from('restaurant_tables')
    .delete()
    .eq('id', tableId);

  if (error) throw error;
};

// ========================================================
// 3. MENU AND VARIANTS API
// ========================================================
export const getMenuItems = async (hotelId: string): Promise<MenuItem[]> => {
  // Fetch menu items with their linked variants in a single pre-join call
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_variants(*)')
    .eq('hotel_id', hotelId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createMenuItem = async (
  hotelId: string,
  name: string,
  category: string,
  variantsList: { variant_name: string; price: number }[],
  active: boolean = true
): Promise<MenuItem> => {
  let createdItem: MenuItem | null = null;
  
  try {
    // 1. Insert base menu item
    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .insert([{ hotel_id: hotelId, name, category, active }])
      .select()
      .single();

    if (itemError) throw itemError;
    createdItem = item;

    // 2. Insert associated price variants
    if (variantsList.length > 0) {
      const variantInserts = variantsList.map(v => ({
        menu_item_id: item.id,
        variant_name: v.variant_name,
        price: v.price
      }));

      const { error: varsError } = await supabase
        .from('menu_variants')
        .insert(variantInserts);

      if (varsError) {
        // Rollback: delete the newly created base menu item since variants failed
        console.warn('[Database Transaction Rollback] Variants insertion failed, rolling back menu item creation:', varsError.message);
        await supabase.from('menu_items').delete().eq('id', item.id);
        throw varsError;
      }
    }

    return item;
  } catch (err: any) {
    // If the base item was created but an unhandled exception occurred, ensure we clean it up
    if (createdItem && createdItem.id) {
      console.warn('[Database Transaction Rollback] Catch block cleanup triggered, deleting menu item:', createdItem.id);
      await supabase.from('menu_items').delete().eq('id', createdItem.id);
    }
    throw err;
  }
};

export const updateMenuItem = async (
  itemId: string,
  updated: Partial<MenuItem>,
  variantsList?: { variant_name: string; price: number }[]
): Promise<void> => {
  // 1. Update base menu item
  const { error: itemError } = await supabase
    .from('menu_items')
    .update(updated)
    .eq('id', itemId);

  if (itemError) throw itemError;

  // 2. If variants list is provided, sync it
  if (variantsList) {
    // Delete old variants
    const { error: deleteError } = await supabase
      .from('menu_variants')
      .delete()
      .eq('menu_item_id', itemId);

    if (deleteError) throw deleteError;

    // Insert new variants
    const variantInserts = variantsList.map(v => ({
      menu_item_id: itemId,
      variant_name: v.variant_name,
      price: v.price
    }));

    const { error: varsError } = await supabase
      .from('menu_variants')
      .insert(variantInserts);

    if (varsError) throw varsError;
  }
};

export const deleteMenuItem = async (itemId: string): Promise<void> => {
  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
};

export const createVariant = async (menuItemId: string, variantName: string, price: number): Promise<MenuVariant> => {
  const { data, error } = await supabase
    .from('menu_variants')
    .insert([{ menu_item_id: menuItemId, variant_name: variantName, price }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateVariant = async (variantId: string, updated: Partial<MenuVariant>): Promise<MenuVariant> => {
  const { data, error } = await supabase
    .from('menu_variants')
    .update(updated)
    .eq('id', variantId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteVariant = async (variantId: string): Promise<void> => {
  const { error } = await supabase
    .from('menu_variants')
    .delete()
    .eq('id', variantId);

  if (error) throw error;
};

// ========================================================
// 4. ORDERS & BILLING SYSTEM API
// ========================================================
export const getActiveOrders = async (hotelId: string): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, menu_items(*), menu_variants(*)), restaurant_tables(*)')
    .eq('hotel_id', hotelId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getOrderById = async (orderId: string): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, menu_items(*), menu_variants(*)), restaurant_tables(*)')
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
};

export const getParcelOrders = async (hotelId: string): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, menu_items(*), menu_variants(*))')
    .eq('hotel_id', hotelId)
    .eq('order_type', 'parcel')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// Helper: Recalculates and updates the total_amount of an order in the database
export const recalculateOrderTotal = async (orderId: string): Promise<number> => {
  // 1. Fetch all items in order
  const { data: items, error: fetchError } = await supabase
    .from('order_items')
    .select('subtotal')
    .eq('order_id', orderId);

  if (fetchError) throw fetchError;

  // 2. Sum subtotals
  const total = (items || []).reduce((sum, item) => sum + Number(item.subtotal), 0);

  // 3. Update orders table
  const { error: updateError } = await supabase
    .from('orders')
    .update({ total_amount: total })
    .eq('id', orderId);

  if (updateError) throw updateError;
  return total;
};

export const createOrder = async (
  hotelId: string,
  orderType: OrderType,
  tableId: string | null,
  parcelToken: string | null,
  items: { menuItemId: string; menuVariantId: string; quantity: number; price: number }[]
): Promise<Order> => {
  
  // If dine-in table, check if an ACTIVE order already exists to support KOT additions
  if (orderType === 'table' && tableId) {
    const { data: existingActiveOrder, error: checkError } = await supabase
      .from('orders')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('table_id', tableId)
      .eq('status', 'active')
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingActiveOrder) {
      // MERGE / APPEND new items into existing active order!
      for (const item of items) {
        // Check if this variant is already present
        const { data: existingItem, error: itemCheckError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', existingActiveOrder.id)
          .eq('menu_item_id', item.menuItemId)
          .eq('menu_variant_id', item.menuVariantId)
          .maybeSingle();

        if (itemCheckError) throw itemCheckError;

        if (existingItem) {
          // Increment Qty & Subtotal
          const newQty = existingItem.quantity + item.quantity;
          const newSubtotal = newQty * Number(existingItem.item_price);
          
          await supabase
            .from('order_items')
            .update({ quantity: newQty, subtotal: newSubtotal })
            .eq('id', existingItem.id);
        } else {
          // Insert fresh item row
          const subtotal = item.quantity * item.price;
          await supabase
            .from('order_items')
            .insert([{
              order_id: existingActiveOrder.id,
              menu_item_id: item.menuItemId,
              menu_variant_id: item.menuVariantId,
              quantity: item.quantity,
              item_price: item.price,
              subtotal
            }]);
        }
      }

      // Recalculate parent order total
      await recalculateOrderTotal(existingActiveOrder.id);
      return getOrderById(existingActiveOrder.id);
    }
  }

  // Create brand-new order record
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      hotel_id: hotelId,
      order_type: orderType,
      table_id: tableId,
      parcel_token: parcelToken,
      status: 'active',
      total_amount: totalAmount
    }])
    .select()
    .single();

  if (orderError) throw orderError;

  // Insert order items
  const itemInserts = items.map(item => {
    const subtotal = item.quantity * item.price;
    return {
      order_id: order.id,
      menu_item_id: item.menuItemId,
      menu_variant_id: item.menuVariantId,
      quantity: item.quantity,
      item_price: item.price,
      subtotal
    };
  });

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemInserts);

  if (itemsError) throw itemsError;

  return getOrderById(order.id);
};

export const addOrderItem = async (
  orderId: string, 
  menuItemId: string, 
  menuVariantId: string, 
  quantity: number, 
  itemPrice: number
): Promise<OrderItem> => {
  const subtotal = quantity * itemPrice;
  const { data, error } = await supabase
    .from('order_items')
    .insert([{
      order_id: orderId,
      menu_item_id: menuItemId,
      menu_variant_id: menuVariantId,
      quantity,
      item_price: itemPrice,
      subtotal
    }])
    .select()
    .single();

  if (error) throw error;
  
  await recalculateOrderTotal(orderId);
  return data;
};

export const updateOrderItem = async (
  orderItemId: string, 
  quantity: number, 
  itemPrice: number
): Promise<void> => {
  const subtotal = quantity * itemPrice;
  
  // Update item
  const { data: item, error: itemError } = await supabase
    .from('order_items')
    .update({ quantity, subtotal })
    .eq('id', orderItemId)
    .select()
    .single();

  if (itemError) throw itemError;

  // Update order total
  await recalculateOrderTotal(item.order_id);
};

export const deleteOrderItem = async (orderItemId: string, orderId: string): Promise<void> => {
  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', orderItemId);

  if (error) throw error;
  await recalculateOrderTotal(orderId);
};

export const closeOrder = async (orderId: string, status: 'paid' | 'cancelled'): Promise<void> => {
  const { error } = await supabase
    .from('orders')
    .update({ 
      status, 
      closed_at: new Date().toISOString() 
    })
    .eq('id', orderId);

  if (error) throw error;
};

// ========================================================
// 5. DASHBOARD METRICS API
// ========================================================
export const getTodaySales = async (hotelId: string): Promise<number> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('hotel_id', hotelId)
    .eq('status', 'paid')
    .gte('created_at', todayStart.toISOString());

  if (error) throw error;
  
  return (data || []).reduce((sum, o) => sum + Number(o.total_amount), 0);
};

export const getTotalOrders = async (hotelId: string): Promise<{ tableCount: number; parcelCount: number }> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('orders')
    .select('order_type')
    .eq('hotel_id', hotelId)
    .gte('created_at', todayStart.toISOString());

  if (error) throw error;

  const orders = data || [];
  return {
    tableCount: orders.filter(o => o.order_type === 'table').length,
    parcelCount: orders.filter(o => o.order_type === 'parcel').length
  };
};

export const getTopSellingItems = async (
  hotelId: string
): Promise<{ name: string; count: number; total: number }[]> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_items (
        quantity,
        subtotal,
        menu_items (name)
      )
    `)
    .eq('hotel_id', hotelId)
    .eq('status', 'paid')
    .gte('created_at', todayStart.toISOString());

  if (error) throw error;

  const itemCounts: { [name: string]: { count: number; total: number } } = {};

  (data || []).forEach(order => {
    (order.order_items || []).forEach((item: any) => {
      const name = item.menu_items?.name || 'Unknown Item';
      const qty = Number(item.quantity);
      const sub = Number(item.subtotal);

      if (!itemCounts[name]) {
        itemCounts[name] = { count: 0, total: 0 };
      }
      itemCounts[name].count += qty;
      itemCounts[name].total += sub;
    });
  });

  return Object.entries(itemCounts)
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      total: stats.total
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
};
