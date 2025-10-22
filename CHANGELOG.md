# Development Diary

A day-by-day record of progress on Robert Ventures Investor Desk.

---

## October 2025

### Wednesday, October 22

#### 📚 **Documentation Cleanup - Single Source of Truth**
- **Consolidated all documentation to BACKEND-GUIDE.md**:
  - BACKEND-GUIDE.md is now the single source of truth for all technical documentation
  - Removed redundant documentation files to prevent confusion and duplication:
    - ❌ `AUDIT-REPORT.md` - Security audit details now in BACKEND-GUIDE
    - ❌ `FORMATTING-REFACTOR-SUMMARY.md` - Formatting utilities documented in BACKEND-GUIDE
    - ❌ `docs/CSRF-MIGRATION-COMPLETE.md` - CSRF security details in BACKEND-GUIDE
    - ❌ `docs/CSRF-MIGRATION-GUIDE.md` - Security practices in BACKEND-GUIDE
    - ❌ `docs/CSRF-TEST-REPORT.md` - Testing requirements in BACKEND-GUIDE
  - Updated CHANGELOG.md with comprehensive history of Oct 21-22 work
  - All development, security, API, and system documentation centralized
  - Improved maintainability with single documentation file to update

- **Benefits of consolidation**:
  - ✅ No duplicate or conflicting information
  - ✅ Easier to find documentation (one place to look)
  - ✅ Simpler to maintain and keep up-to-date
  - ✅ Better for onboarding new developers
  - ✅ Reduced repository clutter

### Tuesday, October 21

#### 📥 **Wealthblock Investor Import System**
- **Built comprehensive investor import interface**:
  - Single-user import workflow with immediate processing
  - Support for all account types: Individual, Joint, Entity, IRA
  - Dynamic form fields that adapt based on account type selected
  - Full address collection for primary account holder
  - Joint account support with separate holder information and address
  - Entity account support with entity details, tax ID, and authorized representative
  - IRA account support with custodian and account number
  - Investment history with historical dates (creation and confirmation dates)
  - Multiple investments per user with detailed tracking
  - Real-time form validation with helpful error messages
  - Phone number formatting (US format: (555) 123-4567)
  - Name input validation (letters, spaces, hyphens, apostrophes, periods only)
  - ZIP code formatting (5 digits)
  - Date handling that preserves exact dates without timezone shifting

- **Enhanced import API endpoint** (`/api/admin/import-investors`):
  - Creates Supabase Auth users with default password (`Test1234!`)
  - Auto-verifies imported accounts (admin-created)
  - Creates complete database user records with all account-type-specific fields
  - Creates primary address records in `addresses` table
  - Preserves historical account creation dates from Wealthblock
  - Creates investments with historical dates using `dateOnlyToISO()`
  - Generates investment IDs using sequential system (INV-10000, INV-10001, etc.)
  - Creates `account_created` activity event with historical date
  - Creates `investment_created` and `investment_confirmed` activity events
  - **Auto-triggers transaction regeneration** after successful import
  - Automatically generates all historical monthly distributions
  - Proper error handling with rollback (deletes auth user if database insert fails)
  - Returns detailed results with success/failure counts and error messages

- **Automatic transaction generation**:
  - After import completes, system automatically calls `/api/migrate-transactions`
  - Calculates all historical monthly distributions based on investment dates
  - Generates activity events for every distribution
  - Users see complete investment history immediately after import
  - Success message confirms all distributions calculated
  - Fallback instruction to manually regenerate if auto-generation fails

- **User experience improvements**:
  - Three-stage workflow: Add Investor → Review & Edit → Import
  - Collapsible form with "+ Import New Investor" button
  - Investment list with add/remove functionality
  - Display formatting for dates (MM/DD/YYYY) and currency
  - Success/warning messages after import
  - Option to send welcome emails to imported users
  - "Import Another Investor" button for batch workflows
  - Real-time investment total calculation

### Monday, October 20

