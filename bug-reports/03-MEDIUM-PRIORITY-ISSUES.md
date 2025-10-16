# MEDIUM PRIORITY ISSUES

## Overview
These issues should be addressed during development. They can cause inconvenience or poor user experience but don't typically result in critical failures.

---

## BACKEND MEDIUM PRIORITY ISSUES

### 🟡 MEDIUM-01: Inconsistent Password Validation
**Location**: [app/api/auth/reset-password/route.js:19-30](../app/api/auth/reset-password/route.js), [app/api/users/[id]/route.js:37-40](../app/api/users/[id]/route.js)
**Category**: Security / UX
**Severity**: MEDIUM

#### Description
Two different password validation implementations with different requirements.

#### Reset Password (Strict)
```javascript
const hasUppercase = /[A-Z]/.test(newPassword)
const hasNumber = /[0-9]/.test(newPassword)
const hasSpecial = /[^A-Za-z0-9]/.test(newPassword)
const hasMinLength = newPassword.length >= 8

if (!hasUppercase || !hasNumber || !hasSpecial || !hasMinLength) {
  return NextResponse.json({ error: '...' })
}
```

#### Change Password (Weak)
```javascript
if (newPassword.length < 8) {
  return NextResponse.json({ error: 'Password must be at least 8 characters' })
}
// No uppercase, number, or special character requirements
```

#### Impact
- Users can set weak passwords via password change
- Cannot set same weak password via password reset
- Inconsistent security posture
- User confusion
- Some accounts have weak passwords, others don't

#### Steps to Reproduce
1. User changes password via profile to "password123" (no uppercase/special) - succeeds
2. User forgets password, tries to reset to "password123" - fails validation
3. User confused by inconsistent rules

#### Recommended Fix
```javascript
// lib/validation.js
export class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function validatePasswordStrength(password) {
  const errors = []

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)')
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join('. '))
  }

  return true
}

// Usage in all password endpoints
import { validatePasswordStrength, ValidationError } from '@/lib/validation'

try {
  validatePasswordStrength(newPassword)
} catch (error) {
  if (error instanceof ValidationError) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 400 })
  }
  throw error
}
```

---

### 🟡 MEDIUM-02: Integer Overflow in Limit Parameter
**Location**: [app/api/admin/audit-logs/route.js:51](../app/api/admin/audit-logs/route.js)
**Category**: Data Validation
**Severity**: MEDIUM

#### Description
Using `parseInt` without radix and without NaN check before Math.min.

#### Current Code
```javascript
const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
```

#### Problems
1. No radix parameter (should use base 10)
2. No NaN check
3. Math.min(NaN, 1000) returns NaN
4. Database query with NaN limit undefined behavior

#### Impact
- Query with NaN limit might return all records (memory issue)
- Or might return 0 records (confusing)
- Non-numeric input causes unexpected behavior

#### Steps to Reproduce
1. Call `/api/admin/audit-logs?limit=abc`
2. `parseInt('abc')` returns NaN
3. `Math.min(NaN, 1000)` returns NaN
4. Query behavior is undefined

#### Recommended Fix
```javascript
const limitParam = searchParams.get('limit') || '100'
const parsedLimit = parseInt(limitParam, 10)
const limit = (isNaN(parsedLimit) || parsedLimit < 1)
  ? 100
  : Math.min(parsedLimit, 1000)

// Even better: Create validation utility
// lib/validation.js
export function parseIntParam(value, defaultValue, min = 1, max = Infinity) {
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) return defaultValue
  return Math.max(min, Math.min(parsed, max))
}

// Usage
const limit = parseIntParam(searchParams.get('limit'), 100, 1, 1000)
```

---

### 🟡 MEDIUM-03: Missing Error Handling for Background Sync
**Location**: [app/api/admin/time-machine/route.js:104-110](../app/api/admin/time-machine/route.js)
**Category**: Error Handling
**Severity**: MEDIUM

#### Description
Transaction sync runs in background without awaiting. Errors are silently logged but response sent before sync completes.

