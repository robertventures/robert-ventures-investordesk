# HIGH PRIORITY ISSUES

## Overview
These issues can cause significant problems, data loss, or poor user experience. They should be addressed before production deployment.

---

## BACKEND HIGH PRIORITY ISSUES

### 🟠 HIGH-01: Insufficient Input Validation on Bank Connection
**Location**: [app/api/admin/bank-connection/route.js:46-53](../app/api/admin/bank-connection/route.js)
**Category**: Data Integrity
**Severity**: HIGH

#### Description
When `bankId` is not provided, the code updates ALL bank accounts without explicit confirmation.

#### Current Code
```javascript
if (Array.isArray(user.bankAccounts) && bankId) {
  // Update specific bank
} else {
  // Updates ALL investment banks if bankId is missing
  user.investments.forEach((inv, invIndex) => {
    if (inv.banking?.bank && (!bankId || inv.banking.bank.id === bankId)) {
      // When bankId is undefined, this updates ALL banks
    }
  })
}
```

#### Impact
- Bulk updates without explicit user intent
- All bank connections marked as disconnected accidentally
- Admin confusion - intended to update one bank, updated all
- Data integrity issues

#### Steps to Reproduce
1. Send POST to `/api/admin/bank-connection`
2. Include `userId` and `connectionStatus` but omit `bankId`
3. All investment bank accounts update to same status

#### Recommended Fix
```javascript
// Require bankId for all operations
if (!bankId) {
  return NextResponse.json({
    success: false,
    error: 'bankId is required. To update multiple banks, call the endpoint separately for each bank.'
  }, { status: 400 })
}

// Then proceed with targeted update
const bankAccount = user.bankAccounts?.find(b => b.id === bankId)
if (!bankAccount) {
  return NextResponse.json({
    success: false,
    error: `Bank account ${bankId} not found`
  }, { status: 404 })
}
```

---

### 🟠 HIGH-02: Password Reset Token Exposed in Development Mode
**Location**: [app/api/auth/request-reset/route.js:53-60](../app/api/auth/request-reset/route.js)
**Category**: Security
**Severity**: HIGH

#### Description
Returns the actual reset token in API response when `NODE_ENV=development`. If accidentally enabled in production, tokens are exposed.

#### Current Code
```javascript
return NextResponse.json({
  success: true,
  ...(process.env.NODE_ENV === 'development' && {
    token: resetToken,
    resetUrl: `http://localhost:3000/reset-password?token=${resetToken}`
  })
})
```

#### Impact
- **Security risk**: Tokens exposed if dev mode enabled in production
- **Token interception**: Browser extensions, proxies, logs can capture token
- **Account takeover**: Attacker can reset any user's password
- **Compliance violation**: Exposes sensitive authentication data

#### Attack Scenarios
1. Misconfigured production server with `NODE_ENV=development`
2. Browser logging tools capture token from response
3. Network monitoring tools intercept token
4. Error reporting services log full API responses

#### Steps to Reproduce
1. Set `NODE_ENV=development` in production
2. Request password reset
3. Token appears in API response
4. Attacker intercepts response

#### Recommended Fix
```javascript
// NEVER expose tokens in API responses
return NextResponse.json({ success: true })

// For development testing, log to server console only
if (process.env.NODE_ENV === 'development') {
  console.log('🔐 DEV ONLY - Reset token:', resetToken)
  console.log('🔗 DEV ONLY - Reset URL:', `http://localhost:3000/reset-password?token=${resetToken}`)
}

