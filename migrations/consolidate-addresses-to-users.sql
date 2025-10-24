-- Migration: Consolidate addresses to users.address
-- Description: Remove addresses table, store address directly on users table
-- Date: 2025-10-24

-- Step 1: Add users.address column (JSONB) if it doesn't exist
-- This column will store the user's primary address
alter table users add column if not exists address jsonb;

-- Step 2: Drop the addresses table
-- Address is now stored at the user level only
drop table if exists addresses cascade;