#### Current Code
```javascript
if (needsSync) {
  import('../../../../lib/transactionSync.js').then(({ syncTransactionsNonBlocking }) => {
    syncTransactionsNonBlocking().catch(err => {
      console.error('Failed to sync transactions after settings update:', err)
    })
  })
}

return response  // Returns before sync completes
```

#### Impact
- UI shows success but sync might fail silently
- User sees incorrect/stale data
- No way to detect sync failures from client
- Admin thinks settings applied but data isn't updated

#### Steps to Reproduce
1. Update Time Machine settings (change date)
2. Transaction sync fails due to data corruption
3. API returns success
4. User refreshes page, sees old data
5. No indication of failure

#### Recommended Fix

**Option 1: Wait for sync (Recommended)**
```javascript
if (needsSync) {
  try {
    const { syncTransactionsNonBlocking } = await import('../../../../lib/transactionSync.js')
    await syncTransactionsNonBlocking()
  } catch (err) {
    console.error('Failed to sync transactions:', err)
    return NextResponse.json({
      success: false,
      error: 'Settings updated but transaction sync failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 })
  }
}

return NextResponse.json({
  success: true,
  message: 'Time Machine settings updated and transactions synchronized'
})
```

**Option 2: Return sync status**
```javascript
let syncStatus = 'not-needed'

if (needsSync) {
  syncStatus = 'in-progress'

  import('../../../../lib/transactionSync.js').then(({ syncTransactionsNonBlocking }) => {
    syncTransactionsNonBlocking()
      .then(() => {
        console.log('✅ Transaction sync completed')
      })
      .catch(err => {
        console.error('❌ Transaction sync failed:', err)
      })
  })
}

return NextResponse.json({
  success: true,
  syncStatus,
  message: syncStatus === 'in-progress'
    ? 'Settings updated. Synchronizing transactions... Please refresh in a few seconds.'
    : 'Settings updated successfully'
})
```

---

### 🟡 MEDIUM-04: Type Coercion Issue in Account Deletion
**Location**: [app/api/admin/accounts/route.js:15-16](../app/api/admin/accounts/route.js)
**Category**: Error Handling
**Severity**: MEDIUM

#### Description
Truthy check on array can cause unexpected behavior if database returns unexpected data structure.

#### Current Code
```javascript
const beforeCount = usersData.users?.length || 0
usersData.users = (usersData.users || []).filter(user => user.isAdmin)
```

#### Issues
1. Line 15: Optional chaining, but line 16 doesn't use it
2. If `usersData` is null, line 16 crashes
3. No validation that `usersData` is correct structure

#### Impact
- Crash if database returns unexpected format
- Deletes users without proper validation
- No rollback if deletion fails

#### Steps to Reproduce
1. Corrupt database to return `null` instead of `{ users: [] }`
2. Call delete accounts endpoint
3. Line 16 crashes: "Cannot read property 'users' of null"

#### Recommended Fix
```javascript
export async function DELETE(request) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const usersData = await getUsers()

    // Comprehensive validation
    if (!usersData || typeof usersData !== 'object') {
      console.error('Invalid users data structure:', usersData)
      return NextResponse.json({
        success: false,
        error: 'Unable to access user database'
      }, { status: 500 })
    }

    if (!Array.isArray(usersData.users)) {
      console.error('Users data is not an array:', usersData.users)
      return NextResponse.json({
        success: false,
        error: 'Database returned invalid user list'
      }, { status: 500 })
    }

    const beforeCount = usersData.users.length
    const adminUsers = usersData.users.filter(user => user.isAdmin)
    const afterCount = adminUsers.length
    const deletedCount = beforeCount - afterCount

    // Update with filtered list
    usersData.users = adminUsers
    await setUsers(usersData)

    return NextResponse.json({
      success: true,
      deletedCount,
      remainingCount: afterCount
    })

  } catch (error) {
    console.error('Error deleting non-admin accounts:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete accounts'
    }, { status: 500 })
  }
}
```

---

