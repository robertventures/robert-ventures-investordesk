# Backend Implementation Guide

**For:** Backend Development Team  
**Purpose:** Complete reference for implementing the investment platform backend

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Verification](#authentication--verification)
3. [Dual Approval System](#dual-approval-system)
4. [ID Architecture](#id-architecture)
5. [Investment States](#investment-states)
6. [Investment Rules](#investment-rules)
7. [Interest Calculations](#interest-calculations)
8. [Pending Payouts System](#pending-payouts-system)
9. [Withdrawal Rules](#withdrawal-rules)
10. [Data Models](#data-models)
11. [API Endpoints](#api-endpoints)
12. [Business Logic Implementation](#business-logic-implementation)
13. [Validation Rules](#validation-rules)
14. [Database Indexes](#database-indexes)
15. [UI/UX Requirements](#uiux-requirements)
16. [Testing](#testing)

---

## Overview

This is an investment platform where users invest in bonds with two payment options:
- **Monthly payouts** - Interest paid monthly to bank account
- **Compounding** - Interest compounds monthly, paid at maturity

**Your job:** Implement a Python backend that mirrors these business rules exactly.

---

## Authentication & Verification

### Overview

The platform implements a progressive authentication system that allows users to sign in before completing email verification, but redirects them to complete verification before accessing the platform.

### User Sign-Up Flow

1. **Account Creation**
   - User provides email and password
   - Account created with `isVerified: false`
   - User immediately logged in
   - Redirected to `/confirmation` page

2. **Email Verification**
   - User must enter 6-digit verification code
   - Test code: `000000` (production: send real email)
   - Once verified: `isVerified: true`, `verifiedAt` timestamp set
   - User redirected to investment page

### Sign-In Flow for Unverified Users

**Key Feature:** Unverified users can sign in, but must complete verification before accessing the platform.

```python
def authenticate_user(email, password):
    """
    Authenticate user and determine redirect based on verification status.
    """
    user = get_user_by_email(email)
    
    if not user or not verify_password(password, user.password):
        return {"success": False, "error": "Invalid credentials"}
    
    # Determine redirect based on user status
    if user.is_admin:
        redirect = "/admin"
    elif not user.is_verified:
        redirect = "/confirmation"  # Must verify before accessing platform
    else:
        redirect = "/dashboard"
    
    return {
        "success": True,
        "user": user,
        "redirect": redirect
    }
```

**Business Rules:**
- ✅ Allow sign-in for unverified users
- ✅ Redirect to verification page if not verified
- ✅ Admins bypass verification check
- ✅ Store session immediately (no waiting for verification)
- ❌ Don't allow dashboard access until verified

### Password Reset & Email Verification

**Key Innovation:** Password reset serves dual purpose:
1. Allows users to reset forgotten passwords
2. Automatically verifies email (proves email ownership)

#### Password Reset Request

```python
def request_password_reset(email):
    """
    Generate password reset token and store it.
    In production, send email with reset link.
    """
    user = get_user_by_email(email)
    
    # Security: Always return success (prevent email enumeration)
    if not user:
        return {"success": True}
    
    # Generate secure token
    reset_token = generate_secure_token()  # 32-byte random hex
    reset_token_expiry = current_time() + timedelta(hours=1)
    
    # Store token
    update_user(user.id, {
        "resetToken": reset_token,
        "resetTokenExpiry": reset_token_expiry
    })
    
    # In production: send email
    # send_email(user.email, reset_link)
    
    # In development: log token
    print(f"Reset URL: /reset-password?token={reset_token}")
    
    return {"success": True}
```

#### Password Reset Processing

```python
def reset_password(token, new_password):
    """
    Reset password and automatically verify account.
    """
    # Find user by token
    user = find_user_by_reset_token(token)
    
    if not user:
        return {"success": False, "error": "Invalid or expired token"}
    
    # Check expiry
    if user.reset_token_expiry < current_time():
        return {"success": False, "error": "Token expired"}
    
    # Validate password requirements
    if not validate_password(new_password):
        return {"success": False, "error": "Password doesn't meet requirements"}
    
    # Update user
    timestamp = current_time()
    update_user(user.id, {
        "password": hash_password(new_password),
        "isVerified": True,  # Auto-verify (email ownership proven)
        "verifiedAt": user.verified_at or timestamp,
        "resetToken": None,  # Clear token
        "resetTokenExpiry": None,
        "updatedAt": timestamp
    })
    
    return {
        "success": True,
        "message": "Password reset successful. Your account has been verified."
    }
```

**Why This Works:**
- User received email → proves email ownership
- No separate verification code needed
- Better UX: one step instead of two
- Industry standard (GitHub, many SaaS platforms)

### Verification Code System

For direct email verification (not password reset):

```python
def verify_account(user_id, verification_code):
    """
    Verify user account with code.
    """
    user = get_user_by_id(user_id)
    
    if not user:
        return {"success": False, "error": "User not found"}
    
    # Check code (in production, validate against stored code)
    if verification_code != "000000":  # Test code
        return {"success": False, "error": "Invalid verification code"}
    
    # Mark as verified
    update_user(user_id, {
        "isVerified": True,
        "verifiedAt": current_time(),
        "verificationCode": None  # Clear code
    })
    
    return {"success": True}
```

### Authentication Endpoints

#### POST `/api/users` (Sign Up)
```json
Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "user": {
    "id": "USR-1001",
    "email": "user@example.com",
    "isVerified": false
  }
}
```

#### POST `/api/auth/request-reset`
```json
Request:
{
  "email": "user@example.com"
}

Response:
{
  "success": true,
  "token": "abc123..." // Only in development
}
```

#### POST `/api/auth/reset-password`
```json
Request:
{
  "token": "abc123...",
  "newPassword": "NewSecure123!"
}

Response:
{
  "success": true,
  "message": "Password reset successful. Your account has been verified."
}
```

#### PUT `/api/users/:id` (Verify Account)
```json
Request:
{
  "_action": "verifyAccount",
  "verificationCode": "000000"
}

Response:
{
  "success": true,
  "user": {
    "id": "USR-1001",
    "isVerified": true,
    "verifiedAt": "2025-10-05T12:00:00.000Z"
  }
}
```

### Security Considerations

#### Email Enumeration Prevention
```python
# ❌ BAD - Reveals if email exists
if not user:
    return {"success": False, "error": "Email not found"}

# ✅ GOOD - Always returns success
if not user:
    return {"success": True}  # Don't reveal email existence
```

#### Token Management
- **Expiry:** 1 hour for reset tokens
- **One-time use:** Clear token after successful reset
- **Secure generation:** Use `crypto.randomBytes(32)` or equivalent
- **Storage:** Store token hash, not plaintext (optional enhancement)

#### Password Requirements
Must contain:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- At least 1 special character

```python
def validate_password(password):
    if len(password) < 8:
        return False
    if not any(c.isupper() for c in password):
        return False
    if not any(c.isdigit() for c in password):
        return False
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        return False
    return True
```

### Testing the Flow

**Test Scenario 1: Unverified User Sign-In**
```
1. Create account → logged in → at /confirmation
2. Close browser (don't verify)
3. Sign in again
4. ✓ Redirected to /confirmation (not dashboard)
5. Enter code 000000
6. ✓ Verified, redirected to dashboard
7. Sign in again
8. ✓ Go directly to dashboard
```

**Test Scenario 2: Password Reset Auto-Verification**
```
1. Create account (don't verify)
2. Sign out
3. Click "Forgot Password?"
4. Enter email
5. Copy reset URL from console
6. Open reset URL
7. Create new password
8. ✓ Account automatically verified
9. Sign in with new password
10. ✓ Go directly to dashboard (no verification needed)
```

**Test Scenario 3: Already Verified User**
```
1. Sign in with verified account
2. ✓ Go directly to dashboard
3. ✓ Never see confirmation page
```

### Development vs Production

#### Development Mode
- Verification code: `000000` (hardcoded)
- Reset tokens logged to console
- Reset URLs included in API response
- No actual emails sent

#### Production Mode
- Generate random 6-digit verification codes
- Send emails via SendGrid/AWS SES/Resend
- Remove tokens from API responses
- Implement rate limiting (max 5 reset requests per hour)
- Log all authentication attempts

### Database Schema Updates

Add these fields to User model:

```python
class User:
    # Existing fields...
    is_verified: bool = False
    verified_at: datetime = None
    verification_code: str = None
    
    # Password reset fields
    reset_token: str = None
    reset_token_expiry: datetime = None
```

### Integration with Investment Flow

**Key Rule:** Users must be verified before creating investments.

```python
def create_investment(user_id, investment_data):
    user = get_user_by_id(user_id)
    
    if not user.is_verified:
        return {
            "success": False,
            "error": "Please verify your email before investing"
        }
    
    # Proceed with investment creation...
```

---

## Dual Approval System

### Overview

The platform implements a **dual approval system** for critical financial operations to ensure security and compliance. This system requires two independent approvals before funds move:

1. **Bank Approval** - Confirms funds received/available
2. **Admin Approval** - Manual review and authorization

**Rationale:**
- **Security**: Prevents unauthorized or fraudulent transactions
- **Compliance**: Ensures manual oversight of all financial movements
- **Audit Trail**: Clear record of who approved what and when
- **Future Automation**: Bank approval can be automated via banking API integration

### Investment Approval Flow

#### Current Phase: Admin Approval Only (Bank Auto-Approved)

**Phase 1 Implementation (Current):**
When a user submits an investment, it requires **admin approval only** to become active. Bank approval is automatically set to `true` until banking integration is complete.

```
User Submits → pending (bank auto-approved ✓) → Admin Reviews → active
```

**Detailed Flow:**

1. **User Submits Investment** (`status: pending`)
   - Investment created with amount, lockup, payment frequency
   - User sends funds to Robert Ventures bank account
   - `bankApproved`: **automatically set to `true`**
   - `bankApprovedBy`: "system"
   - `bankApprovedAt`: submission timestamp
   - Only needs admin approval to activate

2. **Admin Reviews & Approves** (`adminApproved: true`)
   - Admin verifies:
     - User documents complete ✓
     - Investment details correct ✓
     - No red flags ✓
   - Admin approves → `adminApproved: true`

3. **Investment Activated** (`status: active`)
   - When admin approves, investment immediately activates (bank already approved)
   - System automatically sets `status: active`
   - `confirmedAt` timestamp set
   - Interest starts accruing next day

**Phase 2 Implementation (Future - Banking Integration):**
When banking API is integrated, the flow changes to true dual approval:

```
User Submits → pending → Bank API Confirms Receipt → pending (bank approved) → Admin Reviews → active
```

1. **User Submits Investment** (`status: pending`)
   - `bankApproved`: **set to `false`** (waiting for bank confirmation)
   - User sends funds to Robert Ventures bank account

2. **Banking API Webhook** (`bankApproved: true`)
   - Banking API detects incoming transfer
   - System matches transfer to pending investment
   - Auto-marks `bankApproved: true`
   - `bankApprovedBy`: "system"

3. **Admin Reviews & Approves** (`adminApproved: true`)
   - Admin verifies bank approval received
   - Admin manually approves

4. **Investment Activated** (`status: active`)
   - Both approvals complete → auto-activates

**Data Model:**

```python
class Investment:
    # ... existing fields ...
    
    # Dual approval fields
    bank_approved: bool = True  # Default TRUE until banking integration complete
    bank_approved_at: datetime = None
    bank_approved_by: str = "system"  # "system" for auto-approval, admin ID for manual
    
    admin_approved: bool = False
    admin_approved_at: datetime = None
    admin_approved_by: str = None  # admin user ID
    
    # Only set when BOTH approvals complete
    confirmed_at: datetime = None
```

**IMPORTANT - Current Phase:**
- `bankApproved` defaults to `True` (auto-approved by system)
- This allows admin-only approval workflow during development
- Infrastructure is in place for future banking API integration
- When banking integration is ready, change default to `False`

**Business Rules:**

```python
def can_activate_investment(investment):
    """
    Investment can only activate when both approvals are complete.
    """
    return investment.bank_approved and investment.admin_approved

def activate_investment_if_ready(investment):
    """
    Auto-activate investment when both approvals are complete.
    """
    if not investment.bank_approved or not investment.admin_approved:
        return False
    
    if investment.status == 'pending':
        investment.status = 'active'
        investment.confirmed_at = current_time()
        
        # Calculate lockup end date
        if investment.lockup_period == '1-year':
            investment.lockup_end_date = investment.confirmed_at + timedelta(days=365)
        else:  # 3-year
            investment.lockup_end_date = investment.confirmed_at + timedelta(days=1095)
        
        # Create confirmation activity event
        create_activity_event(
            user_id=investment.user_id,
            investment_id=investment.id,
            type='investment_confirmed',
            amount=investment.amount,
            date=investment.confirmed_at
        )
        
        return True
    
    return False
```

**API Implementation:**

```python
# POST /api/admin/investments/:id/approve-bank
def approve_bank(investment_id, admin_id):
    """
    Mark investment as bank approved (funds received).
    """
    investment = get_investment(investment_id)
    
    if investment.status != 'pending':
        return {"success": False, "error": "Only pending investments can be bank approved"}
    
    investment.bank_approved = True
    investment.bank_approved_at = current_time()
    investment.bank_approved_by = admin_id  # or "system" for future automation
    
    save_investment(investment)
    
    # Check if ready to activate
    activate_investment_if_ready(investment)
    
    return {"success": True, "investment": investment}


# POST /api/admin/investments/:id/approve-admin
def approve_admin(investment_id, admin_id):
    """
    Admin approves investment after reviewing details.
    """
    investment = get_investment(investment_id)
    
    if investment.status != 'pending':
        return {"success": False, "error": "Only pending investments can be admin approved"}
    
    investment.admin_approved = True
    investment.admin_approved_at = current_time()
    investment.admin_approved_by = admin_id
    
    save_investment(investment)
    
    # Check if ready to activate
    activate_investment_if_ready(investment)
    
    return {"success": True, "investment": investment}
```

### Monthly Payout Approval Flow

#### Payout Requires Admin Approval

All monthly payouts (for `monthly` payment frequency investments) require admin approval before being sent to users' bank accounts.

**Flow:**

```
Monthly Event Generated → pending_approval → Admin Reviews → approved → Send to Bank → completed
```

**Detailed Process:**

1. **System Generates Monthly Payout** (Cron Job)
   - On 1st of each month, system generates payouts
   - Status: `pending_approval`
   - Amount calculated and stored
   - Payout queued for admin review

2. **Admin Reviews Payout Queue**
   - Admin dashboard shows all `pending_approval` payouts
   - Admin verifies:
     - Investment is active ✓
     - Bank account connected ✓
     - Amount is correct ✓
     - No withdrawal in progress ✓

3. **Admin Approves Payout**
   - Admin clicks "Approve Payout"
   - Status: `approved`
   - `approvedBy` and `approvedAt` recorded

4. **System Sends to Bank**
   - Automated process sends approved payouts to bank
   - If successful: Status: `completed`
   - If failed: Status: `failed`, queued for retry

**Data Model for Payouts:**

```python
class ActivityEvent:
    # ... existing fields ...
    
    # For monthly_distribution events only
    payout_status: str = None  # 'pending_approval' | 'approved' | 'completed' | 'failed'
    approved_by: str = None  # admin user ID
    approved_at: datetime = None
    
    # Failure handling
    failure_reason: str = None
    retry_count: int = 0
    
    # Bank details
    payout_bank_id: str = None
    payout_bank_nickname: str = None
```

**Payout Status Flow:**

```python
PAYOUT_STATUS_FLOW = {
    'pending_approval': 'Waiting for admin approval',
    'approved': 'Approved, ready to send',
    'completed': 'Successfully sent to bank',
    'failed': 'Bank transfer failed'
}
```

**Generate Monthly Payouts (Cron Job):**

```python
def generate_monthly_payouts(target_date):
    """
    Generate monthly payouts for all active investments.
    All payouts start as 'pending_approval'.
    """
    # Only generate on 1st of month
    if target_date.day != 1:
        return
    
    users = get_all_users()
    
    for user in users:
        for investment in user.investments:
            # Only for active investments with monthly payments
            if investment.status not in ['active', 'withdrawal_notice']:
                continue
            
            if investment.payment_frequency != 'monthly':
                continue
            
            # Calculate payout amount
            amount = calculate_monthly_payout(investment, target_date)
            
            if amount <= 0:
                continue
            
            # Create activity event with pending_approval status
            event_id = generate_activity_event_id('INV', investment.id, 'monthly_distribution', {
                'date': target_date
            })
            
            # Check if event already exists (prevent duplicates)
            if activity_event_exists(user.id, event_id):
                continue
            
            # Get user's primary bank account
            bank = get_primary_bank_account(user)
            
            event = {
                'id': event_id,
                'userId': user.id,
                'investmentId': investment.id,
                'type': 'monthly_distribution',
                'amount': amount,
                'date': target_date.isoformat(),
                'payoutStatus': 'pending_approval',  # Requires admin approval
                'approvedBy': None,
                'approvedAt': None,
                'payoutBankId': bank.id if bank else None,
                'payoutBankNickname': bank.nickname if bank else None,
                'failureReason': None,
                'retryCount': 0
            }
            
            user.activity.append(event)
            save_user(user)
            
            print(f"Generated payout {event_id} - pending admin approval")
```

**Admin Approves Payout:**

```python
# POST /api/admin/payouts/:event_id/approve
def approve_payout(event_id, admin_id):
    """
    Admin approves a pending payout.
    """
    # Find the activity event
    user, event = find_activity_event(event_id)
    
    if not event:
        return {"success": False, "error": "Payout not found"}
    
    if event['type'] != 'monthly_distribution':
        return {"success": False, "error": "Not a payout event"}
    
    if event['payoutStatus'] != 'pending_approval':
        return {"success": False, "error": "Payout already processed"}
    
    # Update status
    event['payoutStatus'] = 'approved'
    event['approvedBy'] = admin_id
    event['approvedAt'] = current_time().isoformat()
    
    save_user(user)
    
    # Trigger bank transfer (async process)
    queue_bank_transfer(event)
    
    return {"success": True, "event": event}


def queue_bank_transfer(event):
    """
    Queue approved payout for bank transfer.
    This can be processed by a separate worker.
    """
    try:
        # Attempt to send to bank
        success = send_to_bank_account(
            bank_id=event['payoutBankId'],
            amount=event['amount']
        )
        
        if success:
            event['payoutStatus'] = 'completed'
        else:
            event['payoutStatus'] = 'failed'
            event['failureReason'] = 'Bank transfer failed'
            event['retryCount'] += 1
        
    except Exception as e:
        event['payoutStatus'] = 'failed'
        event['failureReason'] = str(e)
        event['retryCount'] += 1
```

**Batch Approval:**

```python
# POST /api/admin/payouts/batch-approve
def batch_approve_payouts(event_ids, admin_id):
    """
    Approve multiple payouts at once.
    """
    results = []
    
    for event_id in event_ids:
        result = approve_payout(event_id, admin_id)
        results.append({
            'event_id': event_id,
            'success': result['success'],
            'error': result.get('error')
        })
    
    return {
        "success": True,
        "results": results,
        "approved_count": sum(1 for r in results if r['success'])
    }
```

### Admin Dashboard Requirements

#### Investment Approvals View

**Pending Approvals Section:**

```
┌─────────────────────────────────────────────────┐
│ Pending Investment Approvals (3)                │
├─────────────────────────────────────────────────┤
│ INV-10001 | John Doe | $10,000 | 1-year         │
│ ✓ Bank Approved    ⏳ Admin Pending             │
│ [Approve] [Reject] [View Details]               │
│─────────────────────────────────────────────────│
│ INV-10002 | Jane Smith | $25,000 | 3-year       │
│ ⏳ Bank Pending    ⏳ Admin Pending              │
│ [Mark Bank Received] [View Details]             │
│─────────────────────────────────────────────────│
│ INV-10003 | Bob Wilson | $50,000 | 3-year       │
│ ✓ Bank Approved    ✓ Admin Approved             │
│ Status: Activating...                           │
└─────────────────────────────────────────────────┘
```

**Display Rules:**
- Show approval status for both bank and admin
- "Approve" button only enabled when bank approved
- Show who approved and when
- Auto-refresh when both approvals complete

#### Monthly Payout Approvals View

**Pending Payouts Section:**

```
┌─────────────────────────────────────────────────┐
│ Pending Payout Approvals (12)                   │
│ Total Amount: $8,450.00                         │
├─────────────────────────────────────────────────┤
│ ☐ INV-10001 | John Doe | $66.67 | Nov 2025     │
│ ☐ INV-10002 | Jane Smith | $208.33 | Nov 2025  │
│ ☐ INV-10005 | Bob Wilson | $416.67 | Nov 2025  │
│ ... (9 more)                                    │
│─────────────────────────────────────────────────│
│ [Select All] [Approve Selected (0)]             │
│ [Approve All ($8,450.00)]                       │
└─────────────────────────────────────────────────┘
```

**Features:**
- Checkbox selection for batch approval
- Show total amount to be approved
- Filter by month, investment, or user
- Show bank account details for each payout
- Approve all or approve selected

### Security Considerations

#### Approval Permissions

```python
def require_admin_permission(admin_id, permission):
    """
    Check if admin has specific permission.
    """
    admin = get_user(admin_id)
    
    if not admin.is_admin:
        raise PermissionError("Not an admin")
    
    # Future: role-based permissions
    # if permission not in admin.permissions:
    #     raise PermissionError(f"Missing permission: {permission}")
    
    return True


def can_approve_investments(admin_id):
    return require_admin_permission(admin_id, 'approve_investments')


def can_approve_payouts(admin_id):
    return require_admin_permission(admin_id, 'approve_payouts')
```

#### Audit Trail

Every approval must be logged:

```python
def log_approval_action(action_type, entity_id, admin_id, details):
    """
    Log all approval actions for audit trail.
    """
    log_entry = {
        'timestamp': current_time(),
        'action_type': action_type,  # 'investment_bank_approved', 'investment_admin_approved', 'payout_approved'
        'entity_id': entity_id,
        'admin_id': admin_id,
        'admin_email': get_user(admin_id).email,
        'details': details
    }
    
    save_audit_log(log_entry)
```

#### Approval Validation

```python
def validate_investment_approval(investment, admin_id):
    """
    Validate investment can be approved.
    """
    if investment.status != 'pending':
        raise ValidationError("Investment must be in pending status")
    
    if investment.admin_approved:
        raise ValidationError("Investment already admin approved")
    
    if not investment.bank_approved:
        raise ValidationError("Bank approval required first")
    
    # Additional checks
    user = get_user(investment.user_id)
    if not user.is_verified:
        raise ValidationError("User must verify email before approval")
    
    if not user.bank_accounts:
        raise ValidationError("User must connect bank account")
    
    return True
```

### Implementation Phases

**Phase 1 (Current): Auto-Approved Bank, Admin-Only Workflow**
- `bankApproved`: Defaults to `True` on investment submission
- `bankApprovedBy`: "system"
- Only admin approval required to activate investment
- Infrastructure in place for dual approval
- Simplifies development and testing

**Phase 2 (Future): True Dual Approval with Banking Integration**
- Change default: `bankApproved = False`
- Integrate with banking API (Plaid, Stripe Treasury, etc.)
- System automatically detects incoming transfers
- Match transfer to pending investment by amount/reference
- Auto-set `bankApproved: true` when funds received
- `bankApprovedBy`: "system"
- Admin still required for final approval
- Full dual approval security in place

```python
# Future implementation
def handle_bank_webhook(webhook_data):
    """
    Handle incoming webhook from banking provider.
    Auto-approve bank when funds received.
    """
    if webhook_data['type'] == 'transfer.received':
        amount = webhook_data['amount']
        reference = webhook_data['reference']  # Should contain investment ID
        
        # Find matching pending investment
        investment = find_pending_investment_by_reference(reference, amount)
        
        if investment:
            approve_bank(investment.id, admin_id="system")
            
            # Notify admin
            send_notification_to_admin(
                f"Investment {investment.id} bank auto-approved. Please review."
            )
```

### Testing Dual Approval System

**Test Scenario 1: Current Phase (Admin-Only Approval)**
```
1. User submits investment → status: pending
2. ✓ Bank auto-approved → bankApproved: true, bankApprovedBy: "system"
3. Admin approves investment → adminApproved: true
4. ✓ System immediately activates → status: active, confirmedAt set
5. ✓ Interest starts accruing next day
```

**Test Scenario 2: Future Phase (True Dual Approval)**
```
1. User submits investment → status: pending, bankApproved: false
2. Banking API detects funds → bankApproved: true, status still pending
3. Admin approves investment → adminApproved: true
4. ✓ System auto-activates → status: active
5. ✓ Interest starts accruing next day
```

**Test Scenario 3: Monthly Payout Approval**
```
1. System generates monthly payouts → status: pending_approval
2. Admin reviews payout queue
3. Admin approves individual payout → status: approved
4. ✓ System sends to bank → status: completed
```

**Test Scenario 4: Batch Payout Approval**
```
1. System generates 15 payouts for November
2. Admin selects all 15 payouts
3. Admin clicks "Approve All"
4. ✓ All 15 move to approved status
5. ✓ Background worker processes all bank transfers
```

**Test Scenario 5: Failed Payout Retry**
```
1. Payout approved and sent to bank
2. Bank transfer fails → status: failed
3. Admin views failed payouts
4. Admin clicks retry → retryCount++
5. ✓ Payout reprocessed
```

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
| **Activity Event** | `TX-{type}-{numericId}-{TYPE}` | Various | See below | **All uppercase** composite format |

### Activity Event ID Patterns

Activity event IDs (previously called "transactions") follow the pattern: `TX-{entityType}-{numericId}-{TYPE}[-{SUFFIX}]`

**Format Rules:**
- All event IDs use **ALL UPPERCASE** format
- Entity type prefix (USR, INV, WDL) is **NOT duplicated** in the numeric ID portion
- Event types and suffixes are **UPPERCASE**

| Event Type | ID Pattern | Example |
|-----------------|------------|---------|
| Account Created | `TX-USR-{numericId}-ACCOUNT-CREATED` | `TX-USR-1001-ACCOUNT-CREATED` |
| Investment Created | `TX-INV-{numericId}-CREATED` | `TX-INV-10000-CREATED` |
| Investment Confirmed | `TX-INV-{numericId}-CONFIRMED` | `TX-INV-10000-CONFIRMED` |
| Monthly Distribution | `TX-INV-{numericId}-MD-{YYYY-MM}` | `TX-INV-10000-MD-2025-11` |
| Monthly Compounded | `TX-INV-{numericId}-MC-{YYYY-MM}` | `TX-INV-10000-MC-2025-11` |
| Withdrawal Notice | `TX-WDL-{numericId}-NOTICE` | `TX-WDL-10000-NOTICE` |
| Withdrawal Approved | `TX-WDL-{numericId}-APPROVED` | `TX-WDL-10000-APPROVED` |
| Withdrawal Rejected | `TX-WDL-{numericId}-REJECTED` | `TX-WDL-10000-REJECTED` |

**IMPORTANT - Activity Event ID Rules:**
- ✅ **Use ALL UPPERCASE** for entire ID (e.g., `TX-INV-10000-CREATED`)
- ✅ **Strip entity prefix** from numeric portion (e.g., `TX-USR-1001`, NOT `TX-USR-USR-1001`)
- ✅ **Create exactly ONE event per occurrence** (no duplicates)
- ✅ **Include only the numeric ID** without the prefix (e.g., use `1001` from `USR-1001`)
- ❌ **Never use lowercase** letters in event IDs
- ❌ **Never duplicate the entity prefix** (e.g., avoid `TX-INV-INV-10000`)
- ❌ **Never create duplicate events** for the same occurrence

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

#### Activity Event IDs
```python
def generate_activity_event_id(entity_type, entity_id, event_type, options=None):
    """
    Generate activity event ID based on type and context.
    
    Args:
        entity_type: 'USR', 'INV', or 'WDL'
        entity_id: Full entity ID (e.g., 'USR-1001') or just numeric portion (e.g., '1001')
        event_type: Type of event
        options: Optional dict with additional data (e.g., date for monthly events)
    
    Returns:
        Event ID in format: TX-{entityType}-{numericId}-{TYPE}
    """
    # Strip entity prefix from entity_id if present to avoid duplication
    # e.g., "USR-1001" -> "1001", "INV-10000" -> "10000"
    clean_entity_id = entity_id
    if isinstance(entity_id, str) and '-' in entity_id:
        parts = entity_id.split('-')
        if parts[0] == entity_type:
            clean_entity_id = '-'.join(parts[1:])
    
    prefix = f"TX-{entity_type}-{clean_entity_id}"
    
    if event_type == "account_created":
        return f"{prefix}-ACCOUNT-CREATED"
    
    elif event_type == "investment_created":
        return f"{prefix}-CREATED"
    
    elif event_type == "investment_confirmed":
        return f"{prefix}-CONFIRMED"
    
    elif event_type == "monthly_distribution":
        # Format: TX-INV-{numericId}-MD-YYYY-MM
        date = options.get('date')
        year = date.year
        month = str(date.month).zfill(2)
        return f"{prefix}-MD-{year}-{month}"
    
    elif event_type == "monthly_compounded":
        # Format: TX-INV-{numericId}-MC-YYYY-MM
        date = options.get('date')
        year = date.year
        month = str(date.month).zfill(2)
        return f"{prefix}-MC-{year}-{month}"
    
    elif event_type == "withdrawal_notice_started":
        return f"{prefix}-NOTICE"
    
    elif event_type == "withdrawal_approved":
        return f"{prefix}-APPROVED"
    
    elif event_type == "withdrawal_rejected":
        return f"{prefix}-REJECTED"
    
    return f"{prefix}-{event_type.upper()}"

# Examples:
# TX-USR-1001-ACCOUNT-CREATED
# TX-INV-10000-CREATED
# TX-INV-10000-CONFIRMED
# TX-INV-10000-MD-2025-11
# TX-INV-10000-MC-2025-11
# TX-WDL-10000-NOTICE
# TX-WDL-10000-APPROVED
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
| `pending` | Mark bank received | `pending` (bank approved) | Admin/System |
| `pending` | Admin approves | `pending` (admin approved) | Admin |
| `pending` (both approved) | Auto-activate | `active` | System |
| `pending` | Reject | `rejected` | Admin |
| `active` | Request withdrawal | `withdrawal_notice` | User |
| `withdrawal_notice` | Process withdrawal | `withdrawn` | Admin (within 90 days) |
| `withdrawn` | - | - | Final state |
| `rejected` | - | - | Final state |

**Note:** Investment only becomes `active` when BOTH `bankApproved` AND `adminApproved` are true.

### Business Rules by State

**`draft`**
- User can edit amount, payment frequency, lockup period
- User can delete
- Not visible to admin
- No validation required yet

**`pending`**
- User cannot edit or delete
- Visible in admin dashboard
- Requires TWO approvals: bank AND admin
- Bank approval: Confirms funds received
- Admin approval: Manual review and authorization
- Investment auto-activates when both approvals complete
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
- **Individual** - Single person investment account
- **Joint** - Shared account with joint holder information
- **Entity** - Business entity (LLC, Corporation, Trust, etc.)
- **IRA** - Individual Retirement Account (Traditional or Roth)

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

### Important Schema Changes

**Recent updates to the data model (October 2025):**

1. **`activity` replaces `transactions`**
   - User object now has `activity` array instead of `transactions`
   - This better reflects that the array contains all account activity, not just financial transactions
   - All API responses and database queries should use `activity` field
   - Frontend components updated to reference `user.activity` instead of `user.transactions`

2. **`acknowledgements` field removed from User**
   - The `acknowledgements` field at the user level has been removed
   - Acknowledgements are tracked per-investment in the `documents.consent` section
   - This is captured during the investment finalization step, not at the user level

3. **`anticipatedEarnings` NOT stored in Investment**
   - The `anticipatedEarnings` field is **calculated dynamically**, not stored
   - Frontend calculates this value on-the-fly based on:
     - Investment amount
     - Lockup period (1-year = 8% APY, 3-year = 10% APY)
     - Payment frequency (monthly vs compounding)
   - Backend should **never** store this value in the database
   - Example calculation in `InvestmentReviewForm.js` shows proper implementation

4. **Account Types reduced to 4**
   - Only four valid account types: `individual`, `joint`, `entity`, `ira`
   - Removed: `custodial`, `roth-ira`, `traditional-ira`
   - IRA subtype (traditional/roth) is stored in the investment's `iraType` field

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
  "verifiedAt": "ISO8601 or null",
  "verificationCode": "string or null",
  "resetToken": "string or null",
  "resetTokenExpiry": "ISO8601 or null",
  "isAdmin": boolean,
  "trustedContact": {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string",
    "relationship": "spouse|parent|sibling|child|friend|attorney|financial_advisor|other"
  },
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
  "activity": [...],
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
  "accountType": "individual|joint|entity|ira",
  
  // Timestamps
  "createdAt": "ISO8601",           // When user created draft
  "submittedAt": "ISO8601",         // When user submitted for approval
  "confirmedAt": "ISO8601",         // When BOTH approvals complete (becomes active)
  "lockupEndDate": "ISO8601",       // When lockup period ends
  
  // Dual approval fields
  "bankApproved": true,             // Defaults to TRUE (auto-approved until banking integration)
  "bankApprovedAt": "ISO8601",
  "bankApprovedBy": "system",       // "system" for auto-approval, admin ID for manual
  "adminApproved": false,           // Admin manual approval (required)
  "adminApprovedAt": "ISO8601 or null",
  "adminApprovedBy": "string or null", // Admin user ID
  
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

- **`bankApproved`** - True when bank confirms funds received. Required before admin can approve.
- **`adminApproved`** - True when admin manually approves investment. Required before activation.
- **`confirmedAt`** - When BOTH approvals complete and investment became `active`. Interest starts accruing from day after.
- **`lockupEndDate`** - Calculated as `confirmedAt + lockup_period`. User cannot withdraw before this date.
- **`payoutDueBy`** - Deadline for Robert Ventures to complete payout. Set to `withdrawalNoticeStartAt + 90 days`.
- **`finalValue`** - Total amount withdrawn (principal + all accrued interest). Only set when status = `withdrawn`.
- **`withdrawnAt`** - When admin processed withdrawal and funds were paid out. Becomes final state.

**Important Notes:**
- **`anticipatedEarnings` is NOT stored** - This value is calculated dynamically based on amount, lockup period, and payment frequency. Do not include this field in the database schema.
- **`accountType` values** - Only four types are valid: `individual`, `joint`, `entity`, `ira`. The `ira` type can have subtypes (traditional/roth) stored in `iraType` field.

### Activity Entry (formerly Transaction)

**Note:** Activity entries are stored in the user's `activity` array (not `transactions`). Each entry represents a significant event in the user's investment journey.

```json
{
  "id": "TX-INV-10000-MD-2025-11",  // Format: TX-{entityType}-{numericId}-{TYPE} (all uppercase)
  "userId": "USR-1001",  // Optional - usually inferred from context
  "investmentId": "INV-10000",  // Present for investment/withdrawal events, absent for account_created
  "type": "account_created|investment_created|investment_confirmed|monthly_distribution|monthly_compounded|withdrawal_requested|withdrawal_approved",
  "amount": 66.67,  // Present for monetary events, ABSENT for account_created
  "date": "2025-10-05T00:00:00.000Z",  // ISO8601 format

  // For monthly distributions only:
  "payoutStatus": "pending_approval|approved|completed|failed",
  "approvedBy": "string or null",  // Admin user ID who approved
  "approvedAt": "ISO8601 or null",
  "failureReason": "string or null",
  "retryCount": 0,
  "payoutBankId": "BANK-USR-1001-1",
  "payoutBankNickname": "Primary Account",
  "monthIndex": 1
}
```

**Important Activity Event Field Rules:**
- `id`: Always uppercase format (e.g., `TX-INV-10000-CREATED`)
- `amount`: Only present for monetary events (investment_created, investment_confirmed, monthly_distribution, monthly_compounded, withdrawals). **NOT present for account_created**.
- `investmentId`: Present for investment and withdrawal events, absent for account_created
- `payoutStatus`, `approvedBy`, `approvedAt`, `failureReason`, etc.: Only present for monthly_distribution events
- **New:** `payoutStatus` includes `pending_approval` state for admin approval workflow

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

### Authentication & User Management
- `POST /api/users` - Create user account
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user (includes verify account action)
- `DELETE /api/users/:id` - Delete user
- `POST /api/auth/request-reset` - Request password reset token
- `POST /api/auth/reset-password` - Reset password with token

### Investments
- `POST /api/users/:id` - Create/update investment (via `_action` param)
- `GET /api/users/:id` - Get user with investments
- `POST /api/admin/investments/:id/approve-bank` - Mark bank approval (funds received)
- `POST /api/admin/investments/:id/approve-admin` - Admin approves investment
- `POST /api/admin/investments/:id/reject` - Reject investment

### Transactions
- `POST /api/migrate-transactions` - Generate monthly events (cron job)

### Withdrawals
- `POST /api/withdrawals` - Request withdrawal
- `GET /api/withdrawals?userId=:id` - Get user withdrawals
- `GET /api/admin/withdrawals` - Get all pending withdrawals
- `POST /api/admin/withdrawals` - Process/reject withdrawal

### Pending Payouts & Approvals
- `GET /api/admin/pending-payouts` - List payouts needing approval
- `POST /api/admin/payouts/:event_id/approve` - Approve single payout
- `POST /api/admin/payouts/batch-approve` - Approve multiple payouts
- `POST /api/admin/payouts/:event_id/retry` - Retry failed payout

### Admin
- `GET /api/admin/time-machine` - Get app time
- `POST /api/admin/time-machine` - Set app time
- `DELETE /api/admin/time-machine` - Reset to real time
- `POST /api/admin/bank-connection` - Simulate bank connection issues

---

## Business Logic Implementation

### 0. User Account Creation

When a new user signs up, the system must create exactly **one** account creation transaction:

```python
def create_user(email, password):
    """
    Create new user account with initial activity event.
    CRITICAL: Only create ONE account_created event.
    """
    timestamp = get_current_time()
    user_id = generate_user_id()  # e.g., "USR-1001"
    
    # Generate activity event ID using the standard function
    # This will produce: TX-USR-1001-ACCOUNT-CREATED
    event_id = generate_activity_event_id('USR', user_id, 'account_created')
    
    user = {
        'id': user_id,
        'email': email.lower().strip(),
        'password': hash_password(password),
        'created_at': timestamp,
        'updated_at': timestamp,
        'is_verified': False,
        'investments': [],
        'activity': [
            {
                'id': event_id,
                'type': 'account_created',
                'date': timestamp
                # NOTE: No 'amount' field - account creation events don't have monetary value
            }
        ]
    }
    
    return user
```

**CRITICAL RULES:**
- ✅ **ONE event per occurrence** - Never create duplicate events
- ✅ **ALL UPPERCASE format** - Event IDs must be entirely uppercase (e.g., `TX-USR-1001-ACCOUNT-CREATED`)
- ✅ **Standard format** - Follow pattern: `TX-{entityType}-{numericId}-{TYPE}`
- ✅ **No amount field** - Account creation events don't have monetary values
- ✅ **Idempotency** - If user creation is retried, check for existing user first
- ❌ **NO lowercase** - Never use `tx-` (lowercase) for transaction IDs
- ❌ **NO duplicates** - Each event should create exactly one transaction

**Common Mistake to Avoid:**
```python
# ❌ WRONG - Creates duplicate activity entries
user.activity = [
    {'id': 'TX-USR-USR-1001-account-created', ...},  # Correct format
    {'id': 'tx-USR-1001-account-created', ...}       # Duplicate with wrong format
]

# ✅ CORRECT - Single activity entry with proper format
user.activity = [
    {'id': 'TX-USR-USR-1001-account-created', ...}   # One entry
]
```

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
def submit_investment(investment):
    """
    Submit investment for approval.
    Bank approval is auto-set to true until banking integration is ready.
    """
    investment.status = 'pending'
    investment.submitted_at = get_current_time()
    
    # Phase 1: Auto-approve bank (no banking integration yet)
    investment.bank_approved = True
    investment.bank_approved_at = get_current_time()
    investment.bank_approved_by = "system"
    
    # Phase 2: When banking integration is ready, set to False
    # investment.bank_approved = False
    # investment.bank_approved_at = None
    # investment.bank_approved_by = None
    
    investment.admin_approved = False
    investment.admin_approved_at = None
    investment.admin_approved_by = None
    
    save_investment(investment)
```

### 3a. Bank Approval (Optional - For Phase 2)
```python
def approve_bank(investment_id, admin_id):
    """
    Mark investment as bank approved (funds received).
    
    NOTE: This endpoint is optional in Phase 1 since bankApproved defaults to True.
    Will be used in Phase 2 when banking integration is implemented.
    """
    investment = get_investment(investment_id)
    
    if investment.status != 'pending':
        raise ValidationError("Only pending investments can be bank approved")
    
    investment.bank_approved = True
    investment.bank_approved_at = get_current_time()
    investment.bank_approved_by = admin_id  # or "system" for automation
    
    save_investment(investment)
    
    # Check if both approvals complete → auto-activate
    if investment.bank_approved and investment.admin_approved:
        activate_investment(investment)
```

### 3b. Admin Approval (Primary Approval in Phase 1)
```python
def approve_admin(investment_id, admin_id):
    """
    Admin approves investment after reviewing details.
    
    Phase 1: Since bankApproved defaults to True, this will immediately activate.
    Phase 2: Will check for bank approval before activating.
    """
    investment = get_investment(investment_id)
    
    if investment.status != 'pending':
        raise ValidationError("Only pending investments can be admin approved")
    
    # Phase 1: Bank is always pre-approved, so this check always passes
    # Phase 2: Uncomment this check when banking integration is ready
    # if not investment.bank_approved:
    #     raise ValidationError("Bank approval required before admin approval")
    
    investment.admin_approved = True
    investment.admin_approved_at = get_current_time()
    investment.admin_approved_by = admin_id
    
    save_investment(investment)
    
    # Check if both approvals complete → auto-activate
    # In Phase 1, bank is always approved, so this will activate immediately
    if investment.bank_approved and investment.admin_approved:
        activate_investment(investment)
```

### 3c. Auto-Activation (When Both Approvals Complete)
```python
def activate_investment(investment):
    """
    Activate investment when both approvals are complete.
    """
    investment.status = 'active'
    investment.confirmed_at = get_current_time()
    
    # Calculate lockup end date
    if investment.lockup_period == '1-year':
        investment.lockup_end_date = investment.confirmed_at + timedelta(days=365)
    else:  # 3-year
        investment.lockup_end_date = investment.confirmed_at + timedelta(days=1095)
    
    # Create confirmation activity event
    create_activity_event(
        user_id=investment.user_id,
        investment_id=investment.id,
        type='investment_confirmed',
        amount=investment.amount,
        date=investment.confirmed_at
    )
    
    save_investment(investment)
    
    # Interest starts accruing from the day AFTER confirmation
    interest_start_date = investment.confirmed_at + timedelta(days=1)
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
- Normalized to lowercase before storage
- Verification required before investing (but not for sign-in)

### Password
- Minimum 8 characters
- Must contain: uppercase letter, number, special character
- Hashed before storage (never store plaintext)
- Reset tokens expire after 1 hour

### SSN
- Format: XXX-XX-XXXX
- Required for tax reporting

### Investment Amount
- Minimum: $1,000
- Must be divisible by $10

### Date of Birth
- Must be 18+ years old

### Investment Status Transitions
- **CRITICAL:** Active investments (`status = 'active'`) cannot be rejected
- Once an investment is active, it can only transition to `withdrawal_notice` or remain `active`
- This rule must be enforced in both API validation and UI (disabled reject button)
- Attempting to reject an active investment should return HTTP 400 with error: "Cannot reject an active investment"

### Dual Approval Requirements

**Phase 1 (Current - Development):**
- Bank approval **auto-set to true** on investment submission
- Only admin approval required to activate
- Simplifies testing and development workflow
- Infrastructure ready for Phase 2

**Phase 2 (Future - Production with Banking):**
- Bank approval required before activation
- Admin approval required before activation
- Investment automatically activates when BOTH approvals complete
- Order doesn't matter: bank→admin or admin→bank (system handles both)
- Each approval action is logged with timestamp and approver ID

### Monthly Payout Approvals
- All monthly payouts (`paymentFrequency: 'monthly'`) start as `pending_approval`
- Admin must approve before payout is sent to bank
- Batch approval supported for efficiency
- Failed payouts can be retried manually
- Approval history logged for audit trail

### Trusted Contact (Optional)
- All fields are optional
- Email must be valid format if provided
- Phone must be valid US 10-digit format if provided
- Relationship must be one of: spouse, parent, sibling, child, friend, attorney, financial_advisor, other

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

-- Activity queries
CREATE INDEX idx_activity_user ON activity(user_id, date DESC);
CREATE INDEX idx_activity_investment ON activity(investment_id, date DESC);
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

## Admin Interface Requirements

### Admin Dashboard

**Navigation Tabs:**
- Dashboard - Overview metrics and action items
- Accounts - User account management
- **Transactions** - Investment management (renamed from "Investments")
- Withdrawals - Withdrawal request management
- Pending Payouts - Monthly payout failure management
- Time Machine - Testing and time manipulation

**Dashboard Metrics:**
The admin dashboard shows:
- Active Accounts count
- Number of Investors
- Total Pending capital
- Total Amount Raised
- Total AUM (Assets Under Management)
- Monthly Inflows
- Action Required section with pending items

**Dashboard Panels:**
- Primary Metrics (4 cards: Total AUM, Total Accounts, Active Investments, Monthly Inflows)
- Action Required (shows only when there are pending items)
  - Pending Approvals (links to Transactions tab)
  - Pending Withdrawals
  - Pending Payouts
  - Unverified Accounts
- Overview (statistics grid)
- Distribution (Account Types and Lockup Periods)
- Recent Activity - Latest Investments only (Recent Sign-ups panel removed)

### Transactions Tab (formerly Investments)

**Purpose:** Manage all investment transactions across all users

**Features:**
- Search by investment ID, account ID, name, email, or status
- No summary metrics displayed at top (removed for cleaner view)
- Card-based layout showing each investment with:
  - Investment ID and Account ID
  - Status badge (Active, Pending, Rejected, etc.)
  - Account type badge (Individual, Joint, Entity, or IRA)
  - User information
  - Amount, Lockup period, Payment frequency
  - Created date
  - Action buttons: Approve, Reject, View Account

**Account Type Badges:**
All account types are visually distinguished with color-coded badges:
- **Individual** - Purple badge (`#f3e8ff` background, `#6b21a8` text)
- **Joint** - Blue badge (`#dbeafe` background, `#1e40af` text)
- **Entity** - Amber badge (`#fef3c7` background, `#92400e` text)
- **IRA** - Green badge (`#dcfce7` background, `#166534` text)

These badges appear in both the Transactions and Accounts tabs for consistency.

**Status Pills:**
Investment status badges must be properly centered (using flexbox: `display: flex`, `align-items: center`, `justify-content: center`)

**Button States:**
- Approve button: Disabled when status is `active`, `withdrawn`, or `rejected`
- Reject button: Disabled when status is `rejected`, `active`, or `withdrawn`
- **CRITICAL:** Active investments cannot be rejected (enforced in both frontend and backend)

### User Account Details Page

**Route:** `/admin/users/[id]`

**Purpose:** View and edit comprehensive user account information

**Design Features:**
- Uses `AdminHeader` component (highlights "Accounts" tab)
- Breadcrumb navigation: `← Accounts / Account #[id]`
- Consistent design with admin dashboard (card-based layout, modern styling)
- Fully responsive across all devices

**Page Sections:**
1. **Breadcrumb Navigation**
   - Back link to Accounts tab
   - Current location indicator

2. **Page Header**
   - Account title and details
   - User name and email subtitle

3. **Metrics Cards**
   - Total Investments count
   - Pending Amount
   - Approved Amount

4. **Account Profile Card**
   - Account type, verification status
   - Verify Account button (if unverified)
   - Editable user information (name, email, phone, DOB, SSN, address)
   - Save Changes button

5. **Joint Holder Card** (if joint account)
   - Complete joint holder information
   - Separate save button

6. **Investments List**
   - Expandable cards for each investment
   - View Details button linking to investment detail page
   - All investment metadata displayed

**Navigation:**
- Breadcrumb "← Accounts" returns to `/admin?tab=accounts`
- Investment "View Details" links to `/admin/investments/[id]`

### Investment Details Page

**Route:** `/admin/investments/[id]`

**Purpose:** View and edit individual investment details

**Design Features:**
- Uses `AdminHeader` component (highlights "Transactions" tab)
- Breadcrumb navigation: `← Transactions / Investment #[id]`
- Consistent design with admin dashboard
- Status badge with color-coded visual indicator

**Page Sections:**
1. **Breadcrumb Navigation**
   - Back link to Transactions tab
   - Current investment identifier

2. **Page Header**
   - Investment title
   - Account link (clickable, navigates to user account page)
   - Status badge with contextual color
   - View Account button

3. **Metrics Cards**
   - Investment Amount
   - Created Date
   - Submitted Date
   - Confirmed Date (if applicable)

4. **Investment Details Card**
   - Editable fields: Amount, Status, Payment Frequency, Lockup Period, Account Type
   - Save Changes button

5. **Additional Information Cards** (conditionally displayed)
   - Dates & Timeline (if lockup end date exists)
   - Banking Information (if banking data exists)
   - Personal Information (if personal info exists)
   - Address (if address exists)

**Navigation:**
- Breadcrumb "← Transactions" returns to `/admin?tab=transactions`
- "View Account" button navigates to `/admin/users/[userId]`
- Account link in subtitle navigates to user account page

### Accounts Tab

**Purpose:** Manage user accounts

**Features:**
- Search by name or email
- Card-based layout with user information
- Account type badges for all types (Individual, Joint, Entity, IRA)
- Verified badge (green checkmark)
- Statistics: number of investments, total invested, created date
- Delete account button (with confirmation)
- Click card to view detailed account information

### Design Consistency

**All admin pages share:**
- `AdminHeader` navigation component
- Breadcrumb trails for context and easy navigation back
- Card-based, modern UI with consistent spacing and typography
- Hover effects on interactive elements
- Responsive design that works on all screen sizes
- CSS variables for consistent theming:
  - `--color-app-bg` - Page background
  - `--color-surface` - Card backgrounds
  - `--color-border` - Border colors
  - `--color-accent` - Primary text
  - `--color-info` - Links and primary actions
  - `--color-success` - Success states
  - `--color-danger` - Danger/delete actions

**Navigation Flow:**
```
Admin Dashboard
├── Accounts Tab → User Details → Investment Details
├── Transactions Tab → Investment Details → User Details
├── Operations Tab
└── Dashboard Tab
```

### User Profile - Trusted Contact

**Location:** User profile page, between Primary Holder and Joint Holder sections

**Purpose:** Emergency contact information for situations where the investor cannot be reached

**Fields (all optional):**
- First Name
- Last Name
- Relationship (dropdown: Spouse, Parent, Sibling, Child, Friend, Attorney, Financial Advisor, Other)
- Email (validated format if provided)
- Phone (US format validation if provided)

**Validation Rules:**
- All fields are optional
- Email must be valid format if provided
- Phone must be valid US 10-digit number if provided
- No fields are required, allowing partial information

**Save Functionality:**
- Primary Holder section has its own "Save Changes" button at the bottom
- Allows investors to save personal information without scrolling to page bottom
- Shows "Saving..." state during save operation
- Displays "Saved!" success message after completion

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

**Authentication Flow:**
```
Sign Up → Unverified Account → Sign In → Verification Required → Verified → Can Invest

Alternative: Password Reset → Auto-Verified
```

**Investment States:**
```
draft → pending → active → withdrawal_notice → withdrawn
                    ↓
                 rejected
```

**Key Points:**
1. **Authentication:** Unverified users can sign in but must verify before investing
2. **Password Reset:** Automatically verifies account (proves email ownership)
3. **Dual Approval (Phase 1):** Bank auto-approved, admin approval required for activation
4. **Dual Approval (Phase 2):** Both bank AND admin approval required (future with banking integration)
5. **Payout Approval:** All monthly payouts require admin approval before sending
6. Investment states: `draft`, `pending`, `active`, `withdrawal_notice`, `withdrawn`, `rejected`
7. Interest calculations are **daily-prorated** for partial months
8. Monthly payouts start as `pending_approval`, not auto-sent
9. Withdrawals: **Robert Ventures has 90 days** to process (not user waiting period)
10. Investments earn interest while in `withdrawal_notice` status (if compounding)
11. **Withdrawn investments remain visible** to users in dashboard (for records)
12. Admin can **time travel** for testing
13. All calculations must use **app time** (not real time)

**Critical Fields:**
- `confirmedAt` - When investment became active (interest starts next day)
- `lockupEndDate` - Earliest possible withdrawal date
- `payoutDueBy` - Deadline for Robert Ventures to complete payout (request + 90 days)
- `finalValue` - Total amount paid out (principal + interest) when withdrawn

**Data to preserve:**
- User accounts and profiles (including verification status)
- Email verification and password reset tokens
- Investments and their complete status history
- All activity events (never delete)
- Withdrawal requests and processing
- Bank connection status

**Integration:**
- Frontend expects same JSON response structure
- API endpoints must match exactly
- Business rules must be identical
- Calculations must match to the penny

Need clarification? Check the existing Next.js API routes in `/app/api/` for reference implementation.
