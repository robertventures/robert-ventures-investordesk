# Robert Ventures InvestorDesk - System Reference

**Date**: 2025-10-26
**Purpose**: Single source of truth for how the system works

---

## CURRENT STATUS

✅ **Python Backend Running**: Port 8000
✅ **Next.js Frontend Running**: Port 3000
✅ **Supabase Connected**: Database working
✅ **Environment Variables Set**: `.env.local` configured

---

## ARCHITECTURE (SIMPLE)

```
Frontend (Next.js) → Backend (Python FastAPI) → Supabase (PostgreSQL)
  Port 3000              Port 8000                  Cloud Database
```

**Frontend Job**: Collect user input, display data
**Backend Job**: Validate data, execute business logic, store in database
**Supabase Job**: Store data permanently

---

## SUPABASE DATABASE SCHEMA

### 1. `users` Table
```sql
- id (TEXT, PK)                    -- "USR-1234567890123"
- auth_id (UUID, FK)               -- Links to Supabase Auth
- email (TEXT, UNIQUE)
- first_name (TEXT)
- last_name (TEXT)
- phone_number (TEXT)
- dob (TEXT)
- ssn (TEXT)
- is_verified (BOOLEAN)
- is_admin (BOOLEAN)
- account_type (TEXT)              -- 'individual', 'joint', 'entity', 'ira'
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### 2. `investments` Table
```sql
- id (TEXT, PK)                    -- "INV-12345"
- user_id (TEXT, FK → users.id)
- amount (NUMERIC)
- payment_frequency (TEXT)          -- 'compounding', 'monthly'
- lockup_period (TEXT)              -- '1-year', '3-year'
- account_type (TEXT)               -- 'individual', 'joint', 'entity', 'ira'
- status (TEXT)                     -- 'draft', 'pending', 'active', 'withdrawn'
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### 3. `pending_users` Table
```sql
- id (TEXT, PK)
- email (TEXT, UNIQUE)
- hashed_password (TEXT)
- verification_code (TEXT)          -- "000000" for test bypass
- created_at (TIMESTAMPTZ)
```

### 4. `activity` Table
```sql
- id (TEXT, PK)                     -- "ACT-12345"
- user_id (TEXT, FK)
- investment_id (TEXT, FK)
- type (TEXT)                       -- 'user_created', 'investment_created', etc.
- date (TIMESTAMPTZ)
- description (TEXT)
- created_at (TIMESTAMPTZ)
```

### 5. `id_counters` Table
```sql
- id_type (TEXT, PK)                -- 'user', 'investment', 'activity', etc.
- current_value (INTEGER)           -- Sequential counter
```

---

## BACKEND API ENDPOINTS (Python FastAPI)

**Base URL**: `http://localhost:8000`

### Authentication

#### POST `/api/auth/register-pending`
**Purpose**: Create temporary user registration
```json
Request: {
  "email": "user@example.com",
  "password": "password123"  // Min 8 characters
}
Response: {
  "success": true,
  "email": "user@example.com",
  "code": "000000"  // Test mode: always returns this
}
```

#### POST `/api/auth/verify-and-create`
**Purpose**: Verify code and create actual user
```json
Request: {
  "email": "user@example.com",
  "code": "000000"
}
Response: {
  "success": true,
  "user": {
    "id": "USR-1234567890123",
    "email": "user@example.com",
    "is_verified": true,
    ...
  }
}
Sets Cookie: auth_token (HttpOnly, 7 days)
```

#### GET `/api/auth/me`
**Purpose**: Get current logged-in user
```json
Response: {
  "success": true,
  "user": { ... }
}
Requires: auth_token cookie
```

### Users

#### GET `/api/users/{user_id}`
**Purpose**: Get user details
```json
Response: {
  "success": true,
  "user": { ... }
}
Requires: auth_token cookie (must be same user or admin)
```

#### PUT `/api/users/{user_id}`
**Purpose**: Update user details
```json
Request: {
  "first_name": "John",
  "last_name": "Doe",
  ...
}
Response: {
  "success": true,
  "user": { ... }
}
Requires: auth_token cookie
```

### Investments

#### POST `/api/users/{user_id}/investments`
**Purpose**: Create new investment
```json
Request: {
  "amount": 1000,
  "paymentFrequency": "compounding",
  "lockupPeriod": "3-year",
  "accountType": "individual"
}
Response: {
  "success": true,
  "investment": {
    "id": "INV-12345",
    "user_id": "USR-1234567890123",
    "amount": 1000,
    "status": "draft",
    ...
  }
}
Requires: auth_token cookie
```