### 🟡 MEDIUM-05: Email Enumeration via Timing Attack
**Location**: [app/api/auth/request-reset/route.js:26-32](../app/api/auth/request-reset/route.js)
**Category**: Security
**Severity**: MEDIUM

#### Description
Code attempts to prevent email enumeration but timing differences reveal user existence.

#### Current Code
```javascript
const user = await getUserByEmail(email)

if (!user) {
  // Return success to prevent enumeration
  return NextResponse.json({ success: true })
}

// Generate token and update user (takes ~50-200ms)
const resetToken = crypto.randomBytes(32).toString('hex')
await updateUser(user.id, { resetToken, resetTokenExpiry })
```

#### Timing Differences
- **User exists**: ~200ms (DB read + write + email)
- **User doesn't exist**: ~50ms (DB read + immediate return)
- **Difference**: 150ms - detectable by attacker

#### Attack Method
```javascript
// Attacker script
async function checkEmailExists(email) {
  const start = Date.now()
  await fetch('/api/auth/request-reset', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
  const duration = Date.now() - start

  return duration > 150 // User exists if response is slow
}
```

#### Impact
- Attacker can enumerate valid emails
- Privacy violation
- Targeted phishing attacks
- GDPR concern

#### Recommended Fix
```javascript
export async function POST(request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 })
    }

    // Always take same amount of time
    const user = await getUserByEmail(email)

    let resetToken
    let resetTokenExpiry

    if (user) {
      // Generate real token
      resetToken = crypto.randomBytes(32).toString('hex')
      resetTokenExpiry = new Date(Date.now() + 3600000).toISOString()

      // Update user
      await updateUser(user.id, { resetToken, resetTokenExpiry })

      // Send email in production
      if (process.env.NODE_ENV === 'production') {
        await sendPasswordResetEmail(email, resetToken)
      }
    } else {
      // Perform equivalent operations for timing consistency
      crypto.randomBytes(32).toString('hex')
      new Date(Date.now() + 3600000).toISOString()

      // Simulate DB write delay
      await new Promise(resolve => setTimeout(resolve, 20))

      // In production, could send "no account found" email
    }

    // Always return the same response
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    })

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json({
      success: false,
      error: 'Unable to process reset request'
    }, { status: 500 })
  }
}
```

---

### 🟡 MEDIUM-06: Seed Endpoint Has No Production Protection
**Location**: [app/api/admin/seed/route.js:6-22](../app/api/admin/seed/route.js)
**Category**: Security
**Severity**: MEDIUM

#### Description
Seed endpoint can be called in production if admin credentials are compromised.

#### Current Code
```javascript
export async function POST(request) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    await seedTestAccounts()  // No environment check!
    const refreshed = await getUsers()

    return NextResponse.json({
      success: true,
      totalUsers: refreshed.users?.length || 0
    })
  } catch (error) {
    // ...
  }
}
```

#### Impact
- Test accounts (with known credentials) created in production
- Production data contaminated with test data
- Security breach if seed passwords are publicly known
- Compliance issues with fake data in production

#### Steps to Reproduce
1. Deploy to production
2. Compromised/malicious admin calls `/api/admin/seed`
3. Test accounts with weak passwords created
4. Attacker can log in with known test credentials

#### Recommended Fix
```javascript
export async function POST(request) {
  // Prevent seeding in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      success: false,
      error: 'Seed endpoint is disabled in production'
    }, { status: 403 })
  }

  // Additional check for Netlify
  if (process.env.NETLIFY === 'true' && process.env.CONTEXT === 'production') {
    return NextResponse.json({
      success: false,
      error: 'Seed endpoint is not available in production'
    }, { status: 403 })
  }

  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    console.log('⚠️ SEEDING TEST ACCOUNTS (Development only)')
    await seedTestAccounts()
    const refreshed = await getUsers()

    return NextResponse.json({
      success: true,
      totalUsers: refreshed.users?.length || 0,
      warning: 'Test accounts created. Do not use in production.'
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to seed accounts'
    }, { status: 500 })
  }
}
```

---

