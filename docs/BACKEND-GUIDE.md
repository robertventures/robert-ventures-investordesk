# Backend Implementation Guide

**Robert Ventures Investment Platform - Python Backend Requirements**

This guide documents the exact business logic, calculations, and API requirements needed to build a Python backend that mirrors the Next.js reference implementation.

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

### Key Requirements
- **Penny-perfect calculations** - Must match reference implementation exactly
- **Sequential IDs** - Human-readable (USR-1001, INV-10000, not UUIDs)
- **App time system** - Admin-controlled time for testing/demos
- **Netlify Blobs storage** - Same data store as Next.js app
- **Complete audit trail** - Immutable transaction records for all financial activity

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
# ACH investments are automatically approved
# Wire investments require manual admin approval

def should_auto_approve(payment_method):
    return payment_method == 'ach'
```

### Account Type Restrictions
```python
# IRA accounts cannot use monthly payment frequency
# IRA must use compounding only

def validate_ira_restriction(account_type, payment_frequency):
    if account_type == 'ira' and payment_frequency == 'monthly':
        raise ValueError("IRA accounts can only use compounding")
```

---

## Authentication & Security

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

    user.password = hash_password(new_password)
    user.is_verified = True  # Auto-verify
    user.verified_at = user.verified_at or now()
    user.reset_token = None
    save_user(user)
```

### Session Timeout
- **Inactivity timeout:** 10 minutes
- **Warning:** 1 minute before logout
- **Implementation:** Frontend activity tracking + optional backend session validation

### Admin 2FA
```python
# All admin sign-ins require 2FA
# Preferred: Google Identity Platform / Firebase Auth MFA

def authenticate_admin(email, password):
    user = get_user_by_email(email)
    if not user or not user.is_admin:
        raise AuthError("Invalid credentials")

    if not verify_password(password, user.password):
        raise AuthError("Invalid credentials")

    if user.mfa_enabled:
        challenge_id = start_mfa_challenge(user)
        return {"mfa_required": True, "challenge_id": challenge_id}

    return create_session(user)
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

### Transaction Immutability
```python
"""
All transactions are immutable once created.
This ensures a complete audit trail of all financial activity.

Transactions should never be modified or deleted after creation.
If corrections are needed, create reversing/correcting transactions instead.
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
# Sign up
Request: {"email": "user@example.com", "password": "Pass123!"}
Response: {"success": true, "user": {...}}

POST /api/auth/sign-in
# Sign in
Request: {"email": "user@example.com", "password": "Pass123!"}
Response: {"success": true, "user": {...}, "redirect": "/dashboard"}

POST /api/auth/request-reset
# Request password reset
Request: {"email": "user@example.com"}
Response: {"success": true}

POST /api/auth/reset-password
# Reset password (auto-verifies account)
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
GET /api/admin/accounts
# Get all users (admin only)
Response: {"success": true, "accounts": [...], "appTime": "..."}

POST /api/admin/time-machine
# Set app time (testing/demos)
Request: {"targetDate": "2024-11-01T00:00:00.000Z"}
Response: {"success": true, "appTime": "2024-11-01T00:00:00.000Z"}

POST /api/admin/seed
# Seed test accounts
Response: {"success": true, "accounts": [...]}

POST /api/migrate-transactions
# Generate transactions for all investments
Response: {"success": true, "processed": 5}
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

#### 5. Transaction Immutability
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

## Summary

This guide provides:
- ✅ Exact business rules for validation
- ✅ Penny-perfect calculation formulas
- ✅ Sequential ID generation patterns
- ✅ State machine with transition rules
- ✅ Complete transaction audit trail system
- ✅ Complete API endpoint specifications
- ✅ Testing scenarios to verify correctness

**Next Steps:**
1. Implement data models matching JSON structure
2. Build ID generators (sequential, not UUID)
3. Implement interest calculations (test against reference)
4. Create immutable transaction system for audit trail
5. Build API endpoints following specs
6. Test against provided scenarios

**Reference Implementation:**
See `/lib/investmentCalculations.js`, `/lib/idGenerator.js`, and `/app/api/users/[id]/route.js` for exact logic.
