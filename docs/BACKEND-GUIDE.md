# Backend Implementation Guide

**For:** Backend Development Team  
**Purpose:** Complete reference for implementing the investment platform backend

---

## Table of Contents

1. [Overview](#overview)
2. [ID Architecture](#id-architecture)
3. [Investment States](#investment-states)
4. [Investment Rules](#investment-rules)
5. [Interest Calculations](#interest-calculations)
6. [Pending Payouts System](#pending-payouts-system)
7. [Withdrawal Rules](#withdrawal-rules)
8. [Data Models](#data-models)
9. [API Endpoints](#api-endpoints)
10. [Business Logic Implementation](#business-logic-implementation)
11. [Validation Rules](#validation-rules)
12. [Database Indexes](#database-indexes)
13. [UI/UX Requirements](#uiux-requirements)
14. [Testing](#testing)

---

## Overview

This is an investment platform where users invest in bonds with two payment options:
- **Monthly payouts** - Interest paid monthly to bank account
- **Compounding** - Interest compounds monthly, paid at maturity

**Your job:** Implement a Python backend that mirrors these business rules exactly.

---

## ID Architecture

### Overview

The platform uses a **sequential, human-readable ID system** for all entities. This provides:
- **Easy tracking** - IDs are meaningful and sequential
- **Debugging** - Simple to identify entity types and relationships
- **Audit trails** - Clear history of when entities were created
- **No collisions** - Sequential generation prevents duplicate IDs

### ID Format Standards

All IDs follow the pattern: `{PREFIX}-{NUMBER}[-{SUFFIX}]`

| Entity Type | Format | Starting ID | Example | Notes |
|------------|--------|-------------|---------|-------|
| **User** | `USR-{sequential}` | `USR-1000` | `USR-1001`, `USR-1002` | Admin is always `USR-1000` |
| **Investment** | `INV-{sequential}` | `INV-10000` | `INV-10001`, `INV-10002` | Global across all users |
| **Withdrawal** | `WDL-{sequential}` | `WDL-10000` | `WDL-10001`, `WDL-10002` | Global across all users |
| **Bank Account** | `BANK-{userId}-{seq}` | `BANK-USR-1000-1` | `BANK-USR-1001-2` | Per-user sequential |
| **Transaction** | `TX-{type}-{entityId}-{suffix}` | Various | See below | Composite format |

### Transaction ID Patterns

Transaction IDs follow the pattern: `TX-{entityType}-{entityId}-{type}[-{suffix}]`

| Transaction Type | ID Pattern | Example |
|-----------------|------------|---------|
| Account Created | `TX-USR-{userId}-account-created` | `TX-USR-USR-1001-account-created` |
| Investment Created | `TX-INV-{invId}-created` | `TX-INV-INV-10000-created` |
| Investment Confirmed | `TX-INV-{invId}-confirmed` | `TX-INV-INV-10000-confirmed` |
| Monthly Distribution | `TX-INV-{invId}-md-{YYYY-MM}` | `TX-INV-INV-10000-md-2025-11` |
| Monthly Compounded | `TX-INV-{invId}-mc-{YYYY-MM}` | `TX-INV-INV-10000-mc-2025-11` |
| Withdrawal Notice | `TX-WDL-{wdlId}-notice` | `TX-WDL-WDL-10000-notice` |
| Withdrawal Approved | `TX-WDL-{wdlId}-approved` | `TX-WDL-WDL-10000-approved` |
| Withdrawal Rejected | `TX-WDL-{wdlId}-rejected` | `TX-WDL-WDL-10000-rejected` |

### ID Generation Rules

#### User IDs
```python
def generate_user_id(existing_users):
    """
    Generate next sequential user ID.
    Admin always gets USR-1000.
    """
    if not existing_users:
        return "USR-1000"
    
    max_id = max([extract_numeric_id(user.id) for user in existing_users])
    next_id = max_id + 1
    return f"USR-{next_id}"

# Example progression:
# USR-1000 (admin)
# USR-1001 (first regular user)
# USR-1002 (second regular user)
```

#### Investment IDs
```python
def generate_investment_id(all_users):
    """
    Generate next sequential investment ID.
    Investment IDs are global across ALL users.
    """
    all_investments = []
    for user in all_users:
        all_investments.extend(user.investments)
    
    if not all_investments:
        return "INV-10000"
    
    max_id = max([extract_numeric_id(inv.id) for inv in all_investments])
    next_id = max_id + 1
    return f"INV-{next_id}"

# Example progression:
# INV-10000 (first investment by any user)
# INV-10001 (second investment by any user)
# INV-10002 (third investment by any user)
```

#### Withdrawal IDs
```python
def generate_withdrawal_id(all_users):
    """
    Generate next sequential withdrawal ID.
    Withdrawal IDs are global across ALL users.
    """
    all_withdrawals = []
    for user in all_users:
        all_withdrawals.extend(user.withdrawals)
    
    if not all_withdrawals:
        return "WDL-10000"
    
    max_id = max([extract_numeric_id(wdl.id) for wdl in all_withdrawals])
    next_id = max_id + 1
    return f"WDL-{next_id}"

# Example progression:
# WDL-10000 (first withdrawal by any user)
# WDL-10001 (second withdrawal by any user)
```

#### Bank Account IDs
```python
def generate_bank_account_id(user_id, user_bank_accounts):
    """
    Generate next sequential bank account ID for a specific user.
    Bank account IDs are per-user sequential.
    """
    if not user_bank_accounts:
        return f"BANK-{user_id}-1"
    
    user_banks = [b for b in user_bank_accounts if b.id.startswith(f"BANK-{user_id}")]
    max_seq = max([extract_sequence_number(bank.id) for bank in user_banks])
    next_seq = max_seq + 1
    return f"BANK-{user_id}-{next_seq}"

# Example progression for user USR-1001:
# BANK-USR-1001-1 (first bank account)
# BANK-USR-1001-2 (second bank account)
# BANK-USR-1001-3 (third bank account)
```

#### Transaction IDs
```python
def generate_transaction_id(entity_type, entity_id, transaction_type, options=None):
    """
    Generate transaction ID based on type and context.
    """
    prefix = f"TX-{entity_type}-{entity_id}"
    
    if transaction_type == "account_created":
        return f"{prefix}-account-created"
    
    elif transaction_type == "investment_created":
        return f"{prefix}-created"
    
    elif transaction_type == "investment_confirmed":
        return f"{prefix}-confirmed"
    
    elif transaction_type == "monthly_distribution":
        # Format: TX-INV-{invId}-md-YYYY-MM
        date = options.get('date')
        year = date.year
        month = str(date.month).zfill(2)
        return f"{prefix}-md-{year}-{month}"
    
    elif transaction_type == "monthly_compounded":
        # Format: TX-INV-{invId}-mc-YYYY-MM
        date = options.get('date')
        year = date.year
        month = str(date.month).zfill(2)
        return f"{prefix}-mc-{year}-{month}"
    
    elif transaction_type == "withdrawal_notice_started":
        return f"{prefix}-notice"
    
    elif transaction_type == "withdrawal_approved":
        return f"{prefix}-approved"
    
    elif transaction_type == "withdrawal_rejected":
        return f"{prefix}-rejected"
    
    return f"{prefix}-{transaction_type}"

# Examples:
# TX-USR-USR-1001-account-created
# TX-INV-INV-10000-created
# TX-INV-INV-10000-confirmed
# TX-INV-INV-10000-md-2025-11
# TX-INV-INV-10000-mc-2025-11
# TX-WDL-WDL-10000-notice
# TX-WDL-WDL-10000-approved
```

### Extracting Numeric IDs

```python
def extract_numeric_id(id_string):
    """
    Extract numeric portion from an ID.
    
    Examples:
    - "USR-1000" → 1000
    - "INV-10000" → 10000
    - "BANK-USR-1001-2" → 2 (last number)
    """
    import re
    match = re.search(r'-(\d+)(?:-|$)', id_string)
    return int(match.group(1)) if match else 0

def extract_sequence_number(bank_id):
    """
    Extract sequence number from bank account ID.
    
    Example:
    - "BANK-USR-1001-2" → 2
    """
    parts = bank_id.split('-')
    return int(parts[-1])
```

### ID Validation

```python
def validate_user_id(id_string):
    """Validate user ID format"""
    import re
    return bool(re.match(r'^USR-\d+$', id_string))

def validate_investment_id(id_string):
    """Validate investment ID format"""
    import re
    return bool(re.match(r'^INV-\d+$', id_string))

def validate_withdrawal_id(id_string):
    """Validate withdrawal ID format"""
    import re
    return bool(re.match(r'^WDL-\d+$', id_string))

def validate_bank_id(id_string):
    """Validate bank account ID format"""
    import re
    return bool(re.match(r'^BANK-USR-\d+-\d+$', id_string))

def validate_transaction_id(id_string):
    """Validate transaction ID format"""
    import re
    return bool(re.match(r'^TX-[A-Z]+-[A-Z]+-\d+-.+$', id_string))
```

### Special IDs

#### Admin User
The admin user **always** has ID `USR-1000`. This is the first user in the system.

```python
ADMIN_USER_ID = "USR-1000"

def is_admin(user_id):
    return user_id == ADMIN_USER_ID
```

### Database Considerations

**Indexes:**
```sql
-- User lookups
CREATE INDEX idx_user_id ON users(id);
CREATE INDEX idx_user_email ON users(email);

-- Investment queries
CREATE INDEX idx_investment_id ON investments(id);
CREATE INDEX idx_investment_user_id ON investments(user_id);

-- Withdrawal queries
CREATE INDEX idx_withdrawal_id ON withdrawals(id);
CREATE INDEX idx_withdrawal_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawal_investment_id ON withdrawals(investment_id);

-- Transaction queries
CREATE INDEX idx_transaction_id ON transactions(id);
CREATE INDEX idx_transaction_user_id ON transactions(user_id);
CREATE INDEX idx_transaction_investment_id ON transactions(investment_id);
```

**ID Storage:**
- Store IDs as `VARCHAR(50)` or `TEXT` (not as integers)
- Always include the prefix in the database
- Never strip prefixes for storage efficiency

### Migration from Old IDs

If migrating from timestamp-based IDs (e.g., `1758644000000`):

```python
def migrate_user_ids(old_users):
    """
    Migrate from timestamp IDs to new format.
    Preserves admin as USR-1000.
    """
    new_users = []
    id_mapping = {}
    
    # Admin first
    admin = next((u for u in old_users if u.isAdmin), None)
    if admin:
        id_mapping[admin.id] = "USR-1000"
        admin.id = "USR-1000"
        new_users.append(admin)
    
    # Regular users
    counter = 1001
    for user in old_users:
        if not user.isAdmin:
            old_id = user.id
            new_id = f"USR-{counter}"
            id_mapping[old_id] = new_id
            user.id = new_id
            new_users.append(user)
            counter += 1
    
    # Update all references
    for user in new_users:
        # Update investment confirmedByAdminId
        for inv in user.investments:
            if inv.confirmedByAdminId in id_mapping:
                inv.confirmedByAdminId = id_mapping[inv.confirmedByAdminId]
        
        # Update transaction references
        for tx in user.transactions:
            # Update transaction IDs if needed
            pass
    
    return new_users, id_mapping
```

### Best Practices

1. **Never reuse IDs** - Even if a user/investment is deleted, never reuse their ID
2. **Always validate** - Validate ID format before processing requests
3. **Log ID generation** - Log when new IDs are generated for audit trails
4. **Use constants** - Define ID prefixes as constants, not hardcoded strings
5. **Atomic generation** - Ensure ID generation is atomic to prevent duplicates
6. **Global sequences** - Investment and withdrawal IDs are global (not per-user)
7. **Human-readable** - IDs should be easy to read in logs and debugging

### Reference Implementation

See `/lib/idGenerator.js` for the complete implementation with:
- Sequential ID generation for all entity types
- Validation functions
- Helper utilities for extracting numeric portions
- Transaction ID generation for all types

---

## Investment States

### State Flow Diagram

```
┌─────────┐
│  START  │
└────┬────┘
     │
     ▼
┌─────────┐  User can edit/delete
│  draft  │  ❌ No interest
└────┬────┘
     │ User submits
     ▼
┌─────────┐  Waiting admin approval
│ pending │  ❌ No interest
└────┬────┘
     │
     ├─── Admin approves ───┐
     │                      ▼
     │              ┌──────────────┐  Investment is live
     │              │    active    │  ✅ Interest accrues
     │              └──────┬───────┘
     │                     │ User requests withdrawal
     │                     ▼
     │              ┌─────────────────────┐  90-day notice period
     │              │ withdrawal_notice   │  ✅ Still earning interest
     │              └──────────┬──────────┘
     │                         │ Admin processes (after eligible date)
     │                         ▼
     │                  ┌──────────┐  FINAL STATE
     │                  │ withdrawn │  ❌ No interest
     │                  └──────────┘
     │
     └─── Admin rejects ───┐
                           ▼
                    ┌──────────┐  FINAL STATE
                    │ rejected │  ❌ No interest
                    └──────────┘
```

### State Definitions

| State | Description | Interest? | Can Edit? | Final? |
|-------|-------------|-----------|-----------|--------|
| **draft** | User created, not submitted | ❌ | ✅ | No |
| **pending** | Submitted, waiting admin | ❌ | ❌ | No |
| **active** | Admin approved, live | ✅ | ❌ | No |
| **withdrawal_notice** | 90-day notice started | ✅ | ❌ | No |
| **withdrawn** | Funds returned | ❌ | ❌ | ✅ |
| **rejected** | Admin rejected | ❌ | ❌ | ✅ |

### State Transition Rules

| Current State | Action | New State | Who Can Perform |
|---------------|--------|-----------|-----------------|
| `null` | Create investment | `draft` | User |
| `draft` | Submit for approval | `pending` | User |
| `draft` | Delete | `deleted` | User |
| `pending` | Approve | `active` | Admin |
| `pending` | Reject | `rejected` | Admin |
| `active` | Request withdrawal | `withdrawal_notice` | User |
| `withdrawal_notice` | Process withdrawal | `withdrawn` | Admin (within 90 days) |
| `withdrawn` | - | - | Final state |
| `rejected` | - | - | Final state |

### Business Rules by State

**`draft`**
- User can edit amount, payment frequency, lockup period
- User can delete
- Not visible to admin
- No validation required yet

**`pending`**
- User cannot edit or delete
- Visible in admin dashboard
- Admin must approve or reject
- All validation must pass before admin can approve

**`active`**
- Interest accrues from **day after** `confirmedAt`
- Monthly events generated (payouts or compounding)
- User cannot edit
- Can only transition to `withdrawal_notice`

**`withdrawal_notice`**
- Withdrawal request submitted, processing in progress
- **Still earning interest** during this period (if compounding)
- Cannot cancel withdrawal (business rule)
- Admin can process at any time within 90-day window
- Robert Ventures has until `payoutDueBy` to complete payout
- Investment remains visible to user during and after withdrawal

**`withdrawn`**
- Final state - cannot change
- No more interest accrual
- Funds returned to investor
- Record kept for audit/tax purposes

**`rejected`**
- Final state - cannot change
- No interest ever accrued
- Reason stored in `rejectionReason` field
- Record kept for audit purposes

### Interest Accrual by State

| State | Interest Accrues? | Notes |
|-------|-------------------|-------|
| `draft` | ❌ No | Not yet submitted |
| `pending` | ❌ No | Waiting for admin approval |
| `active` | ✅ Yes | From day after `confirmedAt` |
| `withdrawal_notice` | ✅ Yes | Continues during 90-day notice |
| `withdrawn` | ❌ No | Investment completed |
| `rejected` | ❌ No | Investment never activated |

---

## Investment Rules

### 1. Investment Amounts
- **Minimum:** $1,000
- **Increment:** Must be divisible by $10
- **Bonds:** 1 bond = $10 (e.g., $10,000 = 1,000 bonds)

### 2. Lockup Periods & Rates
- **1-year:** 8% APY
- **3-year:** 10% APY

### 3. Payment Frequencies
- **Monthly:** Interest paid out each month
- **Compounding:** Interest added to principal monthly

### 4. Account Types
- Individual
- Joint (with joint holder info)
- Entity (company/trust)
- IRA
- Roth IRA
- Traditional IRA
- Custodial

---

## Interest Calculations

### For Monthly Payout Investments

Interest is calculated **daily** and paid on the **1st of each month**.

**First month is prorated:**
```python
# Example: Investment confirmed on Jan 15
# Interest accrues from Jan 16 to Jan 31 (16 days)

principal = 10000
annual_rate = 0.08  # 8% for 1-year
monthly_rate = annual_rate / 12
days_in_month = 31
days_accrued = 16  # Jan 16-31

first_payout = principal * monthly_rate * (days_accrued / days_in_month)
# = 10000 * 0.00667 * (16/31) = $34.45

# Subsequent months (full month):
monthly_payout = principal * monthly_rate
# = 10000 * 0.00667 = $66.67
```

**Key rules:**
- Interest starts accruing the **day after confirmation**
- First partial month is prorated by days
- Payment sent on 1st of following month
- Principal never changes

### For Compounding Investments

Interest compounds on the **1st of each month**.

**First month is prorated:**
```python
# Example: Investment confirmed on Jan 15
# Interest accrues from Jan 16 to Jan 31

principal = 10000
annual_rate = 0.10  # 10% for 3-year
monthly_rate = annual_rate / 12
days_in_month = 31
days_accrued = 16

# First month (prorated):
daily_rate = monthly_rate / days_in_month
first_interest = principal * daily_rate * days_accrued
new_balance = principal + first_interest
# = 10000 + (10000 * 0.00833 / 31 * 16) = $10,043.00

# Second month (full month):
second_interest = new_balance * monthly_rate
new_balance = new_balance + second_interest
# = 10043 * 0.00833 = $83.66
# new_balance = $10,126.66
```

**Key rules:**
- Interest compounds into principal monthly
- First partial month is prorated
- Balance grows exponentially

---

## Pending Payouts System

### Problem
Monthly payouts can fail if:
- Bank account disconnected
- User changed password
- Bank misconfigured

### Solution
Store failed payouts in a **pending queue** instead of losing them.

### Implementation

**When generating monthly payouts:**
```python
def create_monthly_payout(user, investment, amount, date):
    # Check bank connection status
    bank_connected = check_bank_connection(user, investment)
    
    if bank_connected:
        status = 'completed'
        send_to_bank(user.bank_account, amount)
    else:
        status = 'pending'
        failure_reason = 'Bank account connection lost'
    
    # Store transaction
    transaction = {
        'type': 'monthly_distribution',
        'amount': amount,
        'date': date,
        'status': status,
        'failure_reason': failure_reason if not bank_connected else None,
        'retry_count': 0
    }
    
    save_transaction(transaction)
```

**Admin can:**
- View all pending payouts
- Retry sending payout
- Manually mark as completed
- Mark as failed with reason

---

## Withdrawal Rules

### Lockup Period
- Investment is **locked** during lockup period
- Cannot request withdrawal until lockup expires
- User can only initiate withdrawal for **active** investments after lockup ends

### Processing Timeline
- **Robert Ventures has 90 days** from withdrawal request to process and complete payout
- This is a **business deadline**, not a user waiting period
- Admin can process withdrawal at any time within the 90-day window
- Countdown starts immediately when user requests withdrawal

### Withdrawal Business Logic
When a user requests withdrawal:
1. Investment status changes from `active` to `withdrawal_notice`
2. A `payoutDueBy` date is set to `withdrawal_requested_at + 90 days`
3. Investment continues to earn interest during this period (if compounding)
4. Admin can process withdrawal anytime before `payoutDueBy`
5. Once processed, investment status becomes `withdrawn` (final state)

**Calculation:**
```python
# When user requests withdrawal (only allowed if lockup ended)
payout_due_by = withdrawal_requested_at + 90 days

# Store in withdrawal record
withdrawal = {
    "requestedAt": withdrawal_requested_at,
    "payoutDueBy": payout_due_by,
    "status": "notice"
}

# Update investment
investment.status = "withdrawal_notice"
investment.payoutDueBy = payout_due_by
```

**Example 1: Normal case**
```
Confirmed: Jan 1, 2024
Lockup: 1 year → ends Jan 1, 2025
Withdrawal requested: Mar 1, 2025 (lockup already ended ✓)
Payout due by: May 30, 2025 (90 days later)

Timeline:
- Mar 1, 2025: User requests withdrawal
- Mar 1 - May 30: Robert Ventures processes payout
- Admin can approve anytime in this window
- Investment still visible to user throughout and after
```

**Example 2: Cannot withdraw before lockup**
```
Confirmed: Jan 1, 2024
Lockup: 3 years → ends Jan 1, 2027
Withdrawal requested: Oct 1, 2025

Result: ❌ REJECTED - Lockup period not yet ended
User must wait until Jan 1, 2027 to request withdrawal
```

**Example 3: Compounding investment**
```
Confirmed: Jan 1, 2024
Amount: $10,000
Lockup: 1 year at 8% APY compounding
Withdrawal requested: Feb 1, 2025 (13 months later)
Current value: $10,869.60

Payout due by: May 2, 2025
Interest continues accruing Feb 1 - payout date
Final payout includes all accrued interest up to payment date
```

### Amount Withdrawn

**Monthly payout investments:**
- Withdraw **principal only** ($10,000)
- Interest already paid out monthly

**Compounding investments:**
- Withdraw **full current value** (principal + accrued interest)

### Total Earnings After Withdrawal

**IMPORTANT:** When calculating portfolio metrics (dashboard summary), **Total Earnings** represents **lifetime earnings** across all investments, including withdrawn ones.

**Calculation Rules:**
- **Withdrawn investments:** Include their stored `totalEarnings` value (captured at withdrawal time)
- **Active/withdrawal_notice investments:** Calculate current earnings dynamically
- **Total Invested:** Only includes active and withdrawal_notice investments (NOT withdrawn)
- **Current Value:** Only includes active and withdrawal_notice investments (NOT withdrawn)

**Example:**
```
User has 3 investments:
1. Active compounding: $10,000 → current value $10,800 (earnings: $800)
2. Withdrawn compounding: was $5,000 → withdrawn at $5,330 (earnings: $330)
3. Active monthly: $8,000 → paid $480 in distributions so far (earnings: $480)

Dashboard metrics:
- Total Invested: $18,000 (only investments 1 and 3)
- Current Value: $18,800 (only investments 1 and 3)
- Total Earnings: $1,610 (ALL investments: $800 + $330 + $480)
```

**Why this matters:**
- Users want to see their lifetime performance, not just current holdings
- If a user earned $5,000 and withdrew it, that's still $5,000 earned
- Total Earnings should never decrease when a withdrawal completes
- The chart of earnings over time should continue to show historical earnings from withdrawn investments

**Implementation:**
```python
def calculate_total_earnings(investments, transactions, app_time):
    """
    Calculate lifetime earnings including withdrawn investments.
    """
    total = 0.0
    
    for inv in investments:
        if inv.status == 'withdrawn':
            # Use stored final earnings from withdrawal
            total += inv.totalEarnings or 0
        elif inv.status in ['active', 'withdrawal_notice']:
            # Calculate current earnings dynamically
            if inv.paymentFrequency == 'monthly':
                # Sum paid distributions
                paid = sum(
                    tx.amount for tx in transactions
                    if tx.type == 'monthly_distribution' 
                    and tx.investmentId == inv.id
                    and tx.date <= app_time
                )
                total += paid
            else:  # compounding
                # Calculate accrued earnings
                calc = calculate_investment_value(inv, app_time)
                total += calc.totalEarnings
    
    return round(total, 2)
```

---

## Data Models

### User
```json
{
  "id": "string",
  "email": "string",
  "password": "hashed_string",
  "firstName": "string",
  "lastName": "string",
  "dob": "YYYY-MM-DD",
  "ssn": "string",
  "phoneNumber": "string",
  "address": {
    "street1": "string",
    "city": "string",
    "state": "string",
    "zip": "string",
    "country": "string"
  },
  "isVerified": boolean,
  "isAdmin": boolean,
  "bankAccounts": [
    {
      "id": "string",
      "nickname": "string",
      "type": "ach",
      "connectionStatus": "connected|disconnected|error",
      "lastCheckedAt": "ISO8601"
    }
  ],
  "investments": [...],
  "transactions": [...],
  "withdrawals": [...],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### Investment
```json
{
  "id": "string",
  "userId": "string",
  "status": "draft|pending|active|withdrawal_notice|withdrawn|rejected",
  "amount": 10000,
  "bonds": 1000,
  "paymentFrequency": "monthly|compounding",
  "lockupPeriod": "1-year|3-year",
  "accountType": "individual|joint|entity|ira|roth-ira|traditional-ira|custodial",
  "anticipatedEarnings": 800.00,
  
  // Timestamps
  "createdAt": "ISO8601",           // When user created draft
  "submittedAt": "ISO8601",         // When user submitted for approval
  "confirmedAt": "ISO8601",         // When admin approved (becomes active)
  "lockupEndDate": "ISO8601",       // When lockup period ends
  
  // Withdrawal tracking (only when status = withdrawal_notice or withdrawn)
  "withdrawalNoticeStartAt": "ISO8601", // When withdrawal requested
  "payoutDueBy": "ISO8601",             // Deadline for Robert Ventures (request + 90 days)
  "withdrawnAt": "ISO8601",             // When funds actually paid out
  "finalValue": 10800.00,               // Final withdrawal amount
  "totalEarnings": 800.00,              // Total interest earned
  
  // Rejection tracking (only when status = rejected)
  "rejectedAt": "ISO8601",
  "rejectionReason": "string"
}
```

**Key Fields Explained:**

- **`confirmedAt`** - When admin approved and investment became `active`. This is when interest starts accruing (from day after).
- **`lockupEndDate`** - Calculated as `confirmedAt + lockup_period`. User cannot withdraw before this date.
- **`payoutDueBy`** - Deadline for Robert Ventures to complete payout. Set to `withdrawalNoticeStartAt + 90 days`.
- **`finalValue`** - Total amount withdrawn (principal + all accrued interest). Only set when status = `withdrawn`.
- **`withdrawnAt`** - When admin processed withdrawal and funds were paid out. Becomes final state.

### Transaction
```json
{
  "id": "string",
  "userId": "string",
  "investmentId": "string",
  "type": "monthly_distribution|monthly_compounded|withdrawal_requested",
  "amount": 66.67,
  "date": "ISO8601",
  
  // For monthly distributions only:
  "payoutStatus": "completed|pending|failed",
  "failureReason": "string or null",
  "retryCount": 0,
  "payoutBankId": "string"
}
```

### Withdrawal
```json
{
  "id": "string",
  "userId": "string",
  "investmentId": "string",
  "amount": 10000,
  "principalAmount": 10000,
  "earningsAmount": 0,
  "status": "notice|approved|rejected",
  "requestedAt": "ISO8601",
  "noticeStartAt": "ISO8601",
  "payoutDueBy": "ISO8601",
  "approvedAt": "ISO8601 or null",
  "paidAt": "ISO8601 or null"
}
```

---

## API Endpoints

### Authentication
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Investments
- `POST /api/users/:id` - Create/update investment (via `_action` param)
- `GET /api/users/:id` - Get user with investments

### Transactions
- `POST /api/migrate-transactions` - Generate monthly events (cron job)

### Withdrawals
- `POST /api/withdrawals` - Request withdrawal
- `GET /api/withdrawals?userId=:id` - Get user withdrawals
- `GET /api/admin/withdrawals` - Get all pending withdrawals
- `POST /api/admin/withdrawals` - Process/reject withdrawal

### Pending Payouts
- `GET /api/admin/pending-payouts` - List pending payouts
- `POST /api/admin/pending-payouts` - Retry/complete/fail payout

### Admin
- `GET /api/admin/time-machine` - Get app time
- `POST /api/admin/time-machine` - Set app time
- `DELETE /api/admin/time-machine` - Reset to real time
- `POST /api/admin/bank-connection` - Simulate bank connection issues

---

## Business Logic Implementation

### 1. User Creates Draft
```python
investment = {
    'status': 'draft',
    'created_at': get_current_time(),
    'amount': 10000,
    'payment_frequency': 'monthly',
    'lockup_period': '1-year'
}
```

### 2. User Submits for Approval
```python
investment.status = 'pending'
investment.submitted_at = get_current_time()
```

### 3. Admin Approves Investment
```python
investment.status = 'active'
investment.confirmed_at = get_current_time()

# Calculate lockup end date
if investment.lockup_period == '1-year':
    investment.lockup_end_date = confirmed_at + timedelta(days=365)
else:  # 3-year
    investment.lockup_end_date = confirmed_at + timedelta(days=1095)

# Interest starts accruing from the day AFTER confirmation
interest_start_date = confirmed_at + timedelta(days=1)
```

### 4. Admin Rejects Investment
```python
investment.status = 'rejected'
investment.rejected_at = get_current_time()
investment.rejection_reason = 'Insufficient documentation'
```

### 5. User Requests Withdrawal
```python
if investment.status != 'active':
    raise Error('Only active investments can be withdrawn')

investment.status = 'withdrawal_notice'
investment.withdrawal_requested_at = get_current_time()

# 90-day notice period
notice_end = withdrawal_requested_at + timedelta(days=90)
investment.withdrawal_notice_end_at = notice_end

# Payout on the later of: notice end or lockup end
investment.withdrawal_eligible_at = max(notice_end, investment.lockup_end_date)
```

### 6. Admin Processes Withdrawal
```python
if get_current_time() < investment.withdrawal_eligible_at:
    raise Error('Withdrawal not yet eligible for payout')

investment.status = 'withdrawn'
investment.withdrawn_at = get_current_time()
investment.final_value = calculate_withdrawal_amount(investment)

# Send funds to user's bank account
process_withdrawal_payout(user, investment.final_value)
```

### 7. Monthly Event Generation (Cron Job)
Should run daily to check if new month started:

```python
def generate_monthly_events():
    current_time = get_current_time()
    
    for user in get_all_users():
        for investment in user.investments:
            # Only generate events for active investments and those in withdrawal notice
            if investment.status not in ['active', 'withdrawal_notice']:
                continue
            
            if investment.payment_frequency == 'monthly':
                generate_monthly_payout(user, investment, current_time)
            else:
                generate_compounding_event(investment, current_time)
```

**Note:** Investments in `withdrawal_notice` status continue earning interest during the 90-day notice period.

### 8. Withdrawal Request Creation
```python
def create_withdrawal(user_id, investment_id):
    investment = get_investment(user_id, investment_id)
    
    # Only active investments can be withdrawn
    if investment.status != 'active':
        raise Error('Only active investments can be withdrawn')
    
    current_time = get_current_time()
    notice_end = current_time + timedelta(days=90)
    lockup_end = investment.lockup_end_date
    
    # Payout on the later date
    payout_eligible = max(notice_end, lockup_end)
    
    # Create withdrawal record
    withdrawal = {
        'id': generate_id(),
        'investment_id': investment_id,
        'user_id': user_id,
        'status': 'notice',  # notice → approved → completed
        'requested_at': current_time,
        'notice_end_at': notice_end,
        'payout_eligible_at': payout_eligible,
        'amount': calculate_withdrawal_amount(investment)
    }
    
    # Update investment status
    investment.status = 'withdrawal_notice'
    investment.withdrawal_requested_at = current_time
    investment.withdrawal_notice_end_at = notice_end
    investment.withdrawal_eligible_at = payout_eligible
    
    save_withdrawal(withdrawal)
    save_investment(investment)
    
    return withdrawal
```

---

## Validation Rules

### Email
- Must be valid email format
- Must be unique in system

### Password
- Minimum 8 characters
- Must contain: uppercase, lowercase, number, special char

### SSN
- Format: XXX-XX-XXXX
- Required for tax reporting

### Investment Amount
- Minimum: $1,000
- Must be divisible by $10

### Date of Birth
- Must be 18+ years old

---

## Database Indexes

For performance, create these indexes:

```sql
-- Investment status queries
CREATE INDEX idx_investment_status ON investments(status);
CREATE INDEX idx_investment_user_status ON investments(user_id, status);

-- Withdrawal eligible investments
CREATE INDEX idx_investment_withdrawal_eligible 
  ON investments(withdrawal_eligible_at) 
  WHERE status = 'withdrawal_notice';

-- Active investments for monthly events
CREATE INDEX idx_investment_confirmed 
  ON investments(confirmed_at) 
  WHERE status IN ('active', 'withdrawal_notice');

-- User lookup
CREATE INDEX idx_user_email ON users(email);

-- Transaction queries
CREATE INDEX idx_transaction_user ON transactions(user_id, date DESC);
CREATE INDEX idx_transaction_investment ON transactions(investment_id, date DESC);
```

### Common Queries

**Get all investments needing monthly payout:**
```sql
SELECT * FROM investments 
WHERE status IN ('active', 'withdrawal_notice')
AND payment_frequency = 'monthly'
AND confirmed_at IS NOT NULL
```

**Get withdrawals ready to process:**
```sql
SELECT * FROM investments
WHERE status = 'withdrawal_notice'
AND withdrawal_eligible_at <= CURRENT_DATE
```

**Get pending investments for admin:**
```sql
SELECT * FROM investments
WHERE status = 'pending'
ORDER BY submitted_at ASC
```

---

## Admin Time Machine

For testing and demos, admin can set a custom "app time" that affects:
- Investment calculations
- Monthly payout generation
- Lockup period checks
- Withdrawal eligibility

**Storage:**
```json
{
  "timeMachine": {
    "appTime": "2026-03-15T00:00:00.000Z",
    "isActive": true,
    "setBy": "admin-user-id",
    "setAt": "2025-10-02T12:00:00.000Z"
  }
}
```

**Usage:**
```python
def get_current_time():
    if time_machine.is_active:
        return time_machine.app_time
    else:
        return datetime.now()
```

---

## UI/UX Requirements

### Investment Visibility Rules

**Dashboard Investment List:**
Investors should see ALL their investments with these statuses:
- `active` - Currently earning interest
- `withdrawal_notice` - Withdrawal in progress
- `withdrawn` - Completed withdrawals (for historical record)

**Excluded from dashboard:**
- `draft` - Unsubmitted (shown only in creation flow)
- `pending` - Awaiting admin approval (shown in separate pending section)
- `rejected` - Admin rejected (can be shown in a separate section)

### Investment Value Display Labels

Context-aware labels based on investment status:

| Status | Label to Display | Meaning |
|--------|-----------------|---------|
| `active` | "Current Value" | Live investment value with accrued interest |
| `withdrawal_notice` | "Current Value" | Value including interest during processing |
| `withdrawn` | "Final Withdrawal Value" | The total amount that was paid out |

### Withdrawal Request Flow

**Requirements:**
1. **Only active investments** after lockup can request withdrawal
2. **Confirmation modal** (not alert) must show:
   - Principal amount
   - Total earnings
   - Total withdrawal amount
   - Clear message: "Robert Ventures has 90 days to process your payout"
   - Warning: "This action cannot be undone"
3. **After confirmation:**
   - Investment status → `withdrawal_notice`
   - Investment remains visible
   - Withdrawal tab is hidden (already requested)
   - Show withdrawal status in Investment Info tab

### Activity/Transaction Display

**Transaction Types and Labels:**
- `monthly_distribution` → "Monthly Payout"
- `monthly_compounded` → "Monthly Compounded"
- `withdrawal_notice_started` → "Withdrawal Notice Started"
- `withdrawal_approved` → "Withdrawal Processed" (not "Approved")
- `withdrawal_rejected` → "Withdrawal Rejected"

**Activity Filtering:**
- Investment details page: Show only activity for that specific investment
- Dashboard activity page: Show all activity across all investments

### Status Badges

Investment status should display user-friendly labels:
- `active` + lockup ended → "Available for Withdrawal"
- `active` + locked → "Locked"
- `withdrawal_notice` → "Withdrawal Processing"
- `withdrawn` → "Withdrawn"
- `pending` → "Pending Approval"
- `rejected` → "Rejected"

### Portfolio Totals Calculation

**When calculating portfolio summary (total value, earnings, etc.):**

Include in totals:
- `active` investments - Full current value
- `withdrawal_notice` investments - Full current value (still active until paid)

Exclude from totals:
- `withdrawn` investments - Money already returned to user
- `pending` investments - Show separately as "pending"
- `draft` investments - Not yet submitted
- `rejected` investments - Never active

**Example:**
```python
# Portfolio calculation
total_current_value = 0
total_earnings = 0

for investment in user.investments:
    if investment.status in ['active', 'withdrawal_notice']:
        calculation = calculate_value(investment, app_time)
        total_current_value += calculation.current_value
        total_earnings += calculation.total_earnings
    # withdrawn investments are visible but not in totals

return {
    "totalCurrentValue": total_current_value,
    "totalEarnings": total_earnings,
    "investments": all_visible_investments  # includes withdrawn
}
```

---

## Testing

Reference implementation has extensive tests in `/testing-docs/`:
- `test-all-account-types.js` - Tests 16 account type combinations
- `test-time-machine.js` - Tests time-based calculations
- `test-edge-cases.js` - Tests edge cases
- `test-pending-payouts.js` - Tests pending payout system

Run these to understand expected behavior.

---

## Summary

**Investment States:**
```
draft → pending → active → withdrawal_notice → withdrawn
                    ↓
                 rejected
```

**Key Points:**
1. Investment states: `draft`, `pending`, `active`, `withdrawal_notice`, `withdrawn`, `rejected`
2. Interest calculations are **daily-prorated** for partial months
3. Monthly payouts can **fail and queue** in pending state
4. Withdrawals: **Robert Ventures has 90 days** to process (not user waiting period)
5. Investments earn interest while in `withdrawal_notice` status (if compounding)
6. **Withdrawn investments remain visible** to users in dashboard (for records)
7. Admin can **time travel** for testing
8. All calculations must use **app time** (not real time)

**Critical Fields:**
- `confirmedAt` - When investment became active (interest starts next day)
- `lockupEndDate` - Earliest possible withdrawal date
- `payoutDueBy` - Deadline for Robert Ventures to complete payout (request + 90 days)
- `finalValue` - Total amount paid out (principal + interest) when withdrawn

**Data to preserve:**
- User accounts and profiles
- Investments and their complete status history
- All transaction events (never delete)
- Withdrawal requests and processing
- Bank connection status

**Integration:**
- Frontend expects same JSON response structure
- API endpoints must match exactly
- Business rules must be identical
- Calculations must match to the penny

Need clarification? Check the existing Next.js API routes in `/app/api/` for reference implementation.