// Alternative: Save to file in development
if (process.env.NODE_ENV === 'development') {
  const fs = require('fs')
  fs.appendFileSync(
    './dev-tokens.log',
    `${new Date().toISOString()} | ${email} | ${resetToken}\n`
  )
}
```

---

### 🟠 HIGH-03: Orphaned Contributions Crash Transaction Sync
**Location**: [app/api/migrate-transactions/route.js:314-332](../app/api/migrate-transactions/route.js)
**Category**: Data Integrity
**Severity**: HIGH

#### Description
Validation throws error when orphaned contributions are found, but provides no recovery mechanism.

#### Current Code
```javascript
// Validation throws error on orphaned data
for (const tx of inv.transactions) {
  if (tx.type === 'contribution') {
    if (!tx.distributionTxId) {
      throw new Error(`Existing contribution transaction ${tx.id} must have a distributionTxId`)
    }
  }
}
```

#### Impact
- **Application crash** during transaction sync
- **No auto-recovery** mechanism
- **Admin cannot access portfolio** until data manually fixed
- **User-facing errors** with no resolution path

#### Steps to Reproduce
1. Manually create contribution without `distributionTxId` (via bug or data migration)
2. Trigger transaction sync
3. System throws error and crashes
4. User portfolio becomes inaccessible

#### Recommended Fix
```javascript
// Auto-repair orphaned contributions
for (const tx of inv.transactions) {
  if (tx.type === 'contribution') {
    if (!tx.distributionTxId) {
      console.warn(`🔧 Auto-repairing orphaned contribution ${tx.id} for investment ${inv.id}`)

      // Log for audit
      await logAuditEvent({
        type: 'data_repair',
        action: 'removed_orphaned_contribution',
        investmentId: inv.id,
        transactionId: tx.id,
        reason: 'Missing distributionTxId reference'
      })

      // Remove orphaned contribution
      inv.transactions = inv.transactions.filter(t => t.id !== tx.id)
      investmentTouched = true
      continue
    }

    // Validate the reference exists
    const distExists = inv.transactions.some(
      t => t.id === tx.distributionTxId && t.type === 'distribution'
    )

    if (!distExists) {
      console.warn(`🔧 Removing contribution ${tx.id} - referenced distribution not found`)
      inv.transactions = inv.transactions.filter(t => t.id !== tx.id)
      investmentTouched = true
    }
  }
}
```

---

### 🟠 HIGH-04: Time Machine Auto-Approve Race Condition
**Location**: [app/api/migrate-transactions/route.js:496-512](../app/api/migrate-transactions/route.js)
**Category**: Data Consistency
**Severity**: HIGH

#### Description
Auto-approve logic can create inconsistent distribution states when Time Machine settings change or sync runs multiple times.

#### Current Code
```javascript
let status = 'pending'
let autoApproved = false

if (existingTx && existingTx.status && existingTx.status !== 'pending') {
  status = existingTx.status
} else if (legacyEvent) {
  status = mapLegacyPayoutStatus(legacyEvent.payoutStatus)
} else if (!existingTx && autoApproveDistributions) {
  // NEW distribution gets auto-approved
  status = 'approved'
  autoApproved = true
}
```

#### Issue Flow
1. Auto-approve enabled → distributions created as 'approved'
2. Admin manually processes some distributions
3. Auto-approve disabled
4. Sync runs again → previously approved distributions revert to 'pending'
5. Financial reports become incorrect

#### Impact
- Distribution status changes unexpectedly
- Financial calculations become unreliable
- Manually approved distributions revert to pending
- Audit trail inconsistencies

#### Steps to Reproduce
1. Enable auto-approve in Time Machine
2. Run transaction sync (creates approved distributions)
3. Admin manually marks some as completed
4. Disable auto-approve
5. Run sync again
6. Previously approved distributions show as pending

#### Recommended Fix
```javascript
let status = 'pending'
let autoApproved = false

// Preserve manually processed status
if (existingTx && existingTx.status) {
  // If manually completed, preserve that status always
  if (existingTx.manuallyCompleted || existingTx.status === 'completed') {
    status = existingTx.status
    autoApproved = false
  }
  // If previously approved (auto or manual), preserve
  else if (existingTx.status === 'approved') {
    status = 'approved'
    autoApproved = existingTx.autoApproved || false
  }
  // Otherwise keep existing status
  else {
    status = existingTx.status
  }
} else if (legacyEvent) {
  status = mapLegacyPayoutStatus(legacyEvent.payoutStatus)
} else if (!existingTx && autoApproveDistributions) {
  // Only auto-approve truly NEW distributions
  status = 'approved'
  autoApproved = true
}

