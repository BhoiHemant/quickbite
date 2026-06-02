# Vercel Production Deployment Guide

This guide outlines the quick and complete setup steps to deploy the **QuickBite POS & Restaurant Management System** on Vercel with zero runtime crashes or blank screens.

---

## 🚀 Step-by-Step Vercel Deployment

### 1. Create a Vercel Project
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **"Add New..."** &rarr; **"Project"**.
3. Import your GitHub/GitLab repository hosting this codebase.

### 2. Configure Environment Variables
Before clicking **Deploy**, toggle open the **"Environment Variables"** tab and declare the two required Supabase production keys:

| Key | Value | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://your-project-id.supabase.co` | Your cloud Supabase project API URL. |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX...` | Your cloud Supabase project anonymous public key. |

> [!IMPORTANT]
> Make sure both variables have the `VITE_` prefix. Vite will exclude any environment variables without `VITE_` from the client bundle by default.

### 3. Build & Development Settings
Vercel automatically detects the Vite config, but verify that the configurations match:
- **Framework Preset**: `Vite` (or `Other`)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 4. Deploy!
Click **"Deploy"**. Vercel will bundle your assets, run strict type-checks, generate PWA precached files, and launch your production URL.

---

## 🩺 Production Resilience & Fallback Protections

The application has been engineered with production-grade gates to guarantee that **a blank screen will never be rendered under any circumstances**:

1. **Soft Initialization**: The Supabase Client in `src/lib/supabase.ts` uses placeholder credentials instead of crashing at evaluation time if keys are missing. This permits the React application to boot and render diagnostic helpers.
2. **Startup Health Audits**: The startup loader runs lightweight checks to test URL presence, key formats, server connectivity, Auth gateway ping, and Postgres table schemas.
3. **Graceful Error Overlay**: If variables are missing in Vercel, instead of rendering a blank screen, a highly detailed diagnostics console mounts immediately, giving clear setup steps and status checkmarks.
4. **Global Error Boundary**: A top-level React Error Boundary intercepts uncaught runtime errors (e.g. paused database instances or unexpected code updates), displaying recovery instructions and a "Reset Cache & Reload" retry button.
5. **Precached PWA Assets**: Fixed console PWA loading errors by copying high-definition circular app logo resources into the `public/` directory (covering `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, and `favicon.ico`).