#### 📚 **Documentation Consolidation - API Endpoints** (Latest)
- **Consolidated all API documentation into BACKEND-GUIDE.md**:
  - Updated "API Endpoints" section with new refactored RESTful endpoints:
    - Authentication endpoints (register-pending, verify-and-create, login, logout, etc.)
    - User Profile Management (GET/PUT /api/users/profile)
    - Account Operations (verify, change-password)
    - Investment Management (CRUD operations with RESTful routes)
    - Legacy endpoint documentation maintained for backward compatibility
  - Deleted redundant API refactoring documentation files:
    - ❌ `docs/API-REFACTORING-SUMMARY.md`
    - ❌ `docs/API-REFACTORING-QUICK-GUIDE.md`
    - ❌ `docs/API-REFACTORING-SPRINT-PLAN.md`
    - ❌ `docs/API-ENDPOINTS-ANALYSIS.md`
    - ❌ `docs/API-VISUAL-COMPARISON.md`
    - ❌ `docs/API-TESTING-GUIDE.md`
    - ❌ `docs/IMPLEMENTATION-SUMMARY.md`
    - ❌ `docs/QUICK-REFERENCE-NEW-ENDPOINTS.md`
  - Updated `docs/README.md` with API changes section and removed references to deleted files
  - All API documentation now centralized in single source: BACKEND-GUIDE.md

### Sunday, October 19

#### 🔄 **User Registration Flow Refactoring**
- **Migrated pending users to Supabase database**:
  - Moved from in-memory storage to persistent `pending_users` table in Supabase
  - Enhanced reliability and persistence across server restarts
  - Database-driven cleanup for expired pending users (auto-removes after expiry)
  - Email verification codes now stored in database with expiration tracking
  - Support for both test mode (hardcoded `123456` code) and production mode (random 6-digit code)

- **Updated registration endpoints**:
  - `/api/auth/register-pending` - Now stores pending users in Supabase
  - `/api/auth/verify-and-create` - Validates codes from database before user creation
  - Removed deprecated `/api/users/[id]/verify` endpoint (streamlined flow)
  - Enhanced error handling and validation

- **Documentation updates**:
  - Updated `docs/BACKEND-GUIDE.md` with new registration flow details
  - Removed redundant `docs/REGISTRATION-FLOW.md` (consolidated into BACKEND-GUIDE)
  - Added required database table schema for `pending_users`

#### 🧹 **Code Cleanup & Script Management**
- **Removed deprecated user management scripts** (513 lines deleted):
  - ❌ Deleted `scripts/clean-orphaned-auth-users.js` (no longer needed after registration refactor)
  - ❌ Deleted `scripts/diagnose-deletion.js` (debugging script no longer required)
  - ❌ Deleted `scripts/sync-auth-to-users.js` (obsolete after Supabase migration)
  - ❌ Deleted `scripts/sync-display-names.js` (deprecated functionality)
  - Updated `package.json` to remove all references to deleted scripts

#### 📚 **Supabase Setup Documentation**
- **Created comprehensive setup guide** (`docs/SUPABASE-SETUP.md`):
  - Complete SQL schema for `pending_users` table
  - Step-by-step Supabase project setup instructions
  - Environment variable configuration guide
  - Table creation and RLS policy setup
  - Troubleshooting section

- **Added diagnostic scripts**:
  - Created `scripts/check-pending-users-table.js` - Verifies pending_users table exists and structure
  - Created `scripts/test-pending-users-connection.js` - Tests database connection
  - Created `scripts/verify-supabase-keys.js` - Validates Supabase environment configuration
  - All scripts provide detailed output for debugging setup issues

#### 🔧 **Admin Dashboard Improvements**
- **Updated profile completeness checks** (`app/admin/page.js`):
  - Removed bank connection requirement from profile completeness
  - Updated warning message to reflect current requirements
  - Simplified profile completion logic
  - Better user experience for admin reviewing incomplete profiles

### Friday, October 17

#### 🔧 **Individual User Deletion Fix**
- **Fixed DELETE /api/users/[id] endpoint**:
  - Individual user deletion now removes user from both database AND Supabase Auth
  - Previously only deleted from database, leaving auth users orphaned
  - Added admin authentication requirement (was TODO)
  - Properly handles foreign key constraints (deletes transactions, investments, activity, etc.)
  - Returns HTTP 207 (Multi-Status) if database succeeds but auth fails
  - Frontend shows detailed confirmation dialog with all data being deleted
  - Frontend displays clear error messages for partial success scenarios
  - Updated `app/admin/page.js` Delete button to show comprehensive confirmation and error handling

