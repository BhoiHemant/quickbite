# Supabase Database Setup Guide

Follow these steps to connect your local QuickBite installation to a production-ready Supabase backend.

## Step 1: Create a Supabase Project
1. Go to [Supabase](https://supabase.com) and sign in or create an account.
2. Click **New Project** and select an organization.
3. Fill in the project details:
   - **Name**: `QuickBite Restaurant` or your restaurant's name.
   - **Database Password**: Generate a secure password and save it somewhere safe.
   - **Region**: Choose the region closest to your physical restaurant location for maximum performance and low latency.
4. Click **Create new project** and wait a few minutes for the database to provision.

## Step 2: Run the SQL Schema
Once your project is ready:
1. Navigate to the **SQL Editor** from the left sidebar navigation menu (the `SQL` icon).
2. Click **New Query** to open a blank SQL query window.
3. Open the [supabase_schema.sql](file:///c:/Users/Admin/Desktop/hotel%20management/supabase_schema.sql) file located in this project's root folder.
4. Copy the entire contents of the file and paste it into the Supabase SQL editor.
5. Click the **Run** button at the bottom right.
6. You should see a success message: `Success. No rows returned.` All tables, indexes, and Row Level Security (RLS) policies have now been successfully created!

## Step 3: Configure authentication (Optional but recommended)
QuickBite is built on multi-tenancy. When users register, they are isolated by their authenticated `auth.uid()`.
1. Go to **Authentication** -> **Providers** -> **Email**.
2. Make sure **Enable Signup** is turned **ON**.
3. (For fast development and testing): You can turn **OFF** "Confirm Email" to allow immediate signups without email verification checks.

## Step 4: Add Environment Variables
1. In the Supabase dashboard, click the **Settings** cog icon at the bottom left.
2. Go to **API**.
3. Copy the **Project URL** (under Project API keys).
4. Copy the **anon / public** API key.
5. Open your local `.env` file in the project directory:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
6. Paste your copied values into the variables.
7. Restart your development server (`npm run dev`) to apply the changes!

---
*Note: If no `.env` file is configured, QuickBite automatically activates its fallback high-fidelity mock engine, storing all tables, items, and orders locally in the browser's `localStorage` so you can start testing immediately!*