#### GET `/api/users/{user_id}/investments`
**Purpose**: Get all investments for a user
```json
Response: {
  "success": true,
  "investments": [ ... ]
}
Requires: auth_token cookie
```

#### PATCH `/api/users/{user_id}/investments`
**Purpose**: Update existing investment
```json
Request: {
  "investmentId": "INV-12345",
  "amount": 2000,
  "status": "active"
}
Response: {
  "success": true,
  "investment": { ... }
}
Requires: auth_token cookie
```

---

## FRONTEND FLOW

### 1. User Registration Flow
```
Page: /
Component: AccountCreationForm.js
↓
User enters email + password
↓
Call: apiClient.registerPending(email, password)
POST → http://localhost:8000/api/auth/register-pending
↓
Redirect to: /confirmation
↓
User enters code "000000" (test bypass)
↓
Call: apiClient.verifyAndCreate(email, code)
POST → http://localhost:8000/api/auth/verify-and-create
↓
Backend creates user in Supabase
Backend sets auth_token cookie
↓
Frontend stores userId in localStorage
Redirect to: /investment
```

### 2. Investment Creation Flow
```
Page: /investment
Component: InvestmentForm.js
↓
User selects:
- Amount (e.g., $1,000)
- Payment Frequency (compounding/monthly)
- Lockup Period (1-year/3-year)
- Account Type (individual)
↓
User clicks "Continue"
↓
Call: apiClient.createInvestment(userId, investmentData)
POST → http://localhost:8000/api/users/{userId}/investments
Body: {
  amount: 1000,
  paymentFrequency: "compounding",
  lockupPeriod: "3-year",
  accountType: "individual"
}
↓
Backend validates data
Backend generates investment ID
Backend saves to Supabase investments table
Backend creates activity log
↓
Response: { success: true, investment: {...} }
↓
Frontend stores investmentId in localStorage
Redirect to next step
```

---

## CRITICAL CONFIGURATION

### Environment Variables (`.env.local`)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://oeilkrtuigcjtrkdiqzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Security
JWT_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
```

### Backend Config (`backend/config.py`)
```python
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
ENVIRONMENT = "development"
TEST_MODE = True  # Allows "000000" bypass
CORS_ORIGINS = ["http://localhost:3000"]
```

---

## API CLIENT (Frontend)

**File**: `lib/apiClient.js`

```javascript
// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

// Key Methods
apiClient.registerPending(email, password)
apiClient.verifyAndCreate(email, code)
apiClient.getCurrentUser()
apiClient.getUser(userId)
apiClient.createInvestment(userId, investmentData)
apiClient.getInvestments(userId)
```

**All requests automatically include:**
- `credentials: 'include'` (for cookies)
- `Content-Type: application/json`
- Auth token cookie (if logged in)

---

## COMMON ISSUES & SOLUTIONS

### Issue: "404 Not Found" on API calls
**Cause**: Frontend making requests to localhost:3000 instead of 8000
**Solution**: 
1. Verify `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`
2. Restart Next.js: `npm run dev`
3. Hard refresh browser (Cmd+Shift+R)

### Issue: "401 Unauthorized"
**Cause**: Missing or expired auth token
**Solution**: User needs to log in again

### Issue: "422 Unprocessable Entity"
**Cause**: Invalid request data (e.g., password too short, missing fields)
**Solution**: Check request payload matches backend models

### Issue: "Failed to create investment"
**Cause**: Backend database error
**Solution**: Check backend terminal for detailed error logs

---

## DEBUGGING CHECKLIST

When something doesn't work:

1. ✅ Is Python backend running on port 8000?
   ```bash
   curl http://localhost:8000/health
   ```

2. ✅ Is Next.js running on port 3000?
   ```bash
   curl http://localhost:3000
   ```

3. ✅ Is frontend configured to use port 8000?
   - Check browser console: Should show "API Client configured for: http://localhost:8000"

4. ✅ Check backend logs
   - Look in terminal running `uvicorn`
   - Should show request logs and any errors

5. ✅ Check browser Network tab
   - All API requests should go to `localhost:8000`
   - Check request/response payloads

---

## NEXT STEPS TO FIX CURRENT ISSUE

**Problem**: Investment creation not working from frontend

**Steps**:
1. Open browser to http://localhost:3000
2. Create account with email + password (min 8 chars)
3. Use code "000000" to verify
4. Try to create investment
5. Check backend terminal for errors
6. Report exact error message

**Expected**: Investment should be created and stored in Supabase

