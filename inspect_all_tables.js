import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zigjpnkwfmdoiuboxxiz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppZ2pwbmt3Zm1kb2l1Ym94eGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNzExNTksImV4cCI6MjA5NTk0NzE1OX0.QjJAle9s5mIeTivZVV4lx_lQm7IWXgA3S9KKnyODEbg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tableExpectations = {
  hotels: ['id', 'owner_id', 'name', 'owner_name', 'phone', 'created_at'],
  restaurant_tables: ['id', 'hotel_id', 'table_name', 'display_order', 'active', 'created_at'],
  menu_items: ['id', 'hotel_id', 'name', 'category', 'active', 'created_at'],
  menu_variants: ['id', 'menu_item_id', 'variant_name', 'price', 'created_at'],
  orders: ['id', 'hotel_id', 'order_type', 'table_id', 'parcel_token', 'status', 'total_amount', 'created_at', 'closed_at'],
  order_items: ['id', 'order_id', 'menu_item_id', 'menu_variant_id', 'quantity', 'item_price', 'subtotal', 'created_at'],
  settings: ['id', 'hotel_id', 'setup_completed', 'restaurant_config'],
  users: ['id', 'email', 'role']
};

console.log('=== STARTING PRODUCTION DATABASE REVERSE ENGINEERING ===\n');

for (const [tableName, expectedCols] of Object.entries(tableExpectations)) {
  console.log(`Checking table "${tableName}"...`);
  
  // 1. Check if table exists by doing a select * limit 0
  const { error: existErr } = await supabase.from(tableName).select('*').limit(0);
  
  if (existErr) {
    if (existErr.code === '42P01') {
      console.log(`❌ Table "${tableName}" DOES NOT EXIST in database!`);
      continue;
    } else {
      console.log(`ℹ️ Table exists, but returned query status: ${existErr.code} - ${existErr.message}`);
    }
  } else {
    console.log(`✅ Table "${tableName}" exists!`);
  }

  // 2. Query each expected column individually to find exact missing columns
  const missingCols = [];
  const columnHints = {};
  
  for (const colName of expectedCols) {
    const { error: colErr } = await supabase.from(tableName).select(colName).limit(0);
    if (colErr) {
      // 42703 is PostgreSQL code for undefined_column
      if (colErr.code === '42703' || colErr.message.includes('column') || colErr.message.includes('does not exist')) {
        missingCols.push(colName);
        if (colErr.hint) {
          columnHints[colName] = colErr.hint;
        }
      } else {
        console.log(`  - Column "${colName}": error checking: ${colErr.code} - ${colErr.message}`);
      }
    }
  }
  
  if (missingCols.length === 0) {
    console.log(`  ✅ All expected columns exist!`);
  } else {
    console.log(`  ❌ Missing columns: ${missingCols.join(', ')}`);
    for (const [colName, hint] of Object.entries(columnHints)) {
      console.log(`    💡 Hint for "${colName}": ${hint}`);
    }
  }
  console.log('--------------------------------------------------\n');
}