- **Created cleanup script for orphaned auth users**:
  - Built `scripts/clean-orphaned-auth-users.js` to delete auth users without database records
  - Useful for cleaning up after manual user creation or failed imports
  - Added `npm run clean-orphaned-auth` command
  - Shows detailed summary of deleted/failed users

- **Created diagnostic script**:
  - Built `scripts/diagnose-deletion.js` to diagnose user deletion issues
  - Added `npm run diagnose-deletion` command  
  - Reports sync issues between auth and database
  - Checks service role key, counts users, identifies orphaned records

#### 🔧 **Bulk User Deletion (Accounts Tab)**
- **Fixed user deletion bug**:
  - Users were deleted from database but remained in Supabase Auth
  - Updated `app/api/admin/accounts/route.js` to properly track auth deletion failures
  - Now returns HTTP 207 (Multi-Status) when database deletion succeeds but auth fails
  - Frontend shows detailed error messages with specific user IDs and auth IDs
  - Added guidance for manual cleanup in Supabase dashboard

- **Created auth-to-database sync script**:
  - Built `scripts/sync-auth-to-users.js` to sync Supabase Auth users to database
  - Automatically creates missing database records for auth users
  - Added `npm run sync-auth-users` command
  - Preserves email verification status from auth
  - Handles duplicate prevention and error reporting

- **Added verification script**:
  - Created `scripts/verify-data-sources.js` to verify Supabase configuration
  - Added `npm run verify-data` command
  - Checks environment variables, connection, and auth capabilities
  - Helps diagnose sync issues and configuration problems

#### 📚 **Documentation Consolidation**
- **Consolidated all documentation into BACKEND-GUIDE.md**:
  - Added "Supabase Architecture" section covering:
    - Why use Auth + Users table (not Auth-only)
    - Data storage architecture (tables, buckets, RLS)
    - Syncing auth and database
    - User deletion from both systems
    - Local development files (data/ directory)
    - Environment configuration
    - Verification and troubleshooting
    - Performance considerations
  - Deleted separate documentation files:
    - ❌ `docs/AUTH-USERS-SYNC.md`
    - ❌ `docs/AUTH-VS-USERS-TABLE.md`
    - ❌ `docs/DATA-SOURCES.md`
    - ❌ `docs/USER-DELETION-FIX.md`
    - ❌ `data/README.md`
  - Updated README.md to reference consolidated documentation
  - All technical docs now in single source: BACKEND-GUIDE.md

#### 🗑️ **Cleanup**
- **Removed legacy user data file**:
  - Deleted `data/users.json` (969 lines of unused legacy data)
  - Updated `.gitignore` to allow `data/README.md` while ignoring JSON files
  - System now 100% Supabase-based for user data

### Thursday, October 17 (Evening)

#### 📚 **Documentation Cleanup & Backend Guide Update**
- **Removed all redundant markdown files**:
  - Deleted `MIGRATION-COMPLETE.md` - migration info consolidated in CHANGELOG
  - Deleted `NETLIFY-BLOBS-REMOVED.md` - information already in CHANGELOG
  - Deleted `PERFORMANCE-IMPROVEMENTS.md` - improvements documented in CHANGELOG
  - Deleted all bug report files (`bug-reports/*.md`) - issues resolved
  - Kept only `BACKEND-GUIDE.md` and `CHANGELOG.md` as primary documentation

- **Updated BACKEND-GUIDE.md**:
  - Ensured full technology-agnostic approach for backend dev team
  - Reflected current Supabase-based architecture
  - Documented all current API endpoints and endpoints
  - Added comprehensive testing scenarios
  - Included environment configuration for backend implementation
  - Updated deprecated references (removed Netlify Blobs)
  - Added Document Manager and Migration & Onboarding system documentation
  - Provided complete implementation guide for backend teams in any tech stack

#### ✅ **Complete Supabase Migration**
- **All Netlify Blobs references removed**:
  - ✅ Deleted `lib/database.js` (legacy JSON storage)
  - ✅ Deleted `lib/documentStorage.js` (Netlify Blobs storage)
  - ✅ Removed `useBlobs` flag from `lib/seedAccounts.js`, `lib/masterPassword.js`, `lib/auditLog.js`
  - ✅ Updated all API routes to use `lib/supabaseStorage.js`
  - ✅ Maintained backward compatibility with legacy `blobKey` for existing documents

