# Supabase Database Setup

This document contains the SQL commands needed to set up your Supabase database for the Robert Ventures Investor Desk.

## Required Tables

### 1. pending_users Table

The `pending_users` table stores temporary user registration data before email verification is complete.

**Run this in your Supabase SQL Editor:**

```sql
-- Create pending_users table for temporary user registration storage
CREATE TABLE IF NOT EXISTS pending_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  hashed_password TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_users_email ON pending_users(email);
CREATE INDEX IF NOT EXISTS idx_pending_users_created_at ON pending_users(created_at);

-- Enable Row Level Security
ALTER TABLE pending_users ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage pending users
CREATE POLICY "Service role can manage pending users"
  ON pending_users FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### 2. Verify Setup

After running the SQL, verify the table was created:

```sql
-- Check if table exists
SELECT tablename FROM pg_tables WHERE tablename = 'pending_users';

-- Check table structure
\d pending_users
```

You should see:
- Table: `pending_users`
- Columns: `id`, `email`, `hashed_password`, `verification_code`, `created_at`
- 2 indexes
- RLS enabled

## Troubleshooting

### "Failed to create pending registration" Error

This error means the `pending_users` table is missing. Run the SQL above to fix it.

### Permission Errors

Make sure you're using the **service role key** in your `.env.local`:
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Get it from: Supabase Dashboard → Settings → API → service_role key

### Table Already Exists

If you see "relation already exists", that's fine! The `IF NOT EXISTS` clause prevents errors.

## Test Mode

By default, the app runs in **test mode**:
- No email verification needed
- Use verification code: `000000` for any account
- Works in both development and production
- Perfect for testing and demos

To enable real email verification:
```bash
ENABLE_EMAIL_VERIFICATION=true
```

## Next Steps

After setting up the database:

1. **Verify connection:**
   ```bash
   npm run verify-data
   ```

2. **Seed initial accounts:**
   ```bash
   npm run seed-supabase
   ```
   This creates the admin account (`admin@rv.com`) and a test user.

3. **Test registration:**
   - Go to your app homepage
   - Create an account with any email
   - Use verification code: `000000`
   - Should work without errors!

## Additional Resources

- Full schema documentation: [BACKEND-GUIDE.md](BACKEND-GUIDE.md)
- Environment setup: [README.md](../README.md)