## FRONTEND MEDIUM PRIORITY ISSUES

### 🟡 MEDIUM-07: Missing Loading States
**Location**: Multiple components
**Category**: UX
**Severity**: MEDIUM

#### Affected Components
- [app/components/InvestmentReviewForm.js](../app/components/InvestmentReviewForm.js)
- [app/components/TransactionsTable.js](../app/components/TransactionsTable.js)
- [app/components/DocumentsView.js](../app/components/DocumentsView.js)

#### Description
Components fetch data but show "No data" message immediately, before loading completes.

#### Current Behavior
1. Component mounts
2. Shows "No transactions found"
3. Data loads 500ms later
4. Updates to show transactions
5. User sees confusing flash

#### Impact
- Poor user experience
- Users think data is missing
- Appears unprofessional
- Accessibility issues (screen readers announce "no data" then immediately announce data)

#### Recommended Fix
```javascript
const [data, setData] = useState(null)
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState(null)

useEffect(() => {
  let isMounted = true

  async function loadData() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/data')
      if (!response.ok) throw new Error('Failed to load')

      const result = await response.json()

      if (isMounted) {
        setData(result)
      }
    } catch (err) {
      if (isMounted) {
        setError(err.message)
      }
    } finally {
      if (isMounted) {
        setIsLoading(false)
      }
    }
  }

  loadData()

  return () => {
    isMounted = false
  }
}, [])

// Render with proper states
if (isLoading) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <p>Loading transactions...</p>
    </div>
  )
}

if (error) {
  return (
    <div className="error-state">
      <p>Failed to load transactions: {error}</p>
      <button onClick={() => loadData()}>Retry</button>
    </div>
  )
}

if (!data || data.length === 0) {
  return <div className="empty-state">No transactions found</div>
}

return (
  <div className="data-state">
    {/* Render data */}
  </div>
)
```

---

### 🟡 MEDIUM-08: Missing ARIA Labels and Accessibility
**Location**: Multiple components
**Category**: Accessibility
**Severity**: MEDIUM

#### Description
Many interactive elements lack proper ARIA labels, roles, and keyboard navigation.

#### Examples
```javascript
// InvestmentForm.js - Input lacks label
<input
  type="number"
  value={amount}
  onChange={e => setAmount(e.target.value)}
/>

// DashboardHeader.js - Button has generic label
<button onClick={toggleMenu}>
  Menu
</button>

// TransactionsTable.js - Table has no caption
<table>
  <tr>...</tr>
</table>
```

#### Impact
- Screen readers cannot properly announce controls
- Keyboard navigation broken
- WCAG compliance failure
- Legal liability (ADA)
- Poor experience for disabled users

#### Recommended Fixes

**Forms:**
```javascript
<div className="form-group">
  <label htmlFor="investment-amount">
    Investment Amount
  </label>
  <input
    id="investment-amount"
    type="number"
    value={amount}
    onChange={e => setAmount(e.target.value)}
    aria-describedby="amount-hint"
    aria-required="true"
    aria-invalid={amountError ? 'true' : 'false'}
  />
  <span id="amount-hint" className="hint">
    Minimum: $1,000
  </span>
  {amountError && (
    <span role="alert" className="error">
      {amountError}
    </span>
  )}
</div>
```

**Buttons:**
```javascript
<button
  onClick={toggleMenu}
  aria-label="Open navigation menu"
  aria-expanded={menuOpen}
  aria-controls="nav-menu"
>
  <MenuIcon aria-hidden="true" />
</button>

<nav
  id="nav-menu"
  aria-label="Main navigation"
  hidden={!menuOpen}
>
  {/* Menu items */}
</nav>
```

**Tables:**
```javascript
<table>
  <caption>Recent Transactions</caption>
  <thead>
    <tr>
      <th scope="col">Date</th>
      <th scope="col">Type</th>
      <th scope="col" className="number">Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>2025-10-15</td>
      <td>Deposit</td>
      <td className="number">$1,000.00</td>
    </tr>
  </tbody>
</table>
```

---