- **API Routes Updated**:
  - `app/api/admin/documents/delete/route.js` - Now uses Supabase Storage
  - `app/api/admin/documents/assign-pending/route.js` - Updated for Supabase
  - `app/api/admin/documents/upload-single/route.js` - Updated for Supabase
  - `app/api/admin/documents/bulk-upload/route.js` - Updated for Supabase
  - `app/api/users/[id]/documents/[docId]/route.js` - Updated for Supabase

- **Database Operations**:
  - `lib/supabaseDatabase.js` - Integrated caching layer, optimized queries
  - `lib/supabaseStorage.js` - All document operations via Supabase Storage
  - All authentication through Supabase Auth

#### ⚡ **Performance Optimizations**
- **Server-side caching layer** (`lib/cache.js`):
  - Implemented in-memory cache for database operations
  - Cache TTLs: 30s for individual users, 60s for user lists
  - Automatic cache invalidation on write operations
  - Cache keys pattern: `user:id`, `user_email:email`, `all_users`

- **Database query optimization** (`lib/supabaseDatabase.js`):
  - Batch fetching for transactions and activity (eliminates N+1 queries)
  - Single query per operation instead of multiple sequential queries
  - Reduced API round trips from 50+ to ~5 per user load

- **Frontend React optimizations**:
  - `React.memo` wrapping: `DashboardTab`, `TransactionsList`
  - `useMemo` for expensive calculations in `TransactionsList`
  - Pagination in admin dashboard (20 items per page)
  - Lazy loading of investment details

- **Removed bottlenecks**:
  - ✅ Removed transaction migration from every dashboard load (`PortfolioSummary.js`)
  - ✅ Removed sequential API calls (now parallel with `Promise.all`)
  - ✅ Implemented pagination for admin accounts view

### Wednesday, October 16

#### 🚀 **MAJOR MIGRATION: Netlify Blobs → Supabase** (Evening)
- **Complete platform migration from Netlify Blobs to Supabase**:
  - Migrated from JSON file storage to PostgreSQL database
  - Replaced Netlify Auth with Supabase Auth
  - Implemented Supabase Storage for document management
  - Updated all 50+ API routes to use Supabase
  - Created comprehensive database schema with Row Level Security (RLS)
  - Built seed script for initial data (`npm run seed-supabase`)
  - Removed all `@netlify/blobs` dependencies from codebase
  
- **Database Architecture**:
  - PostgreSQL tables: users, investments, withdrawals, bank_accounts, documents, transactions
  - Proper foreign key relationships and cascading deletes
  - UUID primary keys with human-readable IDs (USR-1001, INV-10000)
  - Snake_case database fields with camelCase API responses
  - Indexed fields for performance (email, user_id, investment_id)
  
- **Authentication Improvements**:
  - Migrated to Supabase Auth for user management
  - Maintained existing JWT token system for backward compatibility
  - Password reset and verification flows updated for Supabase
  - Service role key for admin operations, anon key for client operations
  
- **API Refactoring**:
  - Refactored `users/[id]/route.js` into focused endpoints:
    - `users/[id]/route.js` - User profile operations (GET, PUT, DELETE)
    - `users/[id]/password/route.js` - Password change operations
    - `users/[id]/investments/route.js` - Investment CRUD operations
    - `users/[id]/verify/route.js` - Account verification
  - Updated all admin routes to use Supabase
  - Fixed transaction sync and migration endpoints
  
- **Files Updated** (complete migration):
  - Core library: `lib/supabaseDatabase.js`, `lib/supabaseClient.js`, `lib/supabaseAuth.js`, `lib/supabaseStorage.js`
  - Supporting libs: `lib/appTime.js`, `lib/idGenerator.js`, `lib/transactionSync.js`, `lib/seedAccounts.js`, `lib/migrateSSNs.js`
  - Auth routes: `auth/me`, `auth/login`, `auth/refresh`, `auth/request-reset`, `auth/reset-password`, `auth/send-welcome`
  - User routes: `users/route.js`, `users/[id]/*` (all variants)
  - Admin routes: All admin endpoints updated
  - Seed script: `scripts/seed-supabase.js`
  
- **Environment Configuration**:
  - Added Supabase environment variables to `.env.local`:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
  - Fixed Node.js `--env-file` flag for seed script
  - Removed all Netlify-specific configuration
  