// Add flag to track manual processing
const manuallyCompleted = existingTx?.manuallyCompleted || false
```

**Update Approval Endpoint:**
```javascript
// When admin manually approves
distribution.status = 'approved'
distribution.manuallyCompleted = true
distribution.approvedBy = admin.userId
distribution.approvedAt = new Date().toISOString()
```

---

### 🟠 HIGH-05: Missing Null Checks in Pending Payouts
**Location**: [app/api/admin/pending-payouts/route.js:28-49](../app/api/admin/pending-payouts/route.js)
**Category**: Runtime Error
**Severity**: HIGH

#### Description
Potential null/undefined access on transaction properties can crash pending payouts endpoint.

#### Current Code
```javascript
investments.forEach(investment => {
  if (!investment || !Array.isArray(investment.transactions)) return

  investment.transactions.forEach(tx => {
    if (tx.type !== 'distribution') return
    const scheduledDateMs = new Date(tx.date || 0).getTime()  // Fallback to epoch 0
  })
})
```

#### Issues
- `tx.date` might be null/undefined → creates date as epoch 0 (1970-01-01)
- `tx` properties not validated
- Malformed transactions cause incorrect pending payout calculations

#### Impact
- Runtime errors if transaction data malformed
- Pending payouts list becomes inaccessible
- Admin cannot approve distributions
- Incorrect payout calculations

#### Steps to Reproduce
1. Create transaction with null date field
2. Access `/api/admin/pending-payouts`
3. Transaction with null date shows as scheduled for 1970
4. Sorts incorrectly, appears at top of list

#### Recommended Fix
```javascript
investments.forEach(investment => {
  if (!investment || !Array.isArray(investment.transactions)) return

  investment.transactions.forEach(tx => {
    // Comprehensive validation
    if (!tx || !tx.type || !tx.date || !tx.id) {
      console.warn(`Skipping malformed transaction in investment ${investment.id}:`, tx)
      return
    }

    if (tx.type !== 'distribution') return

    // Validate date before parsing
    const parsedDate = new Date(tx.date)
    if (isNaN(parsedDate.getTime())) {
      console.warn(`Invalid date for transaction ${tx.id}: ${tx.date}`)
      return
    }

    const scheduledDateMs = parsedDate.getTime()
    const isPast = scheduledDateMs <= now

    // Validate required fields
    if (typeof tx.amount !== 'number' || tx.amount <= 0) {
      console.warn(`Invalid amount for transaction ${tx.id}`)
      return
    }

    // Continue with valid transaction
    // ...
  })
})
```

---

## FRONTEND HIGH PRIORITY ISSUES

### 🟠 HIGH-06: Missing useEffect Cleanup in TransactionsList
**Location**: [app/components/TransactionsList.js:56-93](../app/components/TransactionsList.js)
**Category**: Memory Leak
**Severity**: HIGH

#### Description
Async operations in useEffect don't check if component is still mounted before calling setState.

#### Current Code
```javascript
useEffect(() => {
  async function loadData() {
    const response = await fetch('/api/data')
    const data = await response.json()
    setState(data) // Component might be unmounted
  }
  loadData()
}, [])
```

#### Impact
- React warning: "Can't perform a React state update on an unmounted component"
- Memory leaks
- Unnecessary API calls continue after navigation
- Console spam

#### Steps to Reproduce
1. Navigate to Activity tab (loads TransactionsList)
2. Quickly navigate to different page before data loads
3. Console shows unmounted component warning
4. setState called on unmounted component

#### Recommended Fix
```javascript
useEffect(() => {
  let isMounted = true
  const abortController = new AbortController()

  async function loadData() {
    try {
      const response = await fetch('/api/data', {
        signal: abortController.signal
      })
      const data = await response.json()

      // Only update state if component still mounted
      if (isMounted) {
        setState(data)
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled')
        return
      }
      if (isMounted) {
        setError(error)
      }
    }
  }

  loadData()

  return () => {
    isMounted = false
    abortController.abort()
  }
}, [])
```

---

### 🟠 HIGH-07: Infinite Loop Risk in Investment Page
**Location**: [app/investment/page.js:167-171](../app/investment/page.js)
**Category**: Infinite Loop
**Severity**: HIGH

#### Description
useEffect modifies state that's in its dependency array, creating risk of infinite renders.

#### Current Code
```javascript
useEffect(() => {
  if (selectedAccountType === 'ira' && investmentPaymentFrequency === 'monthly') {
    setInvestmentPaymentFrequency('compounding')
    // This triggers useEffect again because investmentPaymentFrequency changed
  }
}, [selectedAccountType, investmentPaymentFrequency])
```

#### Problem
1. User selects IRA + monthly
2. Effect runs, sets frequency to 'compounding'
3. Frequency change triggers effect again
4. Effect checks condition again (now false, but effect already ran)
5. In some cases, this can loop

#### Impact
- Browser freeze/crash
- React dev tools shows thousands of renders
- Poor performance
- Battery drain on mobile

#### Steps to Reproduce
1. Select "IRA" account type
2. Select "Monthly" payment frequency
3. Watch React DevTools - multiple renders
4. In some browsers, page freezes

#### Recommended Fix
```javascript
// Option 1: Use ref to track programmatic changes
const programmaticChange = useRef(false)