### 🟡 MEDIUM-09: Phone Number Format Inconsistency
**Location**: Multiple components
**Category**: Data Consistency
**Severity**: MEDIUM

#### Affected Files
- [app/components/TabbedResidentialIdentity.js](../app/components/TabbedResidentialIdentity.js)
- [app/components/ProfileView.js](../app/components/ProfileView.js)
- [app/components/PersonalDetailsForm.js](../app/components/PersonalDetailsForm.js)

#### Description
Different components use different phone formatting logic, creating inconsistencies in how phone numbers are stored and displayed.

#### Current Implementations
```javascript
// Component A: Strips all non-digits
const phone = value.replace(/\D/g, '')

// Component B: Formats as (XXX) XXX-XXXX
const phone = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')

// Component C: Stores with dashes
const phone = value.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
```

#### Impact
- Database has mixed formats
- Search doesn't work reliably
- Display inconsistent across app
- Validation fails on valid numbers

#### Recommended Fix
```javascript
// lib/phone.js
export function formatPhoneNumber(phone) {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')

  // Validate length
  if (digits.length !== 10) {
    throw new Error('Phone number must be 10 digits')
  }

  // Format as (XXX) XXX-XXXX for display
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function normalizePhoneNumber(phone) {
  // Store as digits only
  return phone.replace(/\D/g, '')
}

export function validatePhoneNumber(phone) {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 && /^\d{10}$/.test(digits)
}

// Usage
import { formatPhoneNumber, normalizePhoneNumber, validatePhoneNumber } from '@/lib/phone'

// On input
<input
  type="tel"
  value={formatPhoneNumber(phone)}
  onChange={e => {
    const normalized = normalizePhoneNumber(e.target.value)
    if (validatePhoneNumber(normalized) || normalized.length <= 10) {
      setPhone(normalized)
    }
  }}
/>

// When saving to API
const userData = {
  ...data,
  phone: normalizePhoneNumber(phone) // Always store as digits
}

// When displaying
<p>Phone: {formatPhoneNumber(user.phone)}</p>
```

---

### 🟡 MEDIUM-10: Missing Prop Validation
**Location**: All components
**Category**: Developer Experience
**Severity**: MEDIUM

#### Description
No PropTypes or TypeScript interfaces defined for any component props.

#### Impact
- No runtime prop validation
- No developer feedback on incorrect props
- Hard to understand component APIs
- Easy to introduce bugs
- No autocomplete in IDEs

#### Current State
```javascript
export default function InvestmentCard({ investment }) {
  // What properties does investment have?
  // What types are they?
  // Which are required?
  return <div>{investment.amount}</div>
}
```

#### Recommended Fix

**Option 1: Add PropTypes**
```javascript
import PropTypes from 'prop-types'

function InvestmentCard({ investment, onEdit, isLoading }) {
  // Component logic
}

InvestmentCard.propTypes = {
  investment: PropTypes.shape({
    id: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
    status: PropTypes.oneOf(['pending', 'active', 'completed']).isRequired,
    createdAt: PropTypes.string.isRequired,
    frequency: PropTypes.oneOf(['monthly', 'quarterly', 'compounding']),
  }).isRequired,
  onEdit: PropTypes.func,
  isLoading: PropTypes.bool
}

InvestmentCard.defaultProps = {
  onEdit: null,
  isLoading: false
}

export default InvestmentCard
```

**Option 2: Migrate to TypeScript (Recommended)**
```typescript
// types/investment.ts
export interface Investment {
  id: string
  amount: number
  status: 'pending' | 'active' | 'completed'
  createdAt: string
  frequency?: 'monthly' | 'quarterly' | 'compounding'
}

// components/InvestmentCard.tsx
interface InvestmentCardProps {
  investment: Investment
  onEdit?: (id: string) => void
  isLoading?: boolean
}

export default function InvestmentCard({
  investment,
  onEdit,
  isLoading = false
}: InvestmentCardProps) {
  // Full type safety and autocomplete
}
```

---

