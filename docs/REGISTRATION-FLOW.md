# User Registration Flow

## Overview

The user registration process now uses a two-step verification flow to ensure users verify their email before their account is created in the database.

## Flow Diagram

```
1. User submits signup form
   └─> POST /api/auth/register-pending
       ├─> Validates email & password
       ├─> Checks for existing users
       ├─> Stores pending registration (in-memory)
       └─> Returns success (email would be sent in production)

2. User enters verification code
   └─> POST /api/auth/verify-and-create
       ├─> Validates verification code
       ├─> Creates actual user in Supabase
       ├─> Sets user as verified
       ├─> Creates authentication session
       └─> Redirects to onboarding

3. User proceeds with onboarding
   └─> /investment (investment form)
```

## Endpoints

### POST /api/auth/register-pending

**Purpose**: Store pending user registration before email verification

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (Success):
```json
{
  "success": true,
  "pendingId": "PENDING-1234567890-xyz",
  "email": "user@example.com",
  "message": "Verification code sent to your email"
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "User with this email already exists"
}
```

**Status Codes**:
- `200`: Pending registration created successfully
- `400`: Validation error (invalid email/password)
- `409`: User already exists
- `429`: Rate limit exceeded

### POST /api/auth/verify-and-create

**Purpose**: Verify confirmation code and create the actual user account

**Request Body**:
```json
{
  "email": "user@example.com",
  "verificationCode": "000000"
}
```

**Response** (Success):
```json
{
  "success": true,
  "user": {
    "id": "USR-1234",
    "email": "user@example.com",
    "isVerified": true,
    "verifiedAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Account created and verified successfully"
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Invalid verification code"
}
```

**Status Codes**:
- `201`: User created successfully
- `400`: Invalid verification code or missing data
- `409`: User already exists
- `500`: Server error

## Frontend Components

### AccountCreationForm
**Location**: `/app/components/AccountCreationForm.js`

- Collects user email and password
- Validates password requirements (8 chars, 1 uppercase, 1 number, 1 special)
- Calls `POST /api/auth/register-pending`
- Stores email in localStorage
- Redirects to `/confirmation`

### ConfirmationPage
**Location**: `/app/confirmation/page.js`

- Displays 6-digit verification code input
- Retrieves email from URL params or localStorage
- Calls `POST /api/auth/verify-and-create` with code
- Handles success: stores user info, redirects to `/investment`
- Handles errors: expired registration, invalid code, etc.

## Temporary Storage

**Implementation**: In-memory Map (`lib/pendingUsers.js`)

**Features**:
- Stores pending registrations temporarily
- Auto-expires after 1 hour
- Cleanup runs every 10 minutes
- Data structure:
  ```javascript
  {
    email: string,
    hashedPassword: string,
    verificationCode: string, // "000000" for testing
    createdAt: timestamp,
    pendingId: string
  }
  ```

**Production Considerations**:
- Should be replaced with Netlify Blobs or database table
- Current in-memory storage will be lost on server restart
- For development/testing this is acceptable

## Verification Code

### Current (Testing)
- Hardcoded to `000000`
- No actual email sent
- Documented in UI for testers

### Future (Production)
- Generate random 6-digit code
- Store in pending user data
- Send via email service (e.g., SendGrid, AWS SES)
- Implement expiry (5-10 minutes)
- Implement resend functionality

## Migration Notes

### Old Flow (Deprecated)
```
POST /api/users → Creates user immediately → Redirect to confirmation
```

### New Flow (Current)
```
POST /api/auth/register-pending → Redirect to confirmation → 
POST /api/auth/verify-and-create → Creates user after verification
```

### Backward Compatibility
- Old `POST /api/users` endpoint still exists
- Now marked for admin/internal use only
- Used by seed scripts and admin imports
- Regular user registration should not use this endpoint

## Error Handling

### Registration Expired
If user takes too long (>1 hour), pending registration expires:
```
Error: "Pending registration not found or expired. Please sign up again."
Action: Clear localStorage, redirect to signup
```

### Invalid Code
If user enters wrong verification code:
```
Error: "Invalid verification code"
Action: Clear code input, allow retry
```

### User Already Exists
If email is already registered:
```
Error: "User with this email already exists"
Action: Show error, suggest sign in
```

## Testing

### Test Accounts
All test accounts in seed data are pre-verified and bypass this flow.

### Manual Testing
1. Go to `/` (home page)
2. Click "Create Account"
3. Enter email: `test@example.com`
4. Enter password: `Test1234!`
5. Submit form → redirects to `/confirmation`
6. Enter code: `000000`
7. Submit → creates account → redirects to `/investment`

### Rate Limiting
Registration endpoint uses standard rate limiting config:
- Check `lib/rateLimit.js` for current limits
- Typically: 5 requests per 15 minutes per IP