- **Benefits of Migration**:
  - ✅ Eliminates eventual consistency issues (Netlify Blobs)
  - ✅ Real-time capabilities with Supabase subscriptions
  - ✅ Proper ACID transactions
  - ✅ Better query performance with PostgreSQL
  - ✅ Row Level Security for data protection
  - ✅ Automatic backups and point-in-time recovery
  - ✅ GraphQL API available if needed
  - ✅ Same behavior in local dev and production
  
- **Testing Status**:
  - ✅ Authentication working (login, logout, refresh tokens)
  - ✅ User profile operations functional
  - ✅ Dashboard loading correctly
  - ✅ Time machine working with Supabase
  - ✅ Development server running without errors

#### 🐛 **CRITICAL BUG FIX** - Investment submission staying in draft status (Morning)
- **Root Cause**: Netlify Blobs eventual consistency causing dashboard to read stale data after write
- **Solution**: Implemented timestamp-based consistency verification with retry logic
  - Added `lastModified` timestamp to track data freshness
  - Implemented read-after-write verification in `saveUsers()` with automatic retry on stale data
  - Added `?fresh=true` API parameter for extended retry logic (10 retries × 800ms)
  - Dashboard and portfolio components now request fresh data after investment submission
  - Reduced frontend delay from 2s to 500ms (better UX, backend handles consistency)
  - System now detects stale data and automatically retries until fresh data is available
- **Note**: This fix was made obsolete by evening Supabase migration, which eliminates consistency issues entirely

#### 🎨 **UI/UX Improvements**
- Fixed activity feed sorting to show newest items first (was showing oldest first)
- Removed redundant "Investment Created" event from activity feed (duplicates "Investment" transaction)
- Activity feed now shows clean flow: Account Created → Investment (PENDING) → Investment Confirmed (ACTIVE)
- Added CSP headers to allow Google Fonts and fix console warnings

#### 🔒 **SECURITY AUDIT COMPLETE**
- Fixed all 10 critical and high-severity vulnerabilities:
  - Environment variables protection (API keys, secrets)
  - JWT authentication with strong secrets (32+ chars)
  - API route authentication and authorization
  - SSN encryption at rest (AES-256-GCM)
  - Rate limiting (5 login attempts/15min, 3 password resets/hour)
  - Bcrypt password hashing with auto-migration
  - Audit logging for compliance (SOC 2, HIPAA, GDPR)
  - Input validation library (XSS/injection prevention)
  - CORS configuration with origin allowlist
  - HTTPS enforcement with HSTS (production)
- 📚 Updated BACKEND-GUIDE.md with security best practices

### Tuesday, October 15
- 📚 Consolidated security documentation into BACKEND-GUIDE.md
- 🧹 Removed redundant CORS, HTTPS, and input validation summary files

### Monday, October 14
- ✅ Added investment approval status tracking
- ✅ Updated transaction handling system
- ✅ Built tax document management system
- ✅ Integrated email notifications for documents
- ✅ Refactored investor management
- ✅ Enhanced import functionality

### Sunday, October 13
- 📚 Revised Backend Implementation Guide for clarity
- 📚 Made guide technology-agnostic for any tech stack
- 📚 Updated backend guide and removed tax audit trail summary
- ⚡ Enhanced admin dashboard with pagination
- ⚡ Added payment method selection

### Friday, October 11
- 🔧 Refactored admin investment handling
- 🔧 Refactored admin transaction handling

### Tuesday, October 8
- 🔐 Added two-factor authentication (2FA) for admin sign-ins
- 👤 Introduced sandbox admin profile
- ✏️ Added editing functionality to investment details page
- ✅ Added contribution transaction validation rules

### Monday, October 7
- ✅ Added joint account validation requirements
- ✅ Added backend checks for joint holders
- ✅ Added joint holder validation to user update API
- 📄 Added pagination to Distributions tab
- 🔄 Renamed Distributions tab to Transactions
- 💰 Revamped compounding investment transaction structure
- 🔧 Refactored transaction and payout event handling
- ⚡ Added bulk payout actions
- 🕐 Improved timezone handling
- ⚠️ Required admin approval for all monthly payouts