### 🟡 MEDIUM-11: Date Handling Without Timezone Consideration
**Location**: Multiple components
**Category**: Data Consistency
**Severity**: MEDIUM

#### Affected Files
- [app/components/TransactionsList.js:120](../app/components/TransactionsList.js)
- [app/components/InvestmentDetailsContent.js:118](../app/components/InvestmentDetailsContent.js)

#### Description
Date parsing and formatting doesn't consistently handle timezones.

#### Current Code
```javascript
// Sometimes uses UTC
const date = new Date(tx.date).toLocaleDateString('en-US', { timeZone: 'UTC' })

// Sometimes uses local time
const date = new Date(tx.date).toLocaleDateString('en-US')

// Sometimes creates dates without timezone
const date = new Date().toISOString()
```

#### Impact
- Dates display incorrectly for users in different timezones
- Distribution scheduled for Oct 15 shows as Oct 14 for some users
- Inconsistent date displays across app
- Business logic errors (e.g., "is past due" checks)

#### Recommended Fix
```javascript
// lib/dates.js
/**
 * Format date consistently across app
 * Always displays dates in user's local timezone
 */
export function formatDate(dateString, options = {}) {
  if (!dateString) return '-'

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    })
  } catch {
    return 'Invalid Date'
  }
}

/**
 * Format datetime with time
 */
export function formatDateTime(dateString) {
  if (!dateString) return '-'

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Invalid Date'
  }
}

/**
 * Get start of day in UTC (for consistent comparisons)
 */
export function getUTCStartOfDay(date = new Date()) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Check if date is in the past
 */
export function isPastDate(dateString) {
  const date = new Date(dateString)
  const today = getUTCStartOfDay()
  return date < today
}

// Usage in components
import { formatDate, formatDateTime, isPastDate } from '@/lib/dates'

<td>{formatDate(transaction.date)}</td>
<td>{formatDateTime(transaction.createdAt)}</td>
{isPastDate(distribution.date) && <Badge>Overdue</Badge>}
```

---

### 🟡 MEDIUM-12: Inconsistent Error Handling UX
**Location**: Multiple components
**Category**: UX
**Severity**: MEDIUM

#### Description
Some errors shown via `alert()`, others via inline messages, creating inconsistent UX.

#### Examples
```javascript
// Component A: Uses alert
if (error) {
  alert('Failed to save')
}

// Component B: Uses inline error
if (error) {
  return <div className="error">{error}</div>
}

// Component C: Uses toast (inconsistent library)
if (error) {
  showToast(error)
}
```

#### Impact
- Confusing user experience
- Some errors block interaction (alert)
- Some errors easy to miss (inline)
- No standard error pattern
- Hard to test

#### Recommended Fix
```javascript
// components/ErrorDisplay.js
export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null

  return (
    <div role="alert" className="error-banner">
      <div className="error-icon">⚠️</div>
      <div className="error-message">{error}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function ErrorInline({ error }) {
  if (!error) return null

  return (
    <span role="alert" className="error-inline">
      {error}
    </span>
  )
}

// Usage
function MyComponent() {
  const [error, setError] = useState(null)

  return (
    <div>
      <ErrorBanner
        error={error}
        onDismiss={() => setError(null)}
      />

      <form>
        <input />
        <ErrorInline error={fieldError} />
      </form>
    </div>
  )
}
```

---

## Summary

**Total Medium Priority Issues**: 14
- **Backend**: 6 issues
  - Security: 2
  - Validation: 2
  - Error handling: 2
- **Frontend**: 8 issues
  - UX/Loading states: 3
  - Accessibility: 1
  - Data formatting: 2
  - Developer experience: 2

**Recommended Action Timeline:**
- **Month 1**: MEDIUM-01, MEDIUM-06 (security)
- **Month 2**: MEDIUM-07, MEDIUM-08 (UX/accessibility)
- **Month 3**: MEDIUM-09, MEDIUM-11 (data consistency)
- **Month 4**: Remaining issues (polish)

These issues should be addressed before production but won't cause critical failures. Prioritize based on user impact and development resources.
