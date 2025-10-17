# Data Sources - Where Does Data Come From?

This document explains where the application stores and retrieves data.

## 🗄️ Primary Data Source: Supabase PostgreSQL

**All application data is stored in Supabase**, including:

### Users & Authentication
- **Table:** `users`
- **Auth:** Supabase Auth (separate from users table)
- **Fields:** Profile data, SSN (encrypted), verification status, admin flags
- **API:** `/api/users` → `lib/supabaseDatabase.js` → Supabase

### Investments
- **Table:** `investments`
- **Fields:** Amount, status, lockup period, payment frequency, bonds
- **Relationships:** Belongs to user, has many transactions
- **API:** Embedded in user data via joins

### Transactions
- **Table:** `transactions`
- **Fields:** Type (distribution/compound), amount, date, status
- **Relationships:** Belongs to investment
- **Generated:** Automatically by Time Machine when crossing month boundaries

### Activity Feed
- **Table:** `activity`
- **Fields:** Event type, date, related resource IDs
- **Types:** Account created, investment submitted/confirmed/rejected, etc.
- **Relationships:** Belongs to user, optionally to investment

### Withdrawals
- **Table:** `withdrawals`
- **Fields:** Amount, status, quoted/final values, dates
- **Relationships:** Belongs to user and investment
- **API:** `/api/withdrawals`, `/api/admin/withdrawals`

### Bank Accounts
- **Table:** `bank_accounts`
- **Fields:** Bank name, account numbers (encrypted), routing, account type
- **Relationships:** Belongs to user
- **Integration:** Plaid for connection, but data stored in Supabase

### App Settings
- **Table:** `app_settings`
- **Key-value store:** Time Machine settings, auto-approve flags, etc.
- **API:** `/api/admin/time-machine`

## 📁 Local File Storage (Development Only)

Some features still use local JSON files for convenience during development:

### `data/audit-log.json`
- **Purpose:** Security audit logs
- **Content:** Master password usage, admin actions, sensitive data access
- **Production:** Should migrate to Supabase `audit_log` table

### `data/master-password.json`
- **Purpose:** Temporary master passwords for admin testing
- **Content:** Hashed password, expiration timestamp, admin who created it
- **Production:** Should migrate to Supabase `app_settings` table

### ~~`data/users.json`~~ (REMOVED)
- **Status:** ❌ Deleted in latest version
- **Reason:** All user data is in Supabase now

## 🔍 How Admin Panel Gets Data

When you open the admin dashboard (`/admin`), here's what happens:

1. **Initial Load** (`app/admin/page.js`)
   ```
   useAdminData() hook initializes
   ```

2. **Fetch Users** (`app/admin/hooks/useAdminData.js`)
   ```javascript
   fetch('/api/users')
   ```

3. **API Handler** (`app/api/users/route.js`)
   ```javascript
   getUsers() from lib/supabaseDatabase.js
   ```

4. **Database Query** (`lib/supabaseDatabase.js`)
   ```javascript
   supabase.from('users').select(`
     *,
     investments (*),
     bank_accounts (*),
     withdrawals (*)
   `)
   ```

5. **Result:** Real-time data from Supabase PostgreSQL

## 📊 Data Flow Diagram

```
┌─────────────────┐
│  Admin Panel    │
│  /admin         │
└────────┬────────┘
         │
         │ fetch('/api/users')
         ▼
┌─────────────────┐
│  API Route      │
│  /api/users     │
└────────┬────────┘
         │
         │ getUsers()
         ▼
┌─────────────────┐
│  Database Lib   │
│  supabaseDB.js  │
└────────┬────────┘
         │
         │ SELECT with JOINs
         ▼
┌─────────────────┐
│   Supabase      │
│   PostgreSQL    │
│                 │
│   - users       │
│   - investments │
│   - transactions│
│   - activity    │
│   - withdrawals │
│   - bank_accts  │
└─────────────────┘
```

## ⚡ Caching Strategy

### Frontend Caching
- **Location:** Browser localStorage
- **Duration:** 30 seconds
- **Keys:** 
  - `admin_users_cache`
  - `admin_withdrawals_cache`
  - `admin_payouts_cache`
- **Invalidation:** Automatic after updates or force refresh

### Backend Caching
- **Status:** Disabled
- **Reason:** Unreliable in serverless environments
- **Future:** Could use Redis for distributed caching

## 🔐 Security Considerations

### Sensitive Data
- **SSNs:** Encrypted using AES-256-CBC before storing in Supabase
- **Auth Tokens:** Managed by Supabase Auth, never stored in app code
- **Service Role Key:** Server-side only, never exposed to frontend
- **Master Passwords:** Bcrypt hashed, expire after 30 minutes

### Row Level Security (RLS)
Supabase RLS policies should enforce:
- Users can only see their own data
- Admins can see all data
- Service role bypasses RLS (use carefully!)

### API Authentication
All admin endpoints require:
```javascript
const admin = await requireAdmin(request)
if (!admin) {
  return authErrorResponse('Admin access required', 403)
}
```

## 🚀 Production Checklist

Before deploying to production, ensure:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in environment variables
- [ ] RLS policies are enabled and tested
- [ ] Audit logs migrate from JSON files to Supabase
- [ ] Master password system uses Supabase app_settings
- [ ] All sensitive data is encrypted
- [ ] Database backups are configured
- [ ] Connection pooling is optimized

## 📝 Related Documentation

- [Backend Guide](./BACKEND-GUIDE.md) - Database schema and API details
- [User Deletion Fix](./USER-DELETION-FIX.md) - Fixing auth user deletion
- [Supabase Docs](https://supabase.com/docs) - Official Supabase documentation

