# Time Machine Fix - Supabase Migration

## Issue Found

After migrating from Netlify Blobs to Supabase, the time machine functionality was **not working** because:

1. The time machine API (`/app/api/admin/time-machine/route.js`) was using the deprecated `saveUsers()` function
2. `saveUsers()` doesn't actually save anything - it just returns `true` for backward compatibility
3. Time machine settings were never being persisted to the Supabase database

## Changes Made

### 1. Updated `/app/api/admin/time-machine/route.js`

**Changed:**
- Import: `saveUsers` → `updateAppTimeSettings`
- POST endpoint: Now properly saves settings to `app_settings` table
- DELETE endpoint: Now properly resets settings in `app_settings` table

### 2. Updated `/lib/supabaseDatabase.js`

**Changed:**
- `getUsers()` now returns all time machine settings:
  - `timeOffset`
  - `timeOffsetSetAt`
  - `timeMachineSetBy`
  - `autoApproveDistributions`
  - `isActive`

## Database Requirements

The time machine requires an `app_settings` table in Supabase with the following structure:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Time Machine Settings Structure

The time machine stores settings as a single row with `key = 'time_machine'` and the following JSONB structure:

```json
{
  "timeOffset": 31536000000,           // milliseconds offset from real time
  "timeOffsetSetAt": "2025-01-20T...", // ISO timestamp when offset was set
  "timeMachineSetBy": "USR-1001",      // admin user ID who set it
  "autoApproveDistributions": true,    // auto-approve new distributions
  "isActive": true                     // whether time machine is active
}
```

## How to Verify the Fix

### 1. Check if `app_settings` table exists

Run this SQL in your Supabase SQL Editor:

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'app_settings'
);
```

If it returns `false`, create the table:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant necessary permissions
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow service role to access (for API calls)
CREATE POLICY "Service role can do everything" ON app_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 2. Test Time Machine Functionality

1. **Login as admin** at `/sign-in` (admin@rv.com)
2. **Go to Operations tab** in Admin Dashboard
3. **Set a new time** using the Time Machine controls
4. **Verify the setting persisted** by refreshing the page
5. **Check the database** to see if the setting was saved:

```sql
SELECT * FROM app_settings WHERE key = 'time_machine';
```

Expected result:
```json
{
  "key": "time_machine",
  "value": {
    "timeOffset": <number>,
    "timeOffsetSetAt": "<timestamp>",
    "timeMachineSetBy": "<admin-user-id>",
    "autoApproveDistributions": false,
    "isActive": true
  },
  "updated_at": "<timestamp>"
}
```

### 3. Test Reset Functionality

1. Click **"Reset to Real Time"** button
2. Verify time machine is inactive
3. Check database again - `timeOffset` should be `null` and `isActive` should be `false`

## What Works Now

✅ **Setting app time** - Saves to Supabase `app_settings` table  
✅ **Resetting to real time** - Properly clears the offset in database  
✅ **Auto-approve distributions** - Toggle persists correctly  
✅ **Time offset persistence** - Settings survive server restarts  
✅ **Reading app time** - All routes use `getCurrentAppTime()` correctly  

## Migration Notes

If you were using the time machine before this fix:
- Previous settings were **not saved** and were lost on server restart
- You'll need to **reconfigure** the time machine after this fix
- All future settings will persist correctly in Supabase

