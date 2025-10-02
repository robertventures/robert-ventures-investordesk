# Backend Implementation Guide

**For:** Backend Development Team  
**Purpose:** Complete reference for implementing the investment platform backend

---

## Table of Contents

1. [Overview](#overview)
2. [Investment States](#investment-states)
3. [Investment Rules](#investment-rules)
4. [Interest Calculations](#interest-calculations)
5. [Pending Payouts System](#pending-payouts-system)
6. [Withdrawal Rules](#withdrawal-rules)
7. [Data Models](#data-models)
8. [API Endpoints](#api-endpoints)
9. [Business Logic Implementation](#business-logic-implementation)
10. [Validation Rules](#validation-rules)
11. [Database Indexes](#database-indexes)
12. [Testing](#testing)

---

## Overview

This is an investment platform where users invest in bonds with two payment options:
- **Monthly payouts** - Interest paid monthly to bank account
- **Compounding** - Interest compounds monthly, paid at maturity

**Your job:** Implement a Python backend that mirrors these business rules exactly.

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
- 90-day notice period in effect
- **Still earning interest** during notice
- Cannot cancel withdrawal (business rule)
- Admin can only process after `withdrawalEligibleAt` date
- `withdrawalEligibleAt` = max(notice_end, lockup_end)

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

### Notice Period
- **90 days notice required** from withdrawal request
- Countdown starts immediately when requested

### Lockup Period
- Investment is **locked** during lockup period
- Cannot withdraw until lockup expires

### Withdrawal Date
Payout happens on the **later of:**
- End of 90-day notice period
- End of lockup period

**Calculation:**
```python
# When user requests withdrawal
notice_end = withdrawal_requested_at + 90 days
lockup_end = confirmed_at + lockup_period (1 or 3 years)

# Payout eligible date is the LATER of these two
withdrawal_eligible_at = max(notice_end, lockup_end)
```

**Example 1: Lockup already ended**
```
Confirmed: Jan 1, 2025
Lockup: 1 year → ends Jan 1, 2026
Withdrawal requested: Mar 1, 2026
Notice period: 90 days → ends May 30, 2026

Eligible date: May 30, 2026 ✓ (notice is later)
```

**Example 2: Lockup not yet ended**
```
Confirmed: Jan 1, 2025
Lockup: 1 year → ends Jan 1, 2026
Withdrawal requested: Nov 1, 2025
Notice period: 90 days → ends Jan 30, 2026

Eligible date: Jan 30, 2026 ✓ (notice is later)
```

**Example 3: Lockup is later**
```
Confirmed: Jan 1, 2025
Lockup: 3 years → ends Jan 1, 2028
Withdrawal requested: Oct 1, 2027
Notice period: 90 days → ends Dec 30, 2027

Eligible date: Jan 1, 2028 ✓ (lockup is later)
```

### Amount Withdrawn

**Monthly payout investments:**
- Withdraw **principal only** ($10,000)
- Interest already paid out monthly

**Compounding investments:**
- Withdraw **full current value** (principal + accrued interest)

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
  "withdrawalRequestedAt": "ISO8601",
  "withdrawalNoticeEndAt": "ISO8601",   // 90 days after request
  "withdrawalEligibleAt": "ISO8601",    // max(notice_end, lockup_end)
  "withdrawnAt": "ISO8601",             // When funds returned
  "finalValue": 10800.00,               // Final withdrawal amount
  
  // Rejection tracking (only when status = rejected)
  "rejectedAt": "ISO8601",
  "rejectionReason": "string"
}
```

**Key Fields Explained:**

- **`confirmedAt`** - When admin approved and investment became `active`. This is when interest starts accruing.
- **`lockupEndDate`** - Calculated as `confirmedAt + lockup_period`. User cannot withdraw before this date.
- **`withdrawalEligibleAt`** - The later of: (90 days after request) or (lockup end date)

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
4. Withdrawals have **90-day notice + lockup period**
5. Investments earn interest while in `withdrawal_notice` status
6. Admin can **time travel** for testing
7. All calculations must use **app time** (not real time)

**Critical Fields:**
- `confirmedAt` - When investment became active (interest starts next day)
- `lockupEndDate` - Earliest possible withdrawal date
- `withdrawalEligibleAt` - Actual withdrawal date (max of notice end and lockup end)

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
