# Clerk Cloud Sync Setup Guide

This guide walks through setting up Clerk authentication for cloud sync across devices.

---

## What This Does

When Clerk is configured, users can:
- Sign in with email or Google
- Back up their data to the cloud
- Sync across multiple devices (phone, laptop, tablet)
- **Offline mode still works** — login is completely optional

---

## Step 1: Get Your API Keys (✅ DONE)

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Find your app: "Substance Recovery"
3. Click **API Keys**
4. Copy:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

---

## Step 2: Add Keys to Replit Secrets (✅ DONE)

1. In your Replit project, click the **🔒 Secrets** tab (left sidebar)
2. Click **New Secret** (+ button)
3. Add:
   - **Key:** `VITE_CLERK_PUBLISHABLE_KEY`
   - **Value:** Paste your Publishable key
4. Click **Add**
5. Click **New Secret** again
6. Add:
   - **Key:** `CLERK_SECRET_KEY`
   - **Value:** Paste your Secret key
7. Click **Add**

---

## Step 3: Configure Clerk Redirect URLs

In Clerk Dashboard:

1. On the left sidebar, click **Configure** → **URLs**
2. Fill in these fields exactly:

| Field | Value |
|-------|-------|
| **Sign-in URL** | `https://substance-recovery.replit.app/sign-in` |
| **Sign-up URL** | `https://substance-recovery.replit.app/sign-up` |
| **After sign-in URL** | `/` |
| **After sign-up URL** | `/` |

3. Scroll down to **Allowed redirect origins**
4. Click **Add**
5. Type: `https://substance-recovery.replit.app`
6. Click **Save Changes**

---

## Step 4: Redeploy on Replit

1. In your Replit project, click **Publish** (top right)
2. Wait 1–2 minutes for the rebuild
3. Replit will show your live URL

---

## Step 5: Test Everything

1. Open your app: `https://substance-recovery.replit.app`
2. Go to **Settings** → scroll down to **Account**
3. You should see **Sign in** and **Sign up** buttons
4. Click **Sign up** → create an account with email
5. Check your email for a verification link
6. Click the link to verify
7. Your account is now active! Data syncs to the cloud automatically

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Clerk JS failed to load" | Check that `VITE_CLERK_PUBLISHABLE_KEY` is correct in Replit Secrets |
| "Page not found" on sign-in | Check that Clerk URLs use `substance-recovery.replit.app`, not `localhost` |
| Can't find Sign in button | Make sure you redeployed after adding secrets |
| No verification email | Check spam folder; or try signing in with Google instead |

---

## Important Notes

- **Secret key** (`sk_...`) is NEVER in your code. Only in Replit Secrets.
- **Publishable key** (`pk_...`) is safe in the frontend — Replit puts it there via the build.
- **Offline mode still works** — the app detects if Clerk is missing and shows a graceful fallback.
- **All data stays local** unless the user signs in. Login is completely optional.

---

Last updated: 2026-07-23
