# Data Directory

This directory contains local file-based storage for specific features during development.

## Files

### `audit-log.json`
**Purpose:** Stores security audit logs (master password usage, admin actions, etc.)
**Status:** Used for local development
**Production:** Should be migrated to Supabase `audit_log` table for compliance (SOC 2, HIPAA)

### `master-password.json`
**Purpose:** Stores temporary master passwords for admin access to investor accounts
**Status:** Used for local development
**Production:** Should be migrated to Supabase `app_settings` table with encryption

### ~~`users.json`~~ (REMOVED)
**Status:** ❌ Deleted - No longer needed
**Reason:** All user data is now stored in Supabase PostgreSQL database

## Important Notes

### User Data Storage
**All user data is stored in Supabase**, not in local files:
- Users table: `users`
- Investments: `investments`
- Transactions: `transactions`
- Activity: `activity`
- Withdrawals: `withdrawals`
- Bank accounts: `bank_accounts`

### Admin Panel
The admin panel (`/admin`) reads from Supabase in real-time:
- Fetches from `/api/users` → `lib/supabaseDatabase.js` → Supabase PostgreSQL
- No local JSON files are used for user data

### Development vs Production

**Local Development:**
- Audit logs and master passwords use local JSON files
- User data always uses Supabase (even in dev)

**Production:**
- All data should be in Supabase (including audit logs and master passwords)
- Local JSON files should not be used

## Migration TODO

For production compliance, migrate these features to Supabase:

1. **Audit Logs**
   - Already have `audit_log` table in Supabase
   - Update `lib/auditLog.js` to use `supabaseDatabase.logAuditEvent()`
   
2. **Master Passwords**
   - Store in `app_settings` table with key `master_password`
   - Encrypt sensitive data before storing
   - Set TTL using timestamp checks

## Gitignore

These files are gitignored to prevent sensitive data from being committed:
```
/data/*.json
```

Only this README is tracked in version control.

