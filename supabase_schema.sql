-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Hotels Table
create table if not exists public.hotels (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  owner_name text not null,
  phone text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.hotels enable row level security;

drop policy if exists "Owners can manage their own hotel" on public.hotels;
create policy "Owners can manage their own hotel"
  on public.hotels
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Helper security function to verify hotel ownership in sub-tables
create or replace function public.user_owns_hotel(hotel_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.hotels 
    where id = hotel_id and owner_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- 2. Restaurant Tables Table
create table if not exists public.restaurant_tables (
  id uuid default uuid_generate_v4() primary key,
  hotel_id uuid references public.hotels(id) on delete cascade not null,
  table_name text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(hotel_id, table_name)
);

alter table public.restaurant_tables enable row level security;

drop policy if exists "Owners can manage their hotel's tables" on public.restaurant_tables;
create policy "Owners can manage their hotel's tables"
  on public.restaurant_tables
  for all
  using (public.user_owns_hotel(hotel_id))
  with check (public.user_owns_hotel(hotel_id));

-- 3. Menu Items Table
create table if not exists public.menu_items (
  id uuid default uuid_generate_v4() primary key,
  hotel_id uuid references public.hotels(id) on delete cascade not null,
  name text not null,
  category text not null,
  active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.menu_items enable row level security;

drop policy if exists "Owners can manage their hotel's menu items" on public.menu_items;
create policy "Owners can manage their hotel's menu items"
  on public.menu_items
  for all
  using (public.user_owns_hotel(hotel_id))
  with check (public.user_owns_hotel(hotel_id));

-- 4. Menu Item Variants Table
create table if not exists public.menu_variants (
  id uuid default uuid_generate_v4() primary key,
  menu_item_id uuid references public.menu_items(id) on delete cascade not null,
  variant_name text not null,
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(menu_item_id, variant_name)
);

alter table public.menu_variants enable row level security;

drop policy if exists "Owners can manage their hotel's variants" on public.menu_variants;
create policy "Owners can manage their hotel's variants"
  on public.menu_variants
  for all
  using (
    exists (
      select 1 from public.menu_items
      where menu_items.id = menu_variants.menu_item_id
      and public.user_owns_hotel(menu_items.hotel_id)
    )
  )
  with check (
    exists (
      select 1 from public.menu_items
      where menu_items.id = menu_variants.menu_item_id
      and public.user_owns_hotel(menu_items.hotel_id)
    )
  );

-- 5. Orders Table
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  hotel_id uuid references public.hotels(id) on delete cascade not null,
  order_type text not null check (order_type in ('table', 'parcel')),
  table_id uuid references public.restaurant_tables(id) on delete set null,
  parcel_token text, -- e.g. "P-001"
  status text not null check (status in ('active', 'paid', 'cancelled')) default 'active',
  total_amount numeric(10, 2) not null default 0.00 check (total_amount >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  closed_at timestamp with time zone,
  constraint check_table_id check (
    (order_type = 'table' and table_id is not null) or 
    (order_type = 'parcel' and table_id is null)
  )
);

alter table public.orders enable row level security;

drop policy if exists "Owners can manage their hotel's orders" on public.orders;
create policy "Owners can manage their hotel's orders"
  on public.orders
  for all
  using (public.user_owns_hotel(hotel_id))
  with check (public.user_owns_hotel(hotel_id));

-- 6. Order Items Table
create table if not exists public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  menu_item_id uuid references public.menu_items(id) on delete cascade not null,
  menu_variant_id uuid references public.menu_variants(id) on delete set null,
  quantity integer not null check (quantity > 0),
  item_price numeric(10, 2) not null check (item_price >= 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.order_items enable row level security;

drop policy if exists "Owners can manage their hotel's order items" on public.order_items;
create policy "Owners can manage their hotel's order items"
  on public.order_items
  for all
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and public.user_owns_hotel(orders.hotel_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and public.user_owns_hotel(orders.hotel_id)
    )
  );

-- Indexes for performance
create index if not exists idx_restaurant_tables_hotel_id on public.restaurant_tables(hotel_id);
create index if not exists idx_menu_items_hotel_id on public.menu_items(hotel_id);
create index if not exists idx_menu_variants_item_id on public.menu_variants(menu_item_id);
create index if not exists idx_orders_hotel_id on public.orders(hotel_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);

-- Enable realtime subscriptions
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
  alter publication supabase_realtime add table public.restaurant_tables, public.orders, public.order_items;
commit;
