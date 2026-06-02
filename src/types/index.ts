export interface Hotel {
  id: string;
  owner_id: string;
  name: string;
  owner_name: string;
  phone: string;
  created_at: string;
}

export interface Table {
  id: string;
  hotel_id: string;
  table_name: string;
  display_order: number;
  active: boolean;
  created_at: string;
}

export interface MenuVariant {
  id: string;
  menu_item_id: string;
  variant_name: string; // e.g. "Full", "Half"
  price: number;
  created_at?: string;
}

export interface MenuItem {
  id: string;
  hotel_id: string;
  name: string;
  category: string;
  active: boolean;      // Replaced is_active
  created_at: string;
  menu_variants?: MenuVariant[]; // Replaced variants
}

export type OrderType = 'table' | 'parcel';
export type OrderStatus = 'active' | 'paid' | 'cancelled';

export interface Order {
  id: string;
  hotel_id: string;
  order_type: OrderType; // Replaced type
  table_id: string | null;
  parcel_token: string | null; // Replaced token
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  closed_at: string | null;
  order_items?: OrderItemExtended[];
  restaurant_tables?: Table | null; // Joined table detail
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_variant_id: string | null; // Replaced variant_id
  quantity: number;
  item_price: number;      // Price snapshot
  subtotal: number;        // quantity * item_price
  created_at: string;
}

export interface OrderItemExtended extends OrderItem {
  menu_items?: {
    name: string;
    category: string;
  } | null;
  menu_variants?: {
    variant_name: string;
    price: number;
  } | null;
}

export interface CartItem {
  menuItem: MenuItem;
  variant: MenuVariant; // Chosen variant
  quantity: number;
}