useEffect(() => {
  if (selectedAccountType === 'ira' && investmentPaymentFrequency === 'monthly') {
    programmaticChange.current = true
    setInvestmentPaymentFrequency('compounding')
  }
}, [selectedAccountType])

// Option 2: Remove frequency from dependencies
useEffect(() => {
  if (selectedAccountType === 'ira' && investmentPaymentFrequency === 'monthly') {
    setInvestmentPaymentFrequency('compounding')
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedAccountType]) // Only run when account type changes

// Option 3: Validate in handler instead
const handleFrequencyChange = (freq) => {
  if (selectedAccountType === 'ira' && freq === 'monthly') {
    alert('IRA accounts cannot use monthly payments')
    return
  }
  setInvestmentPaymentFrequency(freq)
}
```

---

### 🟠 HIGH-08: Missing Validation on Admin Page
**Location**: [app/admin/page.js:153, 189](../app/admin/page.js)
**Category**: Runtime Error
**Severity**: HIGH

#### Description
Direct access to `timeMachineData.appTime` without null check in filter logic.

#### Current Code
```javascript
const calculation = calculateInvestmentValue(inv, timeMachineData.appTime)
```

#### Impact
- Runtime error if timeMachineData not loaded
- Admin page crashes
- Cannot access critical admin functions
- Error: "Cannot read property 'appTime' of undefined"

#### Steps to Reproduce
1. Clear cache
2. Load admin page with slow network (throttle to Slow 3G)
3. Time Machine data loads slowly
4. Meanwhile, investment calculation attempts to run
5. Crashes with null reference error

#### Recommended Fix
```javascript
// Add null check with fallback
const currentTime = timeMachineData?.appTime || new Date().toISOString()
const calculation = calculateInvestmentValue(inv, currentTime)

// Or wait for data to load
if (!timeMachineData) {
  return <div>Loading admin data...</div>
}

const calculation = calculateInvestmentValue(inv, timeMachineData.appTime)
```

---

### 🟠 HIGH-09: Form Validation Bypass
**Location**: [app/components/InvestmentForm.js:172-188](../app/components/InvestmentForm.js)
**Category**: Data Validation
**Severity**: HIGH

#### Description
Validation function returns early but doesn't prevent form submission. Fast clicking can bypass validation.

#### Current Code
```javascript
const validate = () => {
  if (amount < minAmount) {
    setError('Amount too low')
    return false
  }
  return true
}

const handleSubmit = async () => {
  if (!validate()) return // Check, but not atomic

  // API call happens here
  await submitForm()
}
```

#### Problem
Between validation check and API call, user can trigger submit multiple times.

#### Impact
- Invalid data submitted to API
- Multiple submissions
- Backend validation rejects data
- Poor user experience

#### Steps to Reproduce
1. Enter amount below minimum ($1000)
2. Click submit button rapidly 3-4 times
3. Validation runs but submission still occurs
4. Backend rejects invalid data

#### Recommended Fix
```javascript
const [isSubmitting, setIsSubmitting] = useState(false)

const handleSubmit = async () => {
  // Prevent multiple submissions
  if (isSubmitting) return

  // Validate before anything else
  if (!validate()) {
    return
  }

  setIsSubmitting(true)
  setError(null)

  try {
    await submitForm()
  } catch (error) {
    setError(error.message)
  } finally {
    setIsSubmitting(false)
  }
}

// In JSX
<button
  onClick={handleSubmit}
  disabled={isSubmitting || !isValid}
>
  {isSubmitting ? 'Submitting...' : 'Submit Investment'}
</button>
```

---

### 🟠 HIGH-10: Unhandled API Errors Multiple Components
**Location**: [app/components/ProfileView.js:449](../app/components/ProfileView.js), [app/components/PersonalDetailsForm.js:97](../app/components/PersonalDetailsForm.js)
**Category**: Error Handling
**Severity**: HIGH

#### Description
Fetch calls don't check `response.ok` before parsing JSON, causing crashes on error responses.

#### Current Code
```javascript
const res = await fetch(`/api/users/${userId}`, {
  method: 'PUT',
  body: JSON.stringify(data)
})
const data = await res.json() // Crashes if res.status is 4xx or 5xx
```

#### Impact
- JSON parse errors on error responses
- Error messages not displayed to user
- Form appears frozen
- Console shows cryptic parse errors instead of actual API error

#### Steps to Reproduce
1. Submit form with invalid data (trigger 400 error)
2. API returns `{ success: false, error: "message" }` with 400 status
3. Code tries to parse as successful response
4. UI shows no error message
5. Console shows JSON parse error

#### Recommended Fix
```javascript
const res = await fetch(`/api/users/${userId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})

// Check response status BEFORE parsing
if (!res.ok) {
  const error = await res.json().catch(() => ({
    error: 'Request failed'
  }))
  throw new Error(error.error || `Request failed with status ${res.status}`)
}

const data = await res.json()

// Handle success
if (data.success) {
  // Update UI
} else {
  throw new Error(data.error || 'Unknown error')
}
```

**Create Reusable Fetch Wrapper:**
```javascript
// lib/api.js
export async function apiRequest(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${res.status}`)
    }

    const data = await res.json()

    if (!data.success) {
      throw new Error(data.error || 'Request failed')
    }

    return data
  } catch (error) {
    console.error('API Request failed:', error)
    throw error
  }
}

