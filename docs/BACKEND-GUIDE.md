# Backend Implementation Guide

**Robert Ventures Investment Platform - Backend Requirements**

This guide documents the exact business logic, calculations, and API requirements needed to build a backend that matches the Next.js reference implementation. While examples use Python syntax for clarity, the concepts are language-agnostic and can be implemented in any backend technology.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Core Business Rules](#core-business-rules)
3. [Authentication & Security](#authentication--security)
4. [Data Models](#data-models)
5. [ID Architecture](#id-architecture)
6. [Investment State Machine](#investment-state-machine)
7. [Interest Calculations](#interest-calculations)
8. [Transaction System](#transaction-system)
9. [Withdrawal Rules](#withdrawal-rules)
10. [API Endpoints](#api-endpoints)
11. [Admin Features](#admin-features)
12. [Testing Requirements](#testing-requirements)

---

## Platform Overview

### What It Does
Investment platform for bonds with:
- **Amounts:** $1,000 minimum (increments of $10)
- **Lockup periods:** 1-year (8% APY) or 3-year (10% APY)
- **Payment options:** Monthly payouts or compounding
- **Account types:** Individual, Joint, Entity, IRA
- **Payment methods:**
  - ACH transfers (via Plaid or similar) - up to $100,000, auto-approved
  - Wire transfers - for amounts > $100,000 or IRA accounts, requires admin approval

### About This Guide
This guide is **technology-agnostic**. While code examples use Python-like syntax for readability, you can implement this backend in any language/framework (Python, Node.js, Java, Go, etc.).

The critical requirement is that your implementation:
- Produces identical calculation results (penny-perfect)
- Follows the same data model structure (JSON format)
- Provides the same REST API endpoints
- Maintains transaction immutability for audit trails

**Reference Implementation:** A working Next.js implementation exists at `/lib/` and `/app/api/` - use it to verify your calculations match exactly.

### Key Requirements
- **Penny-perfect calculations** - Must match reference implementation exactly
- **Sequential IDs** - Human-readable (USR-1001, INV-10000, not UUIDs)
- **App time system** - Admin-controlled time for testing/demos
- **Complete audit trail** - Immutable transaction records for all financial activity (for external tax reporting and compliance)
- **RESTful JSON API** - Standard HTTP endpoints for frontend integration
- **Data persistence** - Reliable storage layer (database of your choice)

---

## Core Business Rules

### Investment Amounts
```python
MIN_INVESTMENT = 1000  # $1,000 minimum
INVESTMENT_INCREMENT = 10  # Must be divisible by $10

def validate_amount(amount):
    if amount < MIN_INVESTMENT:
        raise ValueError(f"Minimum investment is ${MIN_INVESTMENT}")
    if amount % INVESTMENT_INCREMENT != 0:
        raise ValueError(f"Amount must be in ${INVESTMENT_INCREMENT} increments")
    return True
```

### Interest Rates
```python
RATES = {
    '1-year': 0.08,  # 8% APY
    '3-year': 0.10   # 10% APY
}

def get_monthly_rate(lockup_period):
    return RATES[lockup_period] / 12
```

### Payment Methods & Auto-Approval
```python
# Payment method options: 'ach' or 'wire'
# ACH: Uses Plaid or similar integration, automatically approved
# Wire: Manual bank transfer, requires admin approval

ACH_MAX_AMOUNT = 100000  # $100,000 ACH limit

def validate_payment_method(amount, payment_method, account_type):
    """
    Validate payment method based on amount and account type.

    Rules:
    - ACH: Max $100,000 (Plaid/similar limitations)
    - Wire: Required for amounts > $100,000
    - IRA: Must use wire transfers only
    """
    if account_type == 'ira' and payment_method != 'wire':
        raise ValueError("IRA accounts must use wire transfer")

    if amount > ACH_MAX_AMOUNT and payment_method == 'ach':
        raise ValueError(
            f"Investments over ${ACH_MAX_AMOUNT:,} must use wire transfer "
            f"(ACH provider limitations)"
        )

    return True

def should_auto_approve(payment_method):
    """ACH investments are automatically approved, wire requires admin approval"""
    return payment_method == 'ach'
```

### Account Type Restrictions
```python
# IRA accounts have specific restrictions:
# 1. Must use wire transfer (no ACH)
# 2. Must use compounding payment frequency (no monthly payouts)

def validate_ira_restrictions(account_type, payment_frequency, payment_method):
    if account_type == 'ira':
        if payment_frequency == 'monthly':
            raise ValueError("IRA accounts can only use compounding payment frequency")
        if payment_method != 'wire':
            raise ValueError("IRA accounts must use wire transfer")
    return True
```

---

## Authentication & Security

### JWT-Based Authentication

The platform uses **JWT (JSON Web Tokens)** for secure, stateless authentication with HTTP-only cookies.

#### Authentication Flow
```python
# 1. User Login
POST /api/auth/login
{
    "email": "user@example.com",
    "password": "SecurePass123!"
}

# Response: Sets HTTP-only cookies (auth-token, refresh-token)
# Returns user data without sensitive fields

# 2. Subsequent Requests
# Frontend automatically sends cookies with each request
# Backend validates JWT on protected routes

# 3. Token Refresh
POST /api/auth/refresh
# Uses refresh-token cookie to get new access token
# Returns new access token, updates cookie

# 4. Logout
POST /api/auth/logout
# Clears authentication cookies
```

#### Password Hashing
```python
import bcrypt

def hash_password(password):
    """Hash password with bcrypt (10 salt rounds)"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(10))

def verify_password(password, hashed):
    """Verify password against bcrypt hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# CRITICAL: All new passwords must be hashed
# Existing plain-text passwords are automatically migrated on first login
```

#### JWT Token Structure
```python
# Access Token (7 days expiry)
{
    "userId": "USR-1001",
    "email": "user@example.com",
    "isAdmin": false,
    "exp": 1234567890  # Unix timestamp
}

# Refresh Token (30 days expiry)
{
    "userId": "USR-1001",
    "email": "user@example.com",
    "exp": 1234567890
}

# Environment Variables (REQUIRED)
JWT_SECRET = "your-secure-secret-here"  # Generate with crypto.randomBytes(32)
JWT_REFRESH_SECRET = "your-refresh-secret-here"  # Different from JWT_SECRET
```

#### HTTP-Only Cookie Security
```python
# Cookies set by backend with these flags:
{
    "httpOnly": True,      # Prevents JavaScript access (XSS protection)
    "secure": True,        # HTTPS only in production
    "sameSite": "lax",     # CSRF protection
    "maxAge": 604800       # 7 days for access token
}

# Frontend never directly accesses tokens
# All authentication state managed server-side
```

### Master Password System (Admin Testing)

Admins can generate temporary master passwords to access any investor account for testing.

```python
def generate_master_password(admin_user_id):
    """
    Generate 16-character secure password valid for 30 minutes.
    Allows admin to login as any investor using: investor_email + master_password
    """
    import secrets
    import string
    
    # Generate secure random password
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(chars) for _ in range(16))
    
    # Hash and store with expiration
    hashed = hash_password(password)
    expires_at = now() + timedelta(minutes=30)
    
    store_master_password({
        'masterPassword': hashed,
        'expiresAt': expires_at.isoformat(),
        'generatedBy': admin_user_id,
        'generatedAt': now().isoformat()
    })
    
    return {
        'password': password,  # Return plain text once
        'expiresAt': expires_at.isoformat()
    }

def verify_master_password(password):
    """Check if password matches active master password"""
    data = get_master_password_data()
    
    if not data:
        return False
    
    # Check expiration
    if now() > parse_datetime(data['expiresAt']):
        return False
    
    # Verify password
    return verify_password(password, data['masterPassword'])

# Login Flow Enhancement
def authenticate_user(email, password):
    user = get_user_by_email(email)
    if not user:
        raise AuthError("Invalid credentials")
    
    # Check master password first
    if verify_master_password(password):
        # Admin using master password to access investor account
        return create_session(user)
    
    # Check user's actual password
    if verify_password(password, user.password):
        return create_session(user)
    
    raise AuthError("Invalid credentials")
```

### User Sign-Up Flow
1. User creates account → `isVerified: false`
2. User immediately logged in → redirected to `/confirmation`
3. User enters code `000000` (test) → `isVerified: true`
4. User can now create investments

### Verification Requirements
```python
def can_create_investment(user):
    """User must be verified before creating investments"""
    if not user.is_verified:
        raise PermissionError("Please verify your email before investing")
    return True
```

### Password Reset = Email Verification
```python
def reset_password(token, new_password):
    """
    Completing password reset automatically verifies account.
    Proves email ownership.
    """
    user = find_user_by_reset_token(token)
    if not user or is_token_expired(token):
        raise ValueError("Invalid or expired token")

    user.password = hash_password(new_password)  # MUST hash password
    user.is_verified = True  # Auto-verify
    user.verified_at = user.verified_at or now()
    user.reset_token = None
    save_user(user)
```

### Seamless Password Migration
```python
def login_with_migration(email, password):
    """
    Automatically migrates plain-text passwords to hashed on first login.
    Ensures backward compatibility with existing users.
    """
    user = get_user_by_email(email)
    if not user:
        raise AuthError("Invalid credentials")
    
    # Check if password is already hashed (starts with $2a$ or $2b$)
    if user.password.startswith('$2'):
        # Already hashed - use bcrypt compare
        if not verify_password(password, user.password):
            raise AuthError("Invalid credentials")
    else:
        # Plain text - compare directly, then hash
        if user.password != password:
            raise AuthError("Invalid credentials")
        
        # Migrate to hashed
        user.password = hash_password(password)
        save_user(user)
        print(f"Migrated password for user: {user.email}")
    
    return create_session(user)
```

### Protected Route Middleware
```python
def require_auth(request):
    """
    Middleware to protect routes requiring authentication.
    Extracts JWT from HTTP-only cookie and validates.
    """
    token = extract_token_from_cookie(request)
    
    if not token:
        raise AuthError("Not authenticated", 401)
    
    try:
        payload = verify_jwt(token, JWT_SECRET)
        return payload  # Contains userId, email, isAdmin
    except JWTExpiredError:
        raise AuthError("Token expired", 401)
    except JWTInvalidError:
        raise AuthError("Invalid token", 401)

def require_admin(request):
    """
    Middleware to protect admin-only routes.
    Validates JWT and checks isAdmin flag.
    """
    user = require_auth(request)
    
    if not user.get('isAdmin'):
        raise AuthError("Admin access required", 403)
    
    return user

# Usage in route handlers:
def get_admin_accounts(request):
    admin = require_admin(request)  # Throws if not admin
    users = get_all_users()
    return {"accounts": users}
```

### Session Management
- **Access Token:** 7 days expiry (can be refreshed)
- **Refresh Token:** 30 days expiry (longer-lived)
- **Logout:** Clears both tokens via HTTP-only cookies
- **Token Refresh:** Automatic on frontend, or manual via `/api/auth/refresh`
- **Cross-tab Sync:** localStorage event listeners for logout coordination

### Security Best Practices

#### Password Requirements
```python
MIN_PASSWORD_LENGTH = 8

def validate_password(password):
    """Validate password strength"""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    
    # Optional: Add complexity requirements
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    
    if not (has_upper and has_lower and has_digit):
        raise ValueError("Password must contain uppercase, lowercase, and numbers")
    
    return True
```

#### Token Security
```python
# Environment Configuration
JWT_SECRET = os.getenv('JWT_SECRET')  # MUST be set in production
JWT_REFRESH_SECRET = os.getenv('JWT_REFRESH_SECRET')

if not JWT_SECRET or not JWT_REFRESH_SECRET:
    raise RuntimeError("JWT secrets not configured - REQUIRED for production")

# Rotate secrets periodically (every 90 days recommended)
# Use strong secrets: crypto.randomBytes(32).toString('hex')
```

#### Rate Limiting (Recommended)
```python
# Prevent brute force attacks
LOGIN_ATTEMPTS_LIMIT = 5
LOGIN_LOCKOUT_MINUTES = 15

def check_rate_limit(email):
    """Track failed login attempts"""
    attempts = get_failed_attempts(email)

    if attempts >= LOGIN_ATTEMPTS_LIMIT:
        lockout_until = get_lockout_time(email)
        if now() < lockout_until:
            raise AuthError(f"Too many failed attempts. Try again in {minutes_remaining} minutes")
        else:
            reset_failed_attempts(email)

    return True

def record_failed_login(email):
    """Increment failed attempts counter"""
    increment_failed_attempts(email)
    attempts = get_failed_attempts(email)

    if attempts >= LOGIN_ATTEMPTS_LIMIT:
        set_lockout_time(email, now() + timedelta(minutes=LOGIN_LOCKOUT_MINUTES))
```

#### CORS (Cross-Origin Resource Sharing)

The platform includes secure CORS configuration to control which origins can access the API.

**Automatic Configuration:**
```python
# CORS is automatically handled by Next.js middleware (middleware.js)
# All /api/* routes get CORS headers automatically
# No changes needed to individual API routes
```

**Allowed Origins:**
```python
# Production domains
ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_APP_URL,
    'https://invest.robertventures.com',
    'https://www.invest.robertventures.com',
    # Netlify deploy URLs
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
]

# Development (NODE_ENV !== 'production')
ALLOWED_ORIGINS += [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    # Pattern matching for:
    # - https://*.netlify.app
    # - http://(localhost|127.0.0.1):*
]
```

**CORS Headers:**
```python
# For allowed origins:
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, ...
Access-Control-Max-Age: 86400  # 24 hours

# For blocked origins:
# - No CORS headers
# - Browser blocks response
```

**Preflight Requests (OPTIONS):**
```python
# Browser automatically sends OPTIONS request before:
# - Requests with credentials (cookies)
# - Requests with custom headers
# - Non-simple requests (PUT, DELETE, etc.)

# Server responds with:
204 No Content  # If origin allowed
403 Forbidden   # If origin blocked
```

**Environment Configuration:**
```bash
# Required for CORS origin validation
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional for Netlify
DEPLOY_PRIME_URL=https://main--your-site.netlify.app
DEPLOY_URL=https://deploy-preview-123--your-site.netlify.app
```

**Testing:**
```python
def test_cors():
    # Test allowed origin
    response = get('/api/users', headers={
        'Origin': 'https://invest.robertventures.com'
    })
    assert 'Access-Control-Allow-Origin' in response.headers
    assert response.headers['Access-Control-Allow-Origin'] == 'https://invest.robertventures.com'

    # Test blocked origin
    response = get('/api/users', headers={
        'Origin': 'https://malicious-site.com'
    })
    assert 'Access-Control-Allow-Origin' not in response.headers
```

#### HTTPS Enforcement

The platform automatically enforces HTTPS in production with HSTS (HTTP Strict Transport Security).

**Automatic Redirect (Production Only):**
```python
# Middleware automatically redirects HTTP to HTTPS
# http://invest.robertventures.com/dashboard
# → 301 Redirect →
# https://invest.robertventures.com/dashboard
```

**Implementation:**
```python
# Check protocol from proxy/load balancer
protocol = request.headers.get('x-forwarded-proto') or 'http'

if process.env.NODE_ENV == 'production' and protocol == 'http':
    # Build HTTPS URL
    https_url = f"https://{host}{path}{query_string}"

    # 301 Permanent Redirect with HSTS header
    return Response(status=301, headers={
        'Location': https_url,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    })
```

**HSTS Header (Production Only):**
```python
# Added to ALL responses in production
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# Parameters:
# - max-age=31536000: Browser enforces HTTPS for 1 year
# - includeSubDomains: Applies to all subdomains
# - preload: Eligible for browser preload lists
```

**How HSTS Works:**
```python
# First Visit:
1. User types: http://invest.robertventures.com
2. Server redirects: 301 → https://invest.robertventures.com
3. Browser receives: Strict-Transport-Security header
4. Browser remembers: "Always use HTTPS for this domain"

# Subsequent Visits:
1. User types: http://invest.robertventures.com
2. Browser automatically uses: https://invest.robertventures.com
3. No HTTP request sent (protected from SSL stripping)
```

**Environment Configuration:**
```bash
# Production: HTTPS enforced
NODE_ENV=production

# Development: HTTP allowed (no SSL certificate needed)
NODE_ENV=development
```

**Security Benefits:**
- All traffic encrypted (TLS/SSL)
- Man-in-the-middle attack prevention
- SSL stripping attack prevention
- Browser-level enforcement via HSTS
- Eligible for HSTS preload lists

**Testing:**
```python
def test_https_redirect():
    # Production: HTTP → HTTPS
    os.environ['NODE_ENV'] = 'production'
    response = get('http://invest.robertventures.com/dashboard')
    assert response.status_code == 301
    assert response.headers['Location'] == 'https://invest.robertventures.com/dashboard'
    assert 'Strict-Transport-Security' in response.headers

def test_hsts_header():
    # HTTPS requests get HSTS header
    response = get('https://invest.robertventures.com/dashboard')
    assert response.headers['Strict-Transport-Security'] == 'max-age=31536000; includeSubDomains; preload'
```

#### Audit Logging (Compliance)

The platform includes comprehensive audit logging for privileged operations, security events, and compliance requirements (SOC 2, HIPAA, GDPR).

**Architecture:**
```python
# Audit Log Entry Structure
{
    "id": "AUDIT-1705320600000-a3k9x7",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "eventType": "master_password_login",  # Event classification
    "actorId": "USR-1001",                 # Who performed the action
    "actorEmail": "admin@rv.com",
    "actorIP": "192.168.1.100",
    "targetUserId": "USR-1002",            # Who was affected (if applicable)
    "targetEmail": "investor@example.com",
    "details": {},                          # Event-specific metadata
    "severity": "high",                     # low, medium, high, critical
    "metadata": {
        "userAgent": "Mozilla/5.0...",
        "requestId": "req-123"
    }
}
```

**Event Types:**
```python
# Authentication Events
- master_password_login           # Admin logged in as investor using master password
- master_password_generated       # Admin generated new master password
- password_reset_requested        # User requested password reset
- password_reset_completed        # User completed password reset

# Administrative Events
- admin_impersonation            # Admin accessed user account
- user_data_accessed             # Admin viewed sensitive user data
- investment_approved            # Admin approved investment
- investment_rejected            # Admin rejected investment
- withdrawal_approved            # Admin approved withdrawal
- document_uploaded              # Admin uploaded document for user
- document_deleted               # Admin deleted document

# Security Events
- rate_limit_exceeded            # User/IP exceeded rate limit
- invalid_token_used             # Invalid JWT token attempted
- unauthorized_access_attempt    # Access to protected resource denied
```

**Logging Functions:**
```python
def log_audit_event(event):
    """
    Log security/compliance event to audit log.
    Append-only, immutable after creation.
    """
    audit_entry = {
        'id': generate_audit_id(),
        'timestamp': get_current_time().isoformat(),
        'eventType': event.event_type,
        'actorId': event.actor_id,
        'actorEmail': event.actor_email,
        'actorIP': event.actor_ip,
        'targetUserId': event.target_user_id,
        'targetEmail': event.target_email,
        'details': event.details or {},
        'severity': event.severity or 'medium',
        'metadata': {
            'userAgent': event.user_agent,
            'requestId': event.request_id
        }
    }

    append_to_audit_log(audit_entry)
    return audit_entry

def query_audit_logs(filters=None):
    """
    Query audit logs with filtering.

    Filters:
    - event_type: Filter by event type
    - actor_id: Filter by who performed action
    - target_user_id: Filter by affected user
    - start_date: From date (inclusive)
    - end_date: To date (inclusive)
    - severity: Filter by severity level
    - limit: Max results (default 100, max 1000)
    """
    logs = load_audit_logs()

    if filters:
        if filters.get('event_type'):
            logs = [l for l in logs if l['eventType'] == filters['event_type']]
        if filters.get('actor_id'):
            logs = [l for l in logs if l['actorId'] == filters['actor_id']]
        if filters.get('target_user_id'):
            logs = [l for l in logs if l['targetUserId'] == filters['target_user_id']]
        if filters.get('start_date'):
            logs = [l for l in logs if l['timestamp'] >= filters['start_date']]
        if filters.get('end_date'):
            logs = [l for l in logs if l['timestamp'] <= filters['end_date']]
        if filters.get('severity'):
            logs = [l for l in logs if l['severity'] == filters['severity']]

    # Sort by timestamp descending (most recent first)
    logs = sorted(logs, key=lambda l: l['timestamp'], reverse=True)

    # Apply limit
    limit = min(filters.get('limit', 100), 1000) if filters else 100
    return logs[:limit]
```

**Storage:**
```python
# Audit logs stored separately from user data
# Options:
# 1. Dedicated file: data/audit-log.json
# 2. Separate database table: audit_logs
# 3. Netlify Blobs: store name "audit-logs"

# Auto-rotation: Keep last 10,000 entries or 1 year
# Archive older logs to cold storage for compliance
```

**Integration Examples:**

**Master Password Login:**
```python
def authenticate_user(email, password):
    user = get_user_by_email(email)

    # Check master password first
    if verify_master_password(password):
        # Log audit event
        log_audit_event({
            'event_type': 'master_password_login',
            'actor_id': None,  # Admin not logged in yet
            'actor_email': None,
            'actor_ip': get_client_ip(),
            'target_user_id': user.id,
            'target_email': user.email,
            'severity': 'high',
            'details': {'method': 'master_password'}
        })

        return create_session(user)

    # Regular password check...
```

**Master Password Generation:**
```python
def generate_master_password(admin_user):
    password = generate_secure_password()
    expires_at = now() + timedelta(minutes=30)

    # Store hashed password
    store_master_password({
        'masterPassword': hash_password(password),
        'expiresAt': expires_at.isoformat(),
        'generatedBy': admin_user.id
    })

    # Log audit event
    log_audit_event({
        'event_type': 'master_password_generated',
        'actor_id': admin_user.id,
        'actor_email': admin_user.email,
        'actor_ip': get_client_ip(),
        'severity': 'critical',
        'details': {
            'expires_at': expires_at.isoformat(),
            'valid_for_minutes': 30
        }
    })

    return {'password': password, 'expiresAt': expires_at}
```

**API Endpoint:**
```python
GET /api/admin/audit-logs
# Query audit logs (admin only)

Query Parameters:
- eventType: string (optional)
- actorId: string (optional)
- targetUserId: string (optional)
- startDate: ISO date (optional)
- endDate: ISO date (optional)
- severity: "low" | "medium" | "high" | "critical" (optional)
- limit: number (optional, default 100, max 1000)

Response:
{
    "success": true,
    "logs": [
        {
            "id": "AUDIT-1705320600000-a3k9x7",
            "timestamp": "2025-01-15T10:30:00.000Z",
            "eventType": "master_password_login",
            "actorEmail": "admin@rv.com",
            "targetEmail": "investor@example.com",
            "severity": "high",
            "actorIP": "192.168.1.100"
        }
    ],
    "total": 1
}
```

**Compliance Features:**
- **Immutable logs**: Events cannot be modified or deleted after creation
- **Append-only**: All events are logged, no overwrites
- **Automatic rotation**: Keeps last 10,000 entries by default
- **Comprehensive tracking**: Who did what, when, to whom, from where
- **Query capabilities**: Filter by event type, user, date range, severity
- **Retention policy**: 1 year minimum for compliance (configurable)

**Testing:**
```python
def test_audit_logging():
    # Generate master password
    admin = login_as_admin()
    response = post('/api/admin/generate-master-password', cookies=admin.cookies)

    # Verify audit log created
    logs = query_audit_logs({'event_type': 'master_password_generated'})
    assert len(logs) == 1
    assert logs[0]['actorId'] == admin.user_id
    assert logs[0]['severity'] == 'critical'

    # Use master password
    master_password = response.json['password']
    investor_login = post('/api/auth/login', {
        'email': 'investor@example.com',
        'password': master_password
    })

    # Verify master password usage logged
    logs = query_audit_logs({'event_type': 'master_password_login'})
    assert len(logs) == 1
    assert logs[0]['targetEmail'] == 'investor@example.com'
    assert logs[0]['severity'] == 'high'
```

---

## Data Models

### User
```python
{
    "id": "USR-1001",
    "email": "user@example.com",
    "password": "hashed",
    "isVerified": true,
    "verifiedAt": "2024-01-15T10:00:00.000Z",
    "isAdmin": false,

    # Profile
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "dob": "1990-01-01",
    "ssn": "123-45-6789",
    "address": {
        "street1": "123 Main St",
        "street2": null,
        "city": "Boston",
        "state": "Massachusetts",  # Full name, not abbreviation
        "zip": "02108"
    },

    # Account type (locked when first investment becomes pending/active)
    "accountType": "individual",  # 'individual' | 'joint' | 'entity' | 'ira' | null

    # Joint account fields (only if accountType='joint')
    "jointHoldingType": "joint_tenants",  # 'joint_tenants' | 'tenants_in_common'
    "jointHolder": {
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane@example.com",
        "phone": "+1234567890",
        "dob": "1992-05-15",
        "ssn": "987-65-4321",
        "address": {...}
    },

    # Entity fields (only if accountType='entity')
    "entity": {
        "name": "My LLC",
        "type": "LLC",  # 'LLC' | 'Corp' | 'Trust' | 'Partnership'
        "ein": "12-3456789",
        "formationState": "Delaware"
    },

    # Banking
    "bankAccounts": [
        {
            "id": "BANK-USR-1001-1",
            "nickname": "Chase Checking",
            "accountType": "checking",
            "lastFour": "1234",
            "isPrimary": true,
            "createdAt": "2024-01-15T10:00:00.000Z"
        }
    ],

    # Investments
    "investments": [...],

    # Activity (transactions)
    "activity": [...],

    # Timestamps
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

### Investment
```python
{
    "id": "INV-10000",
    "userId": "USR-1001",
    "status": "active",  # 'draft' | 'pending' | 'active' | 'withdrawal_notice' | 'withdrawn' | 'rejected'

    # Core fields
    "amount": 10000,
    "lockupPeriod": "1-year",  # '1-year' | '3-year'
    "paymentFrequency": "compounding",  # 'monthly' | 'compounding'
    "accountType": "individual",
    "paymentMethod": "ach",  # 'ach' | 'wire'

    # Approval fields (Phase 1: ACH auto-approved)
    "autoApproved": true,  # ACH investments only
    "autoApprovedReason": "ACH payment method",
    "requiresManualApproval": false,  # Wire investments only

    # Confirmation
    "confirmedAt": "2024-10-05T09:00:00.000Z",  # When investment became active
    "confirmationSource": "auto_ach",  # 'auto_ach' | 'admin' | 'system'
    "lockupEndDate": "2025-10-05T09:00:00.000Z",  # confirmedAt + lockup period

    # Rejection (if status='rejected')
    "rejectedAt": null,
    "rejectionReason": null,

    # Joint account fields (if accountType='joint')
    "jointHolder": {...},
    "jointHoldingType": "joint_tenants",

    # Entity fields (if accountType='entity')
    "entity": {...},

    # Timestamps
    "createdAt": "2024-10-05T08:30:00.000Z",
    "updatedAt": "2024-10-05T09:00:00.000Z"
}
```

### Transaction (Activity Event)
```python
{
    "id": "TX-INV-10000-DIST-2024-11",
    "userId": "USR-1001",
    "investmentId": "INV-10000",
    "type": "distribution",  # 'investment' | 'distribution' | 'contribution' | 'redemption'
    "amount": 83.33,
    "date": "2024-11-01T09:00:00.000Z",
    "status": "approved",

    # Compounding-specific fields
    "distributionTxId": null,  # For contributions: links to distribution that generated it

    # Distribution sorting (ensures distribution appears before contribution)
    "monthIndex": 1,  # Month number since confirmation
    "sortOrder": 0  # 0=distribution, 1=contribution
}
```

---

## ID Architecture

### ID Formats
| Entity | Format | Example | Notes |
|--------|--------|---------|-------|
| User | `USR-{seq}` | `USR-1001` | Admin is `USR-1000` |
| Investment | `INV-{seq}` | `INV-10000` | Global (not per-user) |
| Withdrawal | `WDL-{seq}` | `WDL-10000` | Global |
| Bank | `BANK-{userId}-{seq}` | `BANK-USR-1001-2` | Per-user |
| Transaction | `TX-{type}-{id}-{suffix}` | `TX-INV-10000-DIST-2024-11` | **ALL UPPERCASE** |

### Transaction ID Patterns
```python
def generate_transaction_id(entity_type, entity_id, event_type, **kwargs):
    """
    Generate activity event ID.
    IMPORTANT: All uppercase, strip entity prefix from numeric portion.

    Examples:
    - TX-USR-1001-ACCOUNT-CREATED
    - TX-INV-10000-CREATED
    - TX-INV-10000-CONFIRMED
    - TX-INV-10000-DIST-2024-11
    - TX-INV-10000-CONTR-2024-11
    - TX-WDL-10000-NOTICE
    """
    # Strip prefix (e.g., "INV-10000" -> "10000")
    numeric_id = entity_id.split('-')[-1]
    prefix = f"TX-{entity_type}-{numeric_id}"

    if event_type == "account_created":
        return f"{prefix}-ACCOUNT-CREATED"
    elif event_type == "investment_created":
        return f"{prefix}-CREATED"
    elif event_type == "investment_confirmed":
        return f"{prefix}-CONFIRMED"
    elif event_type == "distribution":
        date = kwargs['date']
        return f"{prefix}-DIST-{date.year}-{date.month:02d}"
    elif event_type == "contribution":
        date = kwargs['date']
        return f"{prefix}-CONTR-{date.year}-{date.month:02d}"
    elif event_type == "redemption":
        date = kwargs['date']
        return f"{prefix}-REDEEM-{date.year}-{date.month:02d}-{date.day:02d}"
    elif event_type == "withdrawal_notice":
        return f"{prefix}-NOTICE"
    elif event_type == "withdrawal_approved":
        return f"{prefix}-APPROVED"

    return f"{prefix}-{event_type.upper()}"
```

### Sequential ID Generation
```python
def generate_user_id(users):
    """Admin always gets USR-1000"""
    if not users:
        return "USR-1000"
    max_id = max([int(u.id.split('-')[1]) for u in users])
    return f"USR-{max_id + 1}"

def generate_investment_id(all_users):
    """Global across all users"""
    all_investments = [inv for user in all_users for inv in user.investments]
    if not all_investments:
        return "INV-10000"
    max_id = max([int(inv.id.split('-')[1]) for inv in all_investments])
    return f"INV-{max_id + 1}"
```

---

## Investment State Machine

### States
```
draft → pending → active → withdrawal_notice → withdrawn
              ↓
           rejected
```

### Transition Rules
```python
VALID_TRANSITIONS = {
    'draft': ['pending'],
    'pending': ['active', 'rejected'],
    'active': ['withdrawal_notice'],
    'withdrawal_notice': ['withdrawn'],
    'rejected': [],  # Terminal
    'withdrawn': []  # Terminal
}

def can_transition(current_status, new_status):
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise ValueError(
            f"Invalid transition from '{current_status}' to '{new_status}'. "
            f"Allowed: {', '.join(allowed) or 'none'}"
        )
```

### State Behaviors
| State | Interest? | Can Edit? | Final? |
|-------|-----------|-----------|--------|
| draft | ❌ | ✅ | No |
| pending | ❌ | ❌ | No |
| active | ✅ | ❌ | No |
| withdrawal_notice | ✅ | ❌ | No |
| withdrawn | ❌ | ❌ | Yes |
| rejected | ❌ | ❌ | Yes |

### Auto-Approval Logic (ACH)
```python
def update_investment_status(investment, new_status):
    """
    When investment transitions to pending:
    - ACH: Auto-approve → immediately activate
    - Wire: Keep pending → wait for manual approval
    """
    if new_status == 'pending':
        if investment.payment_method == 'ach':
            # Auto-approve ACH investments
            investment.status = 'active'
            investment.auto_approved = True
            investment.auto_approved_reason = 'ACH payment method'
            investment.confirmed_at = get_current_app_time()
            investment.confirmation_source = 'auto_ach'

            # Calculate lockup end
            years = 3 if investment.lockup_period == '3-year' else 1
            investment.lockup_end_date = add_years(investment.confirmed_at, years)
        else:
            # Wire: keep pending for manual approval
            investment.status = 'pending'
            investment.requires_manual_approval = True
            investment.manual_approval_reason = 'Wire transfer payment method'
```

---

## Interest Calculations

### Key Principles
1. **Interest accrues from day AFTER confirmation**
2. **Round to cents after each period** (prevents floating-point errors)
3. **By default, calculate to last completed month end** (not current day)
4. **Exception: Withdrawals include partial final month**
5. **Proration only at start/end** (dual strategy)

### Monthly Payout Calculation
```python
def calculate_monthly_payout_value(investment, as_of_date=None):
    """
    Monthly payout: principal stays same, interest paid monthly
    """
    if investment.status not in ['active', 'withdrawal_notice', 'withdrawn']:
        return {
            'current_value': investment.amount,
            'total_earnings': 0,
            'months_elapsed': 0
        }

    confirmed_date = parse_date(investment.confirmed_at)
    accrual_start = add_days(confirmed_date, 1)  # Day after confirmation
    current_date = as_of_date or get_current_app_time()

    # Find last completed month end (not current date)
    calculation_end = find_last_completed_month_end(accrual_start, current_date)

    # Build segments (handles proration at start/end)
    segments = build_accrual_segments(accrual_start, calculation_end)

    # Calculate earnings
    monthly_rate = get_monthly_rate(investment.lockup_period)
    monthly_interest = round(investment.amount * monthly_rate, 2)

    total_earnings = 0
    for segment in segments:
        if segment.type == 'full':
            # Full month
            total_earnings = round(total_earnings + monthly_interest, 2)
        else:
            # Partial month (proration)
            prorated = round(monthly_interest * (segment.days / segment.days_in_month), 2)
            total_earnings = round(total_earnings + prorated, 2)

    return {
        'current_value': investment.amount,
        'total_earnings': total_earnings,
        'months_elapsed': len([s for s in segments if s.type == 'full']) +
                         sum([s.days / s.days_in_month for s in segments if s.type == 'partial'])
    }
```

### Compounding Calculation
```python
def calculate_compounding_value(investment, as_of_date=None, include_partial_month=False):
    """
    Compounding: interest added to principal each period

    Args:
        include_partial_month: If True, include partial current month (for withdrawals)
    """
    if investment.status not in ['active', 'withdrawal_notice', 'withdrawn']:
        return {
            'current_value': investment.amount,
            'total_earnings': 0,
            'months_elapsed': 0
        }

    confirmed_date = parse_date(investment.confirmed_at)
    accrual_start = add_days(confirmed_date, 1)
    current_date = as_of_date or get_current_app_time()

    # Calculate to last completed month end (unless include_partial_month=True)
    if include_partial_month:
        calculation_end = current_date
    else:
        calculation_end = find_last_completed_month_end(accrual_start, current_date)

    segments = build_accrual_segments(accrual_start, calculation_end)

    # Compound interest
    monthly_rate = get_monthly_rate(investment.lockup_period)
    balance = investment.amount
    total_earnings = 0

    for segment in segments:
        if segment.type == 'full':
            # Full month: simple monthly rate
            interest = round(balance * monthly_rate, 2)
            balance = round(balance + interest, 2)
            total_earnings = round(total_earnings + interest, 2)
        else:
            # Partial month: daily prorated
            daily_rate = monthly_rate / segment.days_in_month
            interest = round(balance * daily_rate * segment.days, 2)
            balance = round(balance + interest, 2)
            total_earnings = round(total_earnings + interest, 2)

    return {
        'current_value': balance,
        'total_earnings': total_earnings,
        'months_elapsed': len([s for s in segments if s.type == 'full']) +
                         sum([s.days / s.days_in_month for s in segments if s.type == 'partial'])
    }
```

### Accrual Segments (Proration Logic)
```python
def build_accrual_segments(start_date, end_date):
    """
    Build segments for interest calculation.
    Handles proration at start/end of investment period.

    Returns:
    [
        {'type': 'partial', 'start': date1, 'end': date2, 'days': 15, 'days_in_month': 31},
        {'type': 'full', 'start': date3, 'end': date4, 'days': 30, 'days_in_month': 30},
        ...
    ]
    """
    if end_date < start_date:
        return []

    segments = []
    cursor = start_date

    # First partial month (if not starting on 1st)
    if cursor.day != 1:
        days_in_month = get_days_in_month(cursor)
        month_end = end_of_month(cursor)
        segment_end = min(month_end, end_date)

        segments.append({
            'type': 'partial',
            'start': cursor,
            'end': segment_end,
            'days': (segment_end - cursor).days + 1,
            'days_in_month': days_in_month
        })
        cursor = add_days(segment_end, 1)

    # Full months
    while cursor <= end_date:
        days_in_month = get_days_in_month(cursor)
        month_end = end_of_month(cursor)

        if month_end <= end_date:
            # Full month
            segments.append({
                'type': 'full',
                'start': cursor,
                'end': month_end,
                'days': days_in_month,
                'days_in_month': days_in_month
            })
            cursor = add_days(month_end, 1)
        else:
            # Final partial month
            segments.append({
                'type': 'partial',
                'start': cursor,
                'end': end_date,
                'days': (end_date - cursor).days + 1,
                'days_in_month': days_in_month
            })
            break

    return segments
```

---

## Transaction System

### Transaction Types
```python
TRANSACTION_TYPES = {
    'investment': 'Initial investment (principal contribution)',
    'distribution': 'Interest earned (monthly payout or compounding)',
    'contribution': 'Reinvestment of distribution (compounding only)',
    'redemption': 'Withdrawal of principal + earnings'
}
```

### Compounding Transaction Structure
**Key Change (v2.2):** Compounding generates **TWO transactions per month**:

```python
def generate_monthly_compounding_transactions(investment, date):
    """
    Generate distribution + contribution for compounding investments.
    Both transactions have same date, time, monthIndex.
    """
    monthly_rate = get_monthly_rate(investment.lockup_period)
    interest = round(investment.amount * monthly_rate, 2)

    month_index = calculate_month_index(investment.confirmed_at, date)
    timestamp = f"{date.year}-{date.month:02d}-01T09:00:00.000Z"

    # 1. Distribution (interest earned)
    distribution = {
        'id': f"TX-INV-{investment.id.split('-')[1]}-DIST-{date.year}-{date.month:02d}",
        'type': 'distribution',
        'amount': interest,
        'date': timestamp,
        'status': 'approved',
        'monthIndex': month_index,
        'sortOrder': 0  # Always first
    }

    # 2. Contribution (reinvestment)
    contribution = {
        'id': f"TX-INV-{investment.id.split('-')[1]}-CONTR-{date.year}-{date.month:02d}",
        'type': 'contribution',
        'amount': interest,
        'date': timestamp,
        'status': 'approved',
        'monthIndex': month_index,
        'sortOrder': 1,  # Always second
        'distributionTxId': distribution['id']  # Link to distribution
    }

    return [distribution, contribution]
```

### Monthly Payout Transactions
```python
def generate_monthly_payout_transaction(investment, date):
    """
    Generate single distribution for monthly payout investments.
    """
    monthly_rate = get_monthly_rate(investment.lockup_period)
    interest = round(investment.amount * monthly_rate, 2)

    month_index = calculate_month_index(investment.confirmed_at, date)
    timestamp = f"{date.year}-{date.month:02d}-01T09:00:00.000Z"

    return {
        'id': f"TX-INV-{investment.id.split('-')[1]}-DIST-{date.year}-{date.month:02d}",
        'type': 'distribution',
        'amount': interest,
        'date': timestamp,
        'status': 'approved',
        'monthIndex': month_index
    }
```

### Transaction Immutability & Audit Trail
```python
"""
All transactions are immutable once created.
This ensures a complete audit trail of all financial activity.

Transactions should never be modified or deleted after creation.
If corrections are needed, create reversing/correcting transactions instead.

Purpose:
- Financial audit trail
- External tax reporting and compliance
- Accountant/tax professional access
- Regulatory compliance

The system records raw transaction data (type, amount, date, status).
Tax classification and reporting are handled externally by accountants
or tax software using this complete transaction history.
"""
```

---

## Withdrawal Rules

### Eligibility
```python
def can_withdraw(investment, current_date=None):
    """
    Investment can be withdrawn after lockup period ends.
    """
    if investment.status != 'active':
        return False

    lockup_end = parse_date(investment.lockup_end_date)
    check_date = current_date or get_current_app_time()

    return check_date >= lockup_end
```

### Withdrawal Amount
```python
def calculate_withdrawal_amount(investment, withdrawal_date=None):
    """
    Calculate final payout including partial month interest.
    IMPORTANT: Pass include_partial_month=True for withdrawals.
    """
    withdrawal_date = withdrawal_date or get_current_app_time()

    if investment.payment_frequency == 'compounding':
        result = calculate_compounding_value(
            investment,
            as_of_date=withdrawal_date,
            include_partial_month=True  # Include partial final month
        )
    else:
        result = calculate_monthly_payout_value(
            investment,
            as_of_date=withdrawal_date
        )

    return {
        'total_amount': result['current_value'],
        'principal': investment.amount,
        'earnings': result['total_earnings'],
        'withdrawal_date': withdrawal_date
    }
```

### Withdrawal State Transitions
```python
def request_withdrawal(investment):
    """User requests withdrawal"""
    if not can_withdraw(investment):
        raise ValueError("Investment is still in lockup period")

    investment.status = 'withdrawal_notice'
    # Investment continues earning interest during processing

def process_withdrawal(investment, admin_id):
    """Admin completes withdrawal"""
    if investment.status != 'withdrawal_notice':
        raise ValueError("No active withdrawal request")

    payout = calculate_withdrawal_amount(investment)
    investment.status = 'withdrawn'
    investment.withdrawn_at = get_current_app_time()

    # Create redemption transaction
    create_redemption_transaction(investment, payout)
```

---

## API Endpoints

### Authentication
```python
POST /api/users
# Sign up (hashes password automatically)
Request: {"email": "user@example.com", "password": "Pass123!"}
Response: {"success": true, "user": {...}}
Note: Password is hashed with bcrypt before storage

POST /api/auth/login
# Login (JWT-based, sets HTTP-only cookies)
Request: {"email": "user@example.com", "password": "Pass123!"}
Response: {"success": true, "user": {...}}
Cookies: auth-token (7 days), refresh-token (30 days)
Note: Also accepts master password for any investor account

POST /api/auth/logout
# Logout (clears cookies)
Request: {} (no body required)
Response: {"success": true, "message": "Logged out successfully"}
Cookies: Cleared

POST /api/auth/refresh
# Refresh access token using refresh token
Request: {} (uses refresh-token cookie)
Response: {"success": true, "message": "Token refreshed"}
Cookies: Updated auth-token

GET /api/auth/me
# Get current user from JWT
Request: {} (uses auth-token cookie)
Response: {"success": true, "user": {...}}
Note: Used to verify session and get user data

POST /api/auth/request-reset
# Request password reset
Request: {"email": "user@example.com"}
Response: {"success": true}

POST /api/auth/reset-password
# Reset password (auto-verifies account, hashes password)
Request: {"token": "abc123", "newPassword": "NewPass123!"}
Response: {"success": true, "message": "Password reset successful. Your account has been verified."}
```

### User Management
```python
GET /api/users/:id
# Get user details
Response: {"success": true, "user": {...}, "appTime": "2024-10-13T12:00:00.000Z"}

PUT /api/users/:id
# Update user profile
Request: {"firstName": "John", "lastName": "Doe", ...}
Response: {"success": true, "user": {...}}

PUT /api/users/:id
# Verify account
Request: {"_action": "verifyAccount", "verificationCode": "000000"}
Response: {"success": true, "user": {...}}

PUT /api/users/:id
# Change password
Request: {"_action": "changePassword", "currentPassword": "...", "newPassword": "..."}
Response: {"success": true, "user": {...}}
```

### Investment Management
```python
PUT /api/users/:id
# Start investment (draft)
Request: {
    "_action": "startInvestment",
    "investment": {
        "amount": 10000,
        "lockupPeriod": "1-year",
        "paymentFrequency": "compounding",
        "accountType": "individual",
        "paymentMethod": "ach"
    }
}
Response: {"success": true, "user": {...}, "investment": {...}}

PUT /api/users/:id
# Update investment
Request: {
    "_action": "updateInvestment",
    "investmentId": "INV-10000",
    "fields": {
        "status": "pending"  # ACH auto-approves → active
    }
}
Response: {"success": true, "user": {...}, "investment": {...}}

PUT /api/users/:id
# Delete draft investment
Request: {"_action": "deleteInvestment", "investmentId": "INV-10000"}
Response: {"success": true, "user": {...}}
```

### Admin Endpoints
```python
# All admin endpoints require JWT with isAdmin=true

GET /api/admin/accounts
# Get all users (admin only)
Headers: Cookie: auth-token=<jwt>
Response: {"success": true, "accounts": [...], "appTime": "..."}

POST /api/admin/time-machine
# Set app time (testing/demos)
Headers: Cookie: auth-token=<jwt>
Request: {"appTime": "2024-11-01T00:00:00.000Z"}
Response: {"success": true, "appTime": "2024-11-01T00:00:00.000Z"}

POST /api/admin/seed
# Seed test accounts
Headers: Cookie: auth-token=<jwt>
Response: {"success": true, "accounts": [...]}

POST /api/migrate-transactions
# Generate transactions for all investments
Response: {"success": true, "processed": 5}

POST /api/admin/generate-master-password
# Generate temporary master password (30 min expiry)
Headers: Cookie: auth-token=<jwt> (admin only)
Response: {
    "success": true,
    "password": "Xt9mK2#pQ5rL8wN$",  # Shown only once
    "expiresAt": "2024-01-15T11:30:00.000Z",
    "message": "Master password generated successfully..."
}

GET /api/admin/generate-master-password
# Get current master password info (not the actual password)
Headers: Cookie: auth-token=<jwt> (admin only)
Response: {
    "success": true,
    "hasPassword": true,
    "expiresAt": "2024-01-15T11:30:00.000Z",
    "generatedAt": "2024-01-15T11:00:00.000Z",
    "isExpired": false,
    "timeRemainingMs": 1800000
}
```

---

## Admin Features

### Profile Completion Validation
```python
def is_profile_complete(user):
    """
    Check if user profile is complete enough to approve investments.
    Required before admin can approve.
    """
    has_personal = all([
        user.first_name,
        user.last_name,
        user.phone,
        user.dob,
        user.ssn
    ])

    has_address = all([
        user.address,
        user.address.get('street1'),
        user.address.get('city'),
        user.address.get('state'),  # Must be full name, not abbreviation
        user.address.get('zip')
    ])

    has_bank = user.bank_accounts and len(user.bank_accounts) > 0

    return has_personal and has_address and has_bank
```

### Time Machine (App Time System)
```python
def set_app_time(target_date):
    """
    Set application time for testing/demos.
    All date calculations use this instead of system time.
    """
    data = load_data()
    data['appTime'] = target_date.isoformat()
    save_data(data)
    return target_date

def get_current_app_time():
    """
    Get current application time.
    Returns appTime if set, otherwise system time.
    """
    data = load_data()
    if data.get('appTime'):
        return parse_date(data['appTime'])
    return datetime.now()
```

---

## Testing Requirements

### JWT Authentication Testing

#### Test Scenario: JWT Login Flow
```python
def test_jwt_login_flow():
    # 1. User login
    response = post('/api/auth/login', {
        'email': 'user@example.com',
        'password': 'Pass123!'
    })
    assert response.status == 200
    assert 'auth-token' in response.cookies
    assert 'refresh-token' in response.cookies
    
    # 2. Verify session
    me_response = get('/api/auth/me', cookies=response.cookies)
    assert me_response.status == 200
    assert me_response.json['user']['email'] == 'user@example.com'
    
    # 3. Access protected route
    accounts_response = get('/api/admin/accounts', cookies=response.cookies)
    if response.json['user']['isAdmin']:
        assert accounts_response.status == 200
    else:
        assert accounts_response.status == 403  # Forbidden
```

#### Test Scenario: Password Migration
```python
def test_password_migration():
    # Create user with plain-text password
    user = create_user({
        'email': 'test@example.com',
        'password': 'PlainText123'
    })
    assert not user.password.startswith('$2')  # Plain text
    
    # Login (triggers migration)
    response = post('/api/auth/login', {
        'email': 'test@example.com',
        'password': 'PlainText123'
    })
    assert response.status == 200
    
    # Verify password is now hashed
    updated_user = get_user_by_email('test@example.com')
    assert updated_user.password.startswith('$2')  # Hashed
    
    # Verify can still login with same password
    response2 = post('/api/auth/login', {
        'email': 'test@example.com',
        'password': 'PlainText123'
    })
    assert response2.status == 200
```

#### Test Scenario: Master Password System
```python
def test_master_password():
    # 1. Generate master password (admin only)
    admin = authenticate_admin()
    response = post('/api/admin/generate-master-password', 
                    cookies=admin.cookies)
    
    assert response.status == 200
    master_password = response.json['password']
    expires_at = response.json['expiresAt']
    assert len(master_password) == 16
    
    # 2. Use master password to access investor account
    investor_response = post('/api/auth/login', {
        'email': 'investor@example.com',
        'password': master_password
    })
    assert investor_response.status == 200
    assert investor_response.json['user']['email'] == 'investor@example.com'
    
    # 3. Verify expiration after 30 minutes
    time.sleep(1801)  # 30 minutes + 1 second
    expired_response = post('/api/auth/login', {
        'email': 'investor@example.com',
        'password': master_password
    })
    assert expired_response.status == 401
```

#### Test Scenario: Protected Routes
```python
def test_protected_routes():
    # Without authentication
    response = get('/api/admin/accounts')
    assert response.status == 401
    
    # With user authentication (not admin)
    user_cookies = login_as_user()
    response = get('/api/admin/accounts', cookies=user_cookies)
    assert response.status == 403
    
    # With admin authentication
    admin_cookies = login_as_admin()
    response = get('/api/admin/accounts', cookies=admin_cookies)
    assert response.status == 200
```

#### Test Scenario: Token Refresh
```python
def test_token_refresh():
    # Login
    login_response = post('/api/auth/login', {
        'email': 'user@example.com',
        'password': 'Pass123!'
    })
    
    # Extract tokens
    refresh_token = login_response.cookies['refresh-token']
    
    # Simulate access token expiration (7 days later)
    time.travel(days=8)
    
    # Refresh token still valid (30 days)
    refresh_response = post('/api/auth/refresh', 
                           cookies={'refresh-token': refresh_token})
    assert refresh_response.status == 200
    assert 'auth-token' in refresh_response.cookies
    
    # New access token works
    me_response = get('/api/auth/me', cookies=refresh_response.cookies)
    assert me_response.status == 200
```

#### Test Scenario: Logout
```python
def test_logout():
    # Login
    login_response = post('/api/auth/login', {
        'email': 'user@example.com',
        'password': 'Pass123!'
    })
    cookies = login_response.cookies
    
    # Verify authenticated
    me_response = get('/api/auth/me', cookies=cookies)
    assert me_response.status == 200
    
    # Logout
    logout_response = post('/api/auth/logout', cookies=cookies)
    assert logout_response.status == 200
    
    # Verify cookies cleared
    assert logout_response.cookies['auth-token'] == ''
    assert logout_response.cookies['refresh-token'] == ''
    
    # Verify cannot access protected routes
    protected_response = get('/api/auth/me', cookies=logout_response.cookies)
    assert protected_response.status == 401
```

### Troubleshooting Guide

#### Common Issues

**Issue: "Invalid email or password" on login**
```python
# Check JWT secrets are configured
assert os.getenv('JWT_SECRET') is not None
assert os.getenv('JWT_REFRESH_SECRET') is not None

# Verify user exists
user = get_user_by_email(email)
assert user is not None

# Check password hash format
if user.password.startswith('$2'):
    # Properly hashed - use bcrypt.compare()
    assert bcrypt.compare(password, user.password)
else:
    # Plain text - should match exactly
    assert user.password == password
```

**Issue: Master password not working**
```python
# Verify master password exists and not expired
data = get_master_password_data()
assert data is not None
assert datetime.now() < parse_datetime(data['expiresAt'])

# Check password verification
assert verify_master_password(entered_password) == True
```

**Issue: Cookies not being set**
```python
# Verify cookie configuration
response.cookies.set('auth-token', token, {
    'httpOnly': True,
    'secure': True if PRODUCTION else False,  # HTTPS only in prod
    'sameSite': 'lax',
    'path': '/',
    'maxAge': 604800  # 7 days
})

# Frontend must include credentials
fetch('/api/auth/login', {
    credentials: 'include'  # REQUIRED for cookies
})
```

**Issue: Token expired errors**
```python
# This is normal behavior - tokens should expire
# Access token: 7 days
# Refresh token: 30 days

# Implement token refresh on frontend
if (response.status === 401) {
    // Try to refresh token
    const refreshResponse = await fetch('/api/auth/refresh', {
        credentials: 'include'
    })
    
    if (refreshResponse.ok) {
        // Retry original request
    } else {
        // Redirect to login
    }
}
```

### Test Scenarios

#### 1. Investment Lifecycle (ACH)
```python
def test_ach_investment_lifecycle():
    # 1. Create draft
    investment = create_investment(amount=10000, payment_method='ach')
    assert investment.status == 'draft'

    # 2. Submit (auto-approve)
    update_status(investment, 'pending')
    assert investment.status == 'active'  # Auto-approved
    assert investment.auto_approved == True
    assert investment.confirmed_at is not None

    # 3. Generate transactions
    sync_transactions()
    transactions = get_transactions(investment.id)
    assert len(transactions) >= 1  # Initial investment transaction
```

#### 2. Compounding Calculations
```python
def test_compounding_accuracy():
    investment = create_investment(
        amount=10000,
        lockup_period='1-year',
        payment_frequency='compounding',
        confirmed_at='2024-01-15T09:00:00.000Z'
    )

    # Month 1: $10,000 * (0.08 / 12) = $66.67
    set_app_time('2024-02-01T09:00:00.000Z')
    sync_transactions()

    txs = get_transactions(investment.id, month_index=1)
    assert len(txs) == 2  # Distribution + Contribution
    assert txs[0].type == 'distribution'
    assert txs[0].amount == 66.67
    assert txs[1].type == 'contribution'
    assert txs[1].amount == 66.67
    assert txs[1].distribution_tx_id == txs[0].id

    value = calculate_compounding_value(investment)
    assert value['current_value'] == 10066.67
    assert value['total_earnings'] == 66.67
```

#### 3. Transaction Audit Trail
```python
def test_transaction_audit_trail():
    investment = create_investment(confirmed_at='2024-01-15T09:00:00.000Z')
    set_app_time('2024-02-01T09:00:00.000Z')
    sync_transactions()

    txs = get_all_transactions(investment.user_id)

    # Verify all transactions have required fields
    for tx in txs:
        assert 'id' in tx
        assert 'type' in tx
        assert 'amount' in tx
        assert 'date' in tx
        assert 'status' in tx

        # Compounding distributions should link to contributions
        if tx.type == 'contribution':
            assert 'distributionTxId' in tx
            dist = next((t for t in txs if t.id == tx.distribution_tx_id), None)
            assert dist is not None
            assert dist.type == 'distribution'
            assert dist.amount == tx.amount
```

#### 4. Withdrawal with Partial Month
```python
def test_withdrawal_partial_month():
    investment = create_investment(
        amount=10000,
        lockup_period='1-year',
        confirmed_at='2024-01-15T09:00:00.000Z'
    )

    # Withdraw on Jan 20, 2025 (5 days into final month)
    set_app_time('2025-01-20T09:00:00.000Z')

    payout = calculate_withdrawal_amount(investment)
    # Should include partial January interest
    assert payout['total_amount'] > 10800  # More than 12 full months
```

#### 5. Payment Method Validation
```python
def test_payment_method_validation():
    # ACH: OK for amounts under $100k
    investment = create_investment(
        amount=50000,
        payment_method='ach',
        account_type='individual'
    )
    assert investment.status == 'draft'

    # ACH: Reject for amounts over $100k
    with pytest.raises(ValueError, match="must use wire transfer"):
        create_investment(
            amount=150000,
            payment_method='ach',
            account_type='individual'
        )

    # IRA: Must use wire only
    with pytest.raises(ValueError, match="IRA accounts must use wire transfer"):
        create_investment(
            amount=10000,
            payment_method='ach',
            account_type='ira'
        )

    # IRA: Wire is OK
    ira_investment = create_investment(
        amount=10000,
        payment_method='wire',
        account_type='ira'
    )
    assert ira_investment.payment_method == 'wire'
    assert ira_investment.requires_manual_approval == True
```

#### 6. Transaction Immutability
```python
def test_transaction_immutability():
    investment = create_investment(confirmed_at='2024-01-15T09:00:00.000Z')
    set_app_time('2024-02-01T09:00:00.000Z')
    sync_transactions()

    txs = get_all_transactions(investment.user_id)
    original_tx = txs[0]

    # Verify transactions cannot be modified
    with pytest.raises(ValueError, match="Transaction modification not allowed"):
        update_transaction(original_tx.id, {'amount': 100})

    # Verify transactions cannot be deleted
    with pytest.raises(ValueError, match="Transaction deletion not allowed"):
        delete_transaction(original_tx.id)

    # Verify transaction still exists unchanged
    current_tx = get_transaction(original_tx.id)
    assert current_tx.amount == original_tx.amount
    assert current_tx.date == original_tx.date
```

---

---

## Migration & Onboarding System

### Overview

Complete system for migrating investors from external platforms (e.g., Wealthblock) with full historical data including profiles, investments, distributions, and contributions. Includes automated welcome emails and 3-step onboarding flow.

### Import Methods

#### CSV Upload
```python
def process_csv_import(csv_file, field_mappings):
    """
    Process bulk investor import from CSV file.
    
    Features:
    - Auto-detect field mappings
    - Manual mapping adjustments
    - Preview and edit before import
    - Batch processing with validation
    """
    investors = parse_csv(csv_file)
    
    for row in investors:
        investor = {
            'email': row[field_mappings['email']],
            'firstName': row[field_mappings['firstName']],
            'lastName': row[field_mappings['lastName']],
            'phone': row[field_mappings['phone']],
            'dob': row[field_mappings['dob']],
            'address': {
                'street1': row[field_mappings['street1']],
                'city': row[field_mappings['city']],
                'state': row[field_mappings['state']],
                'zip': row[field_mappings['zip']]
            },
            'accountType': row[field_mappings['accountType']],
            
            # SSN and bank collected during onboarding
            'ssn': '',
            'bankAccounts': [],
            
            # Onboarding flags
            'needsOnboarding': True,
            'onboardingCompleted': False,
            
            # Investment
            'investments': [{
                'amount': row[field_mappings['amount']],
                'lockupPeriod': row[field_mappings['lockupPeriod']],
                'paymentFrequency': row[field_mappings['paymentFrequency']],
                'investmentDate': row[field_mappings['investmentDate']],
                'status': 'active'
            }],
            
            # Historical transactions
            'distributions': parse_distributions(row, field_mappings),
            'contributions': parse_contributions(row, field_mappings)
        }
        
        create_investor(investor)
```

#### Manual Entry
```python
def create_investor_manually(investor_data):
    """
    Create single investor with full data including historical transactions.
    
    investor_data includes:
    - Basic info: email, name, phone, DOB, address
    - Investment: amount, terms, date
    - Distributions: [{amount, date, description}, ...]
    - Contributions: [{amount, date, description}, ...]
    """
    # Create user
    user = create_user({
        'email': investor_data['email'],
        'firstName': investor_data['firstName'],
        'lastName': investor_data['lastName'],
        'phone': investor_data['phone'],
        'dob': investor_data['dob'],
        'address': investor_data['address'],
        'accountType': investor_data['accountType'],
        
        # Security fields - collected during onboarding
        'ssn': '',
        'password': '',  # Set during onboarding
        'bankAccounts': [],
        
        # Onboarding flags
        'needsOnboarding': True,
        'onboardingCompleted': False
    })
    
    # Create investment
    if investor_data.get('investment'):
        investment = create_investment(user.id, {
            'amount': investor_data['investment']['amount'],
            'lockupPeriod': investor_data['investment']['lockupPeriod'],
            'paymentFrequency': investor_data['investment']['paymentFrequency'],
            'status': 'active',
            'confirmedAt': investor_data['investment']['date']
        })
    
    # Create historical transactions
    for distribution in investor_data.get('distributions', []):
        create_activity_event(user.id, {
            'type': 'distribution',
            'amount': distribution['amount'],
            'date': distribution['date'],
            'description': distribution['description'],
            'status': 'approved',
            'investmentId': investment.id
        })
    
    for contribution in investor_data.get('contributions', []):
        create_activity_event(user.id, {
            'type': 'contribution',
            'amount': contribution['amount'],
            'date': contribution['date'],
            'description': contribution['description'],
            'investmentId': investment.id
        })
    
    return user
```

### Historical Transactions

#### Distribution
Money flowing FROM platform TO investor (interest, dividends, returns).

```python
{
    "id": "TX-USR-1001-DIST-2024-03-31",
    "userId": "USR-1001",
    "investmentId": "INV-10000",
    "type": "distribution",
    "amount": 2000,
    "date": "2024-03-31T09:00:00.000Z",
    "description": "Q1 2024 distribution",
    "status": "approved"
}
```

#### Contribution
Money flowing FROM investor TO platform (additional investments).

```python
{
    "id": "TX-USR-1001-CONTR-2024-05-15",
    "userId": "USR-1001",
    "investmentId": "INV-10000",
    "type": "contribution",
    "amount": 25000,
    "date": "2024-05-15T09:00:00.000Z",
    "description": "Additional investment"
}
```

### Email System Integration

#### Welcome Email Flow
```python
def send_welcome_email(user):
    """
    Send welcome email with onboarding link.
    Uses Resend (or similar email service).
    """
    # Generate reset token (reused for onboarding)
    reset_token = generate_secure_token()
    reset_expiry = add_hours(get_current_time(), 24)  # 24-hour expiry
    
    user.reset_token = reset_token
    user.reset_token_expiry = reset_expiry
    save_user(user)
    
    # Build onboarding link
    onboarding_link = f"{APP_URL}/onboarding?token={reset_token}"
    
    # Send email
    email_service.send({
        'to': user.email,
        'from': EMAIL_FROM,
        'subject': 'Welcome to Robert Ventures - Complete Your Account Setup',
        'html': generate_welcome_html(user, onboarding_link),
        'text': generate_welcome_text(user, onboarding_link)
    })
```

#### Email Template Structure
```python
def generate_welcome_html(user, onboarding_link):
    """
    Generate HTML email template with:
    - Personalized greeting
    - Migration explanation
    - Prominent CTA button
    - 3-step process overview
    - Security notice (24hr expiry)
    - Support contact
    """
    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Welcome to Robert Ventures, {user.firstName}!</h1>
        
        <p>Your account has been migrated from Wealthblock. To complete your setup 
        and access your investment dashboard, please complete the following steps:</p>
        
        <a href="{onboarding_link}" 
           style="background: #0066cc; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 4px; display: inline-block;">
          Complete Account Setup
        </a>
        
        <h3>Setup Steps:</h3>
        <ol>
          <li><strong>Set Your Password</strong> - Create a secure password</li>
          <li><strong>Verify Your SSN</strong> - For tax compliance</li>
          <li><strong>Link Bank Account</strong> - For distributions and withdrawals</li>
        </ol>
        
        <p><strong>Important:</strong> This link expires in 24 hours.</p>
        
        <p>Questions? Contact us at support@robertventures.com</p>
      </body>
    </html>
    """
```

### Onboarding Flow

#### Step 1: Password Setup
```python
POST /api/auth/onboarding/password
# Validates token and sets user password

Request: {
    "token": "abc123...",
    "password": "SecurePass123!"
}

def set_onboarding_password(token, password):
    user = find_user_by_reset_token(token)
    if not user or is_token_expired(token):
        raise ValueError("Invalid or expired token")
    
    user.password = hash_password(password)
    user.reset_token = None  # Invalidate token after use
    user.is_verified = True  # Mark as verified
    save_user(user)
    
    return {"success": True, "user": user}
```

#### Step 2: SSN Verification
```python
POST /api/users/:id
# Add SSN for tax compliance

Request: {
    "_action": "updateSSN",
    "ssn": "123-45-6789"
}

def update_ssn(user_id, ssn):
    user = get_user(user_id)
    
    # Validate SSN format
    if not validate_ssn_format(ssn):
        raise ValueError("Invalid SSN format. Must be XXX-XX-XXXX")
    
    user.ssn = ssn
    save_user(user)
    
    return {"success": True, "user": user}
```

#### Step 3: Bank Account Linking
```python
POST /api/users/:id
# Add bank account

Request: {
    "_action": "addBankAccount",
    "bankAccount": {
        "accountHolderName": "John Doe",
        "routingNumber": "123456789",
        "accountNumber": "9876543210",
        "accountType": "checking"
    }
}

def add_bank_account(user_id, bank_data):
    user = get_user(user_id)
    
    # Validate routing number (9 digits)
    if not validate_routing_number(bank_data['routingNumber']):
        raise ValueError("Invalid routing number")
    
    bank_account = {
        'id': generate_bank_account_id(user_id),
        'accountHolderName': bank_data['accountHolderName'],
        'routingNumber': bank_data['routingNumber'],
        'accountNumber': encrypt(bank_data['accountNumber']),  # Encrypt sensitive data
        'accountType': bank_data['accountType'],
        'lastFour': bank_data['accountNumber'][-4:],
        'isPrimary': len(user.bank_accounts) == 0,  # First account is primary
        'createdAt': get_current_time()
    }
    
    user.bank_accounts.append(bank_account)
    save_user(user)
    
    return {"success": True, "user": user}
```

#### Step 4: Complete Onboarding
```python
POST /api/users/:id
# Mark onboarding as complete

Request: {
    "_action": "completeOnboarding"
}

def complete_onboarding(user_id):
    user = get_user(user_id)
    
    # Validate all required steps completed
    if not user.password:
        raise ValueError("Password not set")
    if not user.ssn:
        raise ValueError("SSN not verified")
    if not user.bank_accounts:
        raise ValueError("Bank account not linked")
    
    user.onboarding_completed = True
    user.needs_onboarding = False
    save_user(user)
    
    return {"success": True, "redirect": "/dashboard"}
```

### API Endpoints

#### Import Investors
```python
POST /api/admin/import-investors
# Admin only - bulk import investors

Request: {
    "investors": [
        {
            "email": "investor@example.com",
            "firstName": "John",
            "lastName": "Doe",
            "phone": "+1-555-0100",
            "dob": "1980-05-15",
            "address": {...},
            "accountType": "individual",
            "investment": {
                "amount": 100000,
                "lockupPeriod": "3-year",
                "paymentFrequency": "compounding",
                "date": "2024-01-01"
            },
            "distributions": [
                {"amount": 2000, "date": "2024-03-31", "description": "Q1 2024"}
            ],
            "contributions": [
                {"amount": 25000, "date": "2024-05-15", "description": "Additional"}
            ]
        }
    ]
}

Response: {
    "success": true,
    "imported": 60,
    "failed": 2,
    "errors": [...]
}
```

#### Send Welcome Emails
```python
POST /api/auth/send-welcome
# Admin only - send welcome emails to imported investors

Request: {
    "userIds": ["USR-1001", "USR-1002", "USR-1003"]
}

Response: {
    "success": true,
    "sent": 58,
    "failed": 2,
    "errors": [
        {"email": "invalid@domain", "error": "Invalid email address"}
    ]
}
```

### Security Considerations

#### Data Protection
```python
# During Import:
- ❌ DO NOT collect SSN (request during onboarding)
- ❌ DO NOT collect password (set during onboarding)
- ❌ DO NOT collect bank accounts (add during onboarding)
- ✅ DO collect: email, name, phone, DOB, address
- ✅ DO import: investment data, historical transactions

# During Onboarding:
- ✅ Validate token (24hr expiry)
- ✅ Require strong password
- ✅ Encrypt SSN at rest
- ✅ Encrypt bank account numbers
- ✅ Use HTTPS for all communications
- ✅ Invalidate token after password set
```

#### User Flags
```python
{
    "needsOnboarding": True,        # Set during import
    "onboardingCompleted": False,   # Set after completing all steps
    "resetToken": "...",            # Generated for onboarding link
    "resetTokenExpiry": "...",      # 24 hours from generation
    "isVerified": False             # Set True after password setup
}
```

### Environment Configuration

```python
# JWT Authentication (REQUIRED)
JWT_SECRET = "your-secret-32-byte-hex"  # Generate: crypto.randomBytes(32).toString('hex')
JWT_REFRESH_SECRET = "your-refresh-secret-32-byte-hex"  # Must be different from JWT_SECRET

# Email Service (Resend)
RESEND_API_KEY = "re_abc123..."
EMAIL_FROM = "noreply@robertventures.com"

# Application
NEXT_PUBLIC_APP_URL = "https://invest.robertventures.com"
NODE_ENV = "production"  # or "development"

# Security
PASSWORD_MIN_LENGTH = 8
TOKEN_EXPIRY_HOURS = 24  # For password reset tokens
JWT_ACCESS_TOKEN_EXPIRY = "7d"  # 7 days
JWT_REFRESH_TOKEN_EXPIRY = "30d"  # 30 days
MASTER_PASSWORD_EXPIRY_MINUTES = 30  # Master password expiration
```

### Testing Migration System

#### Test Scenario 1: Single Investor Migration
```python
def test_migrate_single_investor_with_history():
    # 1. Import investor
    investor = {
        'email': 'john.doe@example.com',
        'firstName': 'John',
        'lastName': 'Doe',
        'investment': {
            'amount': 100000,
            'lockupPeriod': '3-year',
            'paymentFrequency': 'compounding',
            'date': '2024-01-01'
        },
        'distributions': [
            {'amount': 2000, 'date': '2024-03-31', 'description': 'Q1 2024'},
            {'amount': 2000, 'date': '2024-06-30', 'description': 'Q2 2024'}
        ]
    }
    
    result = import_investor(investor)
    assert result.success == True
    assert result.user.needs_onboarding == True
    assert len(result.user.activity) >= 3  # Account + Investment + 2 distributions
    
    # 2. Send welcome email
    email_result = send_welcome_email(result.user)
    assert email_result.sent == True
    
    # 3. Complete onboarding
    token = result.user.reset_token
    set_password(token, 'SecurePass123!')
    update_ssn(result.user.id, '123-45-6789')
    add_bank_account(result.user.id, {...})
    complete_result = complete_onboarding(result.user.id)
    
    # 4. Verify completion
    user = get_user(result.user.id)
    assert user.onboarding_completed == True
    assert user.needs_onboarding == False
    assert user.ssn is not None
    assert len(user.bank_accounts) > 0
```

#### Test Scenario 2: Bulk CSV Import
```python
def test_bulk_csv_import():
    csv_data = """
    Email,First Name,Last Name,Phone,Investment Amount,Lockup Period
    user1@example.com,John,Doe,555-0100,100000,3-year
    user2@example.com,Jane,Smith,555-0200,50000,1-year
    user3@example.com,Bob,Wilson,555-0300,75000,3-year
    """
    
    result = process_csv_import(csv_data, field_mappings)
    assert result.imported == 3
    assert result.failed == 0
    
    # Verify all users need onboarding
    for user_id in result.user_ids:
        user = get_user(user_id)
        assert user.needs_onboarding == True
        assert user.ssn == ''
        assert len(user.bank_accounts) == 0
```

---

## Summary

This guide provides:
- ✅ Exact business rules for validation
- ✅ Penny-perfect calculation formulas
- ✅ Sequential ID generation patterns
- ✅ State machine with transition rules
- ✅ Complete transaction audit trail system (for external tax reporting and compliance)
- ✅ Complete API endpoint specifications
- ✅ Migration & onboarding system
- ✅ Historical transaction import
- ✅ Email integration patterns
- ✅ Testing scenarios to verify correctness

**Implementation Approach:**
1. Choose your technology stack (Python/FastAPI, Node.js/Express, Java/Spring, etc.)
2. Implement JWT authentication system:
   - Install JWT library (`jsonwebtoken`, `PyJWT`, etc.)
   - Install bcrypt library for password hashing
   - Set up JWT secrets in environment variables
   - Implement authentication middleware
   - Protect all admin routes with JWT validation
3. Implement data models matching the JSON structure documented above
4. Build sequential ID generators (not UUIDs - format must match exactly)
5. Implement interest calculation formulas (test against reference implementation)
6. Create immutable transaction system for complete audit trail
7. Build REST API endpoints matching the specifications
8. Implement migration & onboarding system with email integration
9. Add historical transaction import support
10. Validate calculations match reference implementation penny-for-penny
11. Test against all provided scenarios (including JWT authentication tests)

**Reference Implementation:**
- JWT Authentication: `/lib/auth.js`, `/lib/authMiddleware.js`, `/lib/masterPassword.js`
- Authentication routes: `/app/api/auth/*`
- Interest calculations: `/lib/investmentCalculations.js`
- ID generation: `/lib/idGenerator.js`
- API routes: `/app/api/users/[id]/route.js`
- Email service: `/lib/emailService.js`
- Migration: `/app/api/admin/import-investors/route.js`
- Onboarding: `/app/onboarding/page.js`
- Use these to verify your implementation produces identical results

**Quick Start (Next.js Reference Implementation):**
1. Install dependencies: `npm install jsonwebtoken bcryptjs cookie`
2. Generate JWT secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Create `.env.local` with `JWT_SECRET` and `JWT_REFRESH_SECRET`
4. Start dev server: `npm run dev`
5. Login as admin, generate master password from Operations tab
6. Test by logging into any investor account with master password

---

## Document Manager

### Overview

The document manager system allows admins to send documents to users via bulk upload or individual upload. It can be used for statements, notices, or any other documents that need to be distributed to users. The system handles name matching, duplicate name scenarios, email notifications, and secure document delivery to users.

### Core Features

1. **Bulk Upload**: Upload a ZIP file containing PDFs named by first/last name
2. **Name Matching**: Automatic matching to users by firstName + lastName
3. **Duplicate Handling**: Manual assignment for users with same names
4. **Single Upload**: Upload document to specific user
5. **Email Notifications**: Automatic notifications when documents are available
6. **Secure Download**: Users can only access their own documents
7. **Document Management**: View all uploaded documents, delete individual or all

### Data Model

#### User Document Schema

```javascript
// Added to user object
{
  documents: [
    {
      id: "DOC-USR-1001-DOCUMENT-20250115103000",
      type: "document",  // Document type
      fileName: "JosephRobert_1234.pdf",
      year: "2025",  // Auto-set to current year
      uploadedAt: "2025-01-15T10:30:00.000Z",
      uploadedBy: "USR-1000",  // Admin user ID
      blobKey: "tax-documents/2025/USR-1001-1705320600000.pdf"
    }
  ]
}
```

### Storage Architecture

#### Netlify Blobs

**Store Name:** `documents` (separate from `users` store)

**Key Format:** `{type}/{year}/{userId}-{timestamp}.{extension}`
- Example: `documents/2025/USR-1001-1705320600000.pdf`
- Timestamp prevents overwrites when uploading multiple documents

**Storage Functions** (`lib/documentStorage.js`):
```javascript
uploadDocument(key, data, contentType)     // Upload PDF to blob storage
getDocument(key)                           // Retrieve PDF from storage
deleteDocument(key)                        // Delete PDF from storage
listDocuments(prefix)                      // List all documents with prefix
generateDocumentKey(type, year, userId, fileName)  // Generate storage key
isPDF(data)                               // Validate PDF file
```

### API Endpoints

#### 1. Bulk Upload

**Endpoint:** `POST /api/admin/documents/bulk-upload`

**Authentication:** Admin only (checks `isAdmin` flag)

**Request:**
```javascript
FormData {
  file: ZIP file containing PDFs,
  adminEmail: "admin@rv.com"
}
```

**File Naming Convention:**
- PDFs must be named: `FirstnameLastname_*.pdf`
- Example: `JosephRobert_7273_2.pdf`
- System extracts "Joseph" and "Robert" for matching
- Everything after underscore is ignored

**Matching Logic:**
1. Extract firstName and lastName from filename (before first underscore)
2. Search users by firstName + lastName (case-insensitive)
3. Three scenarios:
   - **1 match**: Auto-upload and send email
   - **0 matches**: Report as "No Match"
   - **Multiple matches**: Report as "Duplicate Names" for manual review

**Response:**
```javascript
{
  success: true,
  summary: {
    total: 10,
    autoMatched: 7,
    duplicateNames: 2,
    noMatch: 1,
    errors: 0
  },
  results: {
    autoMatched: [
      {
        filename: "JosephRobert_1234.pdf",
        userId: "USR-1001",
        email: "joseph@example.com",
        emailSent: true
      }
    ],
    duplicateNames: [
      {
        filename: "JohnSmith_5678.pdf",
        firstName: "John",
        lastName: "Smith",
        matchingUsers: [
          {
            id: "USR-1002",
            email: "john.smith@example.com",
            createdAt: "2024-01-15T00:00:00.000Z",
            lastInvestmentDate: "2024-06-01T00:00:00.000Z"
          },
          {
            id: "USR-1003",
            email: "john.smith2@example.com",
            createdAt: "2024-03-20T00:00:00.000Z",
            lastInvestmentDate: null
          }
        ]
      }
    ],
    noMatch: [
      {
        filename: "MaryJones_9999.pdf",
        firstName: "Mary",
        lastName: "Jones",
        reason: "No user found with this name"
      }
    ],
    errors: []
  }
}
```

**Implementation Details:**
- Validates admin authentication
- Parses ZIP file using `jszip` library
- Validates each PDF with `isPDF()`
- Processes files sequentially
- Auto-sets year to current year
- No duplicate prevention (allows multiple documents per user)
- Uploads to blob storage: `documents/{year}/{userId}-{timestamp}.pdf`
- Updates user's `documents` array
- Sends email notification via `sendDocumentNotification()`

#### 2. Single User Upload

**Endpoint:** `POST /api/admin/documents/upload-single`

**Authentication:** Admin only

**Request:**
```javascript
FormData {
  file: PDF file,
  userId: "USR-1001",
  adminEmail: "admin@rv.com"
}
```

**Response:**
```javascript
{
  success: true,
  user: {
    id: "USR-1001",
    email: "user@example.com",
    name: "Joseph Robert"
  },
  document: {
    id: "DOC-USR-1001-DOCUMENT-20250115103000",
    type: "document",
    fileName: "document.pdf",
    year: "2025",
    uploadedAt: "2025-01-15T10:30:00.000Z",
    uploadedBy: "USR-1000",
    blobKey: "tax-documents/2025/USR-1001-1705320600000.pdf"
  },
  emailSent: true
}
```

**Use Cases:**
- Uploading to specific user after duplicate name scenario
- Correcting a document for a user
- Manual uploads outside bulk process

#### 3. Assign Pending Document

**Endpoint:** `POST /api/admin/documents/assign-pending`

**Authentication:** Admin only

**Request:**
```javascript
{
  userId: "USR-1001",
  fileName: "JohnSmith_5678.pdf",
  pdfData: "base64_encoded_pdf_data",
  adminEmail: "admin@rv.com"
}
```

**Response:**
```javascript
{
  success: true,
  user: {
    id: "USR-1001",
    email: "john.smith@example.com"
  },
  emailSent: true
}
```

**Use Case:**
- Resolving duplicate name scenarios from bulk upload
- Admin manually assigns document to correct user

#### 4. List Documents

**Endpoint:** `GET /api/admin/documents/list?adminEmail=admin@rv.com&type=document`

**Authentication:** Admin only

**Response:**
```javascript
{
  success: true,
  documents: [
    {
      id: "DOC-USR-1001-DOCUMENT-20250115103000",
      type: "document",
      fileName: "JosephRobert_1234.pdf",
      year: "2025",
      uploadedAt: "2025-01-15T10:30:00.000Z",
      uploadedBy: "USR-1000",
      blobKey: "documents/2025/USR-1001-1705320600000.pdf",
      user: {
        id: "USR-1001",
        email: "joseph@example.com",
        firstName: "Joseph",
        lastName: "Robert"
      }
    }
  ],
  total: 50
}
```

**Query Parameters:**
- `adminEmail` (required): Admin authentication
- `type` (optional): Filter by document type (e.g., "document")

**Implementation:**
- Returns all documents across all users
- Sorted by uploadedAt (most recent first)
- Includes user information for each document

#### 5. Delete Documents

**Endpoint:** `POST /api/admin/documents/delete`

**Authentication:** Admin only

**Modes:**

**Single Document:**
```javascript
{
  mode: "single",
  userId: "USR-1001",
  documentId: "DOC-USR-1001-DOCUMENT-20250115103000",
  adminEmail: "admin@rv.com"
}
```

**All Documents:**
```javascript
{
  mode: "all",
  adminEmail: "admin@rv.com"
}
```

**Response:**
```javascript
{
  success: true,
  message: "Deleted 50 documents",
  deleted: [
    {
      userId: "USR-1001",
      email: "user@example.com",
      documentId: "DOC-...",
      fileName: "JosephRobert_1234.pdf"
    }
  ],
  errors: []  // If any deletions failed
}
```

**Implementation:**
- Deletes from blob storage
- Removes from user's documents array
- Returns detailed report of deleted documents
- Continues on individual failures, reports errors

#### 6. User Download

**Endpoint:** `GET /api/users/[id]/documents/[docId]?requestingUserId=USR-1001`

**Authentication:** User must own the document

**Response:** PDF file with proper headers
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="document.pdf"
```

**Security:**
- Validates `requestingUserId` matches user ID in URL
- Users can ONLY access their own documents
- Returns 403 Forbidden if attempting to access another user's document

### Email Notifications

#### Function: `sendDocumentNotification()`

**Location:** `lib/emailService.js`

**Parameters:**
```javascript
{
  email: "user@example.com",
  firstName: "Joseph",
  lastName: "Robert"
}
```

**Email Content:**
- **Subject:** "Your Documents Are Ready - Robert Ventures"
- **Body:** Professional HTML template with download link
- **CTA:** Direct link to Documents page in investor portal
- **Notes:** Instructions on downloading and saving documents

**Template Features:**
- Responsive HTML design
- Gradient header
- Clear call-to-action button
- Important notes about document storage
- Plain text fallback
- Direct link to documents: `${appUrl}/dashboard?view=documents`

### Frontend Integration

#### Admin UI

**Location:** `app/admin/components/DocumentManagerSection.js`

**Three Sub-Tabs:**

1. **Bulk Upload:**
   - ZIP file selector
   - Upload button
   - Results display:
     - Summary statistics
     - Auto-matched list (with email status)
     - Duplicate names (with user selection UI)
     - No match list
     - Errors list

2. **Single User:**
   - User dropdown (all non-admin users)
   - PDF file selector
   - Upload button
   - Success message

3. **Manage Documents:**
   - Document table (user, email, filename, uploaded date)
   - Delete individual document button
   - Delete all documents button
   - Refresh button

**Integrated Into:** `app/admin/components/OperationsTab.js`

#### User UI

**Location:** `app/components/DocumentsView.js`

**Features:**
- Documents section at top
- Chronological list (most recent first)
- Each document shows:
  - Document title: "Document"
  - Filename
  - Upload date
  - Download button
- Secure download via API call
- Empty state when no documents

**Download Flow:**
1. User clicks download button
2. Frontend calls `/api/users/[userId]/documents/[docId]?requestingUserId=[userId]`
3. API validates ownership
4. Returns PDF as download
5. Browser saves file with original filename

### Security & Validation

#### Admin Endpoints
- **Authentication:** All admin endpoints verify `isAdmin` flag
- **Email verification:** Admin email must match registered admin user
- **Input validation:** File types, user IDs, document IDs

#### User Endpoints
- **Ownership validation:** Users can ONLY access their own documents
- **Request validation:** `requestingUserId` must match URL user ID

#### File Validation
- **Type checking:** Only PDF files accepted (`isPDF()` function)
- **Size limits:** Recommend 10MB per file (configurable)
- **ZIP validation:** Validates ZIP structure before processing

#### Blob Storage
- **Separate store:** Documents in separate `documents` store from user data
- **Unique keys:** Timestamp ensures no overwrites
- **Secure access:** Keys not exposed to users
- **Error handling:** Graceful failures with detailed error messages

### Error Handling

#### Bulk Upload Errors
- Invalid ZIP file → Clear error message
- Non-PDF files → Rejected with filename in error list
- Blob storage failures → Reported per-file, doesn't block other uploads
- Email failures → Logged but doesn't block upload (flagged in results)

#### Common Error Responses
```javascript
// Unauthorized
{ success: false, error: "Unauthorized", status: 401 }

// User not found
{ success: false, error: "User not found", status: 404 }

// Invalid file type
{ success: false, error: "File must be a PDF", status: 400 }

// Blob storage error
{ success: false, error: "Failed to upload document", status: 500 }
```

### Workflow Examples

#### Example 1: Successful Bulk Upload

1. Admin prepares ZIP with 10 PDFs named by user names
2. Admin uploads ZIP via admin panel
3. System processes:
   - 8 files auto-matched → uploaded + emails sent
   - 2 files have duplicate names → reported for manual assignment
4. Admin reviews results
5. Admin uses Single User tab to assign the 2 duplicate files
6. All users receive email notifications
7. Users log in and download their documents

#### Example 2: User Downloading Document

1. User receives email notification
2. User logs into investor portal
3. User navigates to Documents page
4. User sees "Document - Uploaded Jan 15, 2025"
5. User clicks Download button
6. API validates user ownership
7. PDF downloads to user's device

### Dependencies

**NPM Packages:**
- `jszip@^3.10.1` - ZIP file processing in Node.js
- `@netlify/blobs` - Already in use for document storage
- `resend` - Already in use for email notifications

### File Structure

```
lib/
  documentStorage.js              # NEW - Blob storage utilities

app/
  api/
    admin/
      documents/
        bulk-upload/route.js      # NEW - Bulk ZIP upload
        upload-single/route.js    # NEW - Single user upload
        assign-pending/route.js   # NEW - Manual assignment
        delete/route.js           # NEW - Delete documents
        list/route.js             # NEW - List all documents
    users/
      [id]/
        documents/
          [docId]/route.js        # NEW - User document download
  
  admin/
    components/
      DocumentManagerSection.js      # NEW - Admin UI component
      DocumentManagerSection.module.css # NEW - Styles
      OperationsTab.js            # MODIFIED - Added document manager section
  
  components/
    DocumentsView.js              # MODIFIED - Added documents display
    DocumentsView.module.css      # MODIFIED - Added styles
```

### Testing Checklist

**Admin Features:**
- [ ] Bulk upload with all matching names
- [ ] Bulk upload with duplicate names
- [ ] Bulk upload with non-matching names
- [ ] Single user upload
- [ ] Delete individual document
- [ ] Delete all documents
- [ ] View documents list
- [ ] Email notifications sent

**User Features:**
- [ ] Receive email notification
- [ ] View documents page
- [ ] Download document
- [ ] Multiple documents display correctly
- [ ] Cannot access other user's documents

**Error Cases:**
- [ ] Upload non-PDF file (rejected)
- [ ] Invalid ZIP file (error message)
- [ ] Unauthorized access (403 error)
- [ ] Missing user (404 error)
- [ ] Blob storage failure (graceful handling)

### Performance Considerations

**Bulk Upload:**
- Processes files sequentially (not parallel) to avoid overwhelming blob storage
- 50ms delay between email sends (rate limiting)
- Failed uploads don't block other files
- Comprehensive results returned at end

**Storage:**
- Netlify Blobs is globally distributed CDN
- Fast uploads/downloads worldwide
- No size limits (within reasonable range)
- Automatic caching

**Scaling:**
- Current implementation handles hundreds of users efficiently
- For thousands of users: consider batch processing with queue system
- Monitor blob storage usage and costs

### Future Enhancements (Optional)

1. **Preview functionality**: Preview PDF before download
2. **Version history**: Track multiple versions of same document
3. **Bulk email resend**: Resend notifications for specific year
4. **Document expiration**: Auto-delete documents after X years
5. **User uploads**: Allow users to upload documents to admin
6. **Document categories**: Support more document types and categories
7. **Search functionality**: Search documents by user/filename
8. **Audit log**: Track all document operations for compliance

---

**Technology Notes:**
- **Database:** Choose any (PostgreSQL, MongoDB, MySQL, etc.) - structure must support the JSON data models
- **API Framework:** Any that supports REST/JSON (FastAPI, Express, Spring Boot, Django, etc.)
- **Authentication:** JWT with HTTP-only cookies (implemented)
  - Access tokens: 7 days expiry
  - Refresh tokens: 30 days expiry
  - Bcrypt password hashing (10 salt rounds)
  - Master password system for admin testing
  - Seamless plain-text password migration
- **Security Libraries:**
  - JWT: `jsonwebtoken`, `PyJWT`, `java-jwt`, or language equivalent
  - Password Hashing: `bcrypt`, `bcryptjs`, or language equivalent
  - Crypto: Built-in crypto libraries for secure random generation
- **Email Service:** Resend, SendGrid, Mailgun, or similar (must support transactional emails)
- **Payment Integration:**
  - ACH: Plaid, Stripe, Dwolla, or similar (must support $100k limit)
  - Wire: Manual processing or integration with banking partner
  - IRA: Wire transfer only (coordinate with IRA custodian if applicable)
- **Hosting:** Any cloud platform that meets your security/compliance requirements
- **Cookie Support:** Backend must support HTTP-only cookies with secure flags