### Sunday, October 6
- 🐛 Fixed Netlify build error (moved seed logic to lib)
- ⚡ Added admin account reset functionality
- 🧪 Added test seeding
- 🔍 Added account filters
- ✨ Added profile completeness badge
- 🎨 Reordered nav tabs
- 📦 Switched to ES module export in next.config
- ✅ Enforced profile completion before investment approval
- 📚 Updated backend guide for time machine
- 📊 Added Distributions tab to admin dashboard
- 📚 Added session timeout and auto-logout documentation
- 📊 Added Activity tab for platform-wide event tracking
- 📚 Expanded and clarified backend testing documentation
- 🔥 **CRITICAL FIX**: Implemented every-day interest accrual including partial month
- ⚡ Added critical hybrid interest calculation methodology
- 🧹 Removed migration section from ID Architecture
- 📚 Enhanced backend documentation for new dev team
- 🧹 Removed cleanup and status summary files
- 🔧 Removed investment status check and redirect logic

### Saturday, October 5
- 🏷️ Renamed app to "Robert Ventures Investor Desk"
- 🔒 Implemented account type locking and unlocking logic
- 🎨 Refactored admin dashboard UI/UX
- 🎨 Refactored detail pages UI/UX
- 🧹 Refactored admin dashboard and removed unused files

### Thursday, October 3
- 🆔 Implemented sequential, human-readable ID system (USR-1001, INV-10000)

### Wednesday, October 2
- 📜 Revised withdrawal rules
- 🎨 Added UI/UX requirements
- 🔄 Renamed 'confirmed' status to 'active'
- 💰 Added admin payout tools
- 📊 Simplified growth projections table columns

### Tuesday, October 1
- ✉️ Added email verification flow for account creation
- 📅 Adjusted transaction event dates
- 🏷️ Updated UI labels
- 🔧 Fixed monthly accrual logic for investments
- 🔔 Refactored notifications to activity view with improved routing
- 📄 Enhanced documents view
- 📈 Improved investment calculations
- 📱 Added inputMode="numeric" to SSN input fields
- ✨ Improved input UX for ZIP and mobile form fields
- ❌ Added investment rejection flow
- ✅ Improved step confirmations

---

## September 2025

### Monday, September 30
- 🔔 Added notifications page
- 📝 Improved investment agreement flow
- 🔄 Revamped investment draft flow
- 📚 Updated lockup terminology

### Sunday, September 29
- 🎨 Updated SignInForm styles for improved layout
- 🔔 Enhanced withdrawal notice flow
- ✨ Improved UI feedback
- 💼 Added admin withdrawals management
- 🔄 Added transaction migration

### Thursday, September 26
- ⏰ Added time machine for date simulation
- 💰 Added withdrawals system
- 🔄 Added investment migration
- ❌ Added admin deletion requests
- 🔒 Added account type lock
- 🎨 UI improvements

### Wednesday, September 25
- 🗄️ Configured Blobs for production (NODE_ENV)
- 🔧 Enhanced Blobs with setJSON/getJSON methods
- 🔧 Updated Blobs to use getStore({ name })
- 🔑 Added admin seed route for idempotent admin creation
- ✅ Enhanced form validation and UX for investment flows
- ✅ Enhanced form validation and UX for identity flows

### Monday, September 23
- 🎨 Revamped account creation forms
- 🎨 Revamped profile forms
- 🎨 Revamped investment forms
- 🎉 **Initial commit** - Project started!

---

## Stats 📊

**Total Days Active:** 16 days  
**Total Commits:** 68 commits  
**Average Commits per Day:** ~4.3 commits

**Busiest Day:** October 6 (14 commits) 🔥  
**Most Productive Week:** October 6-8  

**Key Milestones:**
- ✅ Core investment platform built
- ✅ Admin dashboard completed
- ✅ Authentication system implemented
- ✅ Document management system added
- ✅ Investor import system built
- ✅ Email notifications integrated
- ✅ **Migrated to Supabase (PostgreSQL + Auth + Storage)**
- ✅ Refactored API routes for better organization
- ✅ Implemented Row Level Security (RLS)

**Technology Stack:**
- **Frontend**: Next.js 14, React
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth + JWT
- **Storage**: Supabase Storage
- **Email**: Custom SMTP integration
- **Deployment**: Netlify

---

**Last Updated:** October 22, 2025