// Usage in components
import { apiRequest } from '@/lib/api'

const data = await apiRequest(`/api/users/${userId}`, {
  method: 'PUT',
  body: JSON.stringify(formData)
})
```

---

### 🟠 HIGH-11: TabbedResidentialIdentity Dependency Loop
**Location**: [app/components/TabbedResidentialIdentity.js:230-245](../app/components/TabbedResidentialIdentity.js)
**Category**: Infinite Loop
**Severity**: HIGH

#### Description
useEffect with dependencies on form fields that it also updates, creating potential infinite loop.

#### Current Code
```javascript
useEffect(() => {
  if (accountType !== 'joint') return
  if (!jointUsePrimaryAddress) return

  setForm(prev => ({
    ...prev,
    jointHolder: {
      ...prev.jointHolder,
      street1: prev.street1,
      street2: prev.street2,
      city: prev.city,
      state: prev.state,
      zipCode: prev.zipCode
    }
  }))
}, [
  accountType,
  jointUsePrimaryAddress,
  form.street1,  // BAD: Effect updates form which triggers effect again
  form.street2,
  form.city,
  form.state,
  form.zipCode
])
```

#### Impact
- Infinite re-renders when editing address
- Browser freeze
- React warning about too many re-renders
- Form becomes unusable

#### Steps to Reproduce
1. Select "Joint" account type
2. Check "Use same address for joint holder"
3. Start typing in street1 field
4. Browser freezes or React shows "Too many re-renders" error

#### Recommended Fix
```javascript
// Use callback pattern instead
const handleAddressFieldChange = (field, value) => {
  setForm(prev => {
    const updated = {
      ...prev,
      [field]: value
    }

    // If joint account with shared address, sync to joint holder
    if (accountType === 'joint' && jointUsePrimaryAddress) {
      updated.jointHolder = {
        ...prev.jointHolder,
        [field]: value
      }
    }

    return updated
  })
}

// Remove the problematic useEffect entirely
```

---

## Summary

**Total High Priority Issues**: 11
- **Backend**: 5 issues
  - Data integrity: 2
  - Security: 1
  - Error handling: 2
- **Frontend**: 6 issues
  - Memory leaks: 1
  - Infinite loops: 2
  - Error handling: 2
  - Data validation: 1

**Recommended Action Timeline:**
- **Week 1**: Fix HIGH-01, HIGH-02 (security/data)
- **Week 2**: Fix HIGH-06, HIGH-07, HIGH-09 (frontend critical)
- **Week 3**: Fix HIGH-03, HIGH-04, HIGH-05 (backend stability)
- **Week 4**: Fix HIGH-08, HIGH-10, HIGH-11 (remaining issues)

All high priority issues should be resolved before production launch.
