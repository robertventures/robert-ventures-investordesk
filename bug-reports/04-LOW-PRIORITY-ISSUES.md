# LOW PRIORITY ISSUES

## Overview
These are minor issues, code quality improvements, and technical debt. They don't affect core functionality but should be addressed for long-term maintainability.

---

## BACKEND LOW PRIORITY ISSUES

### 🔵 LOW-01: Inconsistent Error Logging
**Location**: Multiple API routes
**Category**: Logging / Debugging
**Severity**: LOW

#### Description
Different routes use different error logging patterns. Some log stack traces, others don't. Some expose error details in responses, others don't.

#### Examples
```javascript
// Route A: Logs with stack trace
catch (error) {
  console.error('Error:', error.stack)
  return NextResponse.json({ error: 'Internal error' })
}

// Route B: Logs message only
catch (error) {
  console.error('Error:', error.message)
  return NextResponse.json({ error: error.message })
}

// Route C: Exposes full error in response
catch (error) {
  console.error(error)
  return NextResponse.json({ error: error.toString() })
}
```

#### Impact
- Harder to debug production issues
- Inconsistent error responses
- Potential information leakage
- No structured logging for monitoring tools

#### Recommended Fix
```javascript
// lib/errorHandler.js
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message)
    this.statusCode = statusCode
    this.details = details
    this.name = this.constructor.name
  }
}

export function logError(error, context = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    context,
    ...(error.statusCode && { statusCode: error.statusCode })
  }

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to Sentry, LogRocket, etc.
    console.error(JSON.stringify(errorLog))
  } else {
    console.error('Error Details:', errorLog)
  }
}

export function handleAPIError(error, context = {}) {
  logError(error, context)

  const statusCode = error.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'An error occurred'
    : error.message

  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.details,
        stack: error.stack
      })
    },
    { status: statusCode }
  )
}

// Usage in routes
import { AppError, handleAPIError } from '@/lib/errorHandler'

export async function POST(request) {
  try {
    // Route logic
    if (!data) {
      throw new AppError('Data not found', 404)
    }
  } catch (error) {
    return handleAPIError(error, {
      route: '/api/example',
      method: 'POST'
    })
  }
}
```

---

### 🔵 LOW-02: Missing Input Sanitization
**Location**: [app/api/admin/import-investors/route.js:139-144](../app/api/admin/import-investors/route.js)
**Category**: Security / Data Validation
**Severity**: LOW

#### Description
User descriptions from CSV import are stored without sanitization.

#### Current Code
```javascript
newUser.activity.push({
  id: dist.id || generateTransactionId('TX', userId, 'distribution'),
  type: 'distribution',
  amount: parseFloat(dist.amount) || 0,
  date: dist.date || new Date().toISOString(),
  description: dist.description || '',  // No sanitization
  status: 'completed'
})
```

#### Potential Issues
- XSS if descriptions rendered without escaping
- Database injection if special characters not handled
- Very long descriptions could cause storage issues
- Unusual characters could break exports/reports

#### Impact (Currently Low because React escapes by default)
- React automatically escapes text content, preventing XSS
- But could become issue if:
  - Data exported to PDF/Excel
  - Rendered with `dangerouslySetInnerHTML`
  - Used in email templates
  - Displayed in admin tools outside React

#### Recommended Fix
```javascript
// lib/sanitization.js
export function sanitizeText(text, maxLength = 500) {
  if (!text) return ''

  return text
    .toString()
    .trim()
    .slice(0, maxLength)
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
}

export function sanitizeAmount(value) {
  const num = parseFloat(value)
  if (isNaN(num) || !isFinite(num)) {
    throw new Error('Invalid amount')
  }
  // Round to 2 decimal places
  return Math.round(num * 100) / 100
}

// Usage
import { sanitizeText, sanitizeAmount } from '@/lib/sanitization'

newUser.activity.push({
  id: dist.id || generateTransactionId('TX', userId, 'distribution'),
  type: 'distribution',
  amount: sanitizeAmount(dist.amount),
  date: dist.date || new Date().toISOString(),
  description: sanitizeText(dist.description, 200),
  status: 'completed'
})
```

---

### 🔵 LOW-03: Hardcoded Verification Code
**Location**: [app/api/users/[id]/route.js:219-222](../app/api/users/[id]/route.js)
**Category**: Security (Testing)
**Severity**: LOW

#### Description
Accepts hardcoded '000000' as valid verification code for testing.

#### Current Code
```javascript
// For now, accept '000000' as valid code. Later can implement real email verification
if (body.verificationCode !== '000000') {
  return NextResponse.json({
    success: false,
    error: 'Invalid verification code'
  }, { status: 400 })
}
```

#### Impact
- Anyone can verify any account with '000000'
- Email verification completely bypassed
- Account takeover if attacker knows user ID
- **Note**: This is marked low because it's intentional for testing, but MUST be fixed before production

#### Recommended Fix for Production
```javascript
// Generate verification code when email verification requested
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Store in user record
const verificationCode = generateVerificationCode()
const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

await updateUser(userId, {
  verificationCode,
  verificationExpiry
})

// Send email
await sendVerificationEmail(user.email, verificationCode)

// Verify endpoint
if (body.verificationCode !== user.verificationCode) {
  return NextResponse.json({
    success: false,
    error: 'Invalid verification code'
  }, { status: 400 })
}

if (new Date() > new Date(user.verificationExpiry)) {
  return NextResponse.json({
    success: false,
    error: 'Verification code expired'
  }, { status: 400 })
}

// Clear code after use
await updateUser(userId, {
  verificationCode: null,
  verificationExpiry: null,
  emailVerified: true
})
```

---

## FRONTEND LOW PRIORITY ISSUES

### 🔵 LOW-04: Console Statements in Production
**Location**: Multiple components
**Category**: Code Quality
**Severity**: LOW

#### Description
Many `console.log` and `console.error` statements throughout codebase.

#### Examples
```javascript
// AdminPage.js line 237
console.error('Error loading users:', error)

// InvestmentForm.js line 124
console.log('Form submitted:', data)

// TransactionsList.js line 89
console.log('Transactions:', transactions)
```

#### Impact
- Performance overhead in production
- Potential information leakage via browser console
- Cluttered console makes debugging harder
- Looks unprofessional

#### Recommended Fix

**Option 1: Create Logger Utility**
```javascript
// lib/logger.js
const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  error: (...args) => {
    console.error(...args)
    // In production, send to error tracking
    if (!isDevelopment && window.errorTracker) {
      window.errorTracker.log(args[0])
    }
  },

  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },

  debug: (...args) => {
    if (isDevelopment && process.env.DEBUG) {
      console.log('[DEBUG]', ...args)
    }
  }
}

// Usage
import { logger } from '@/lib/logger'

logger.log('User loaded:', user) // Only in development
logger.error('Failed to load', error) // Always logged + tracked
```

**Option 2: Remove/Comment Development Logs**
```bash
# Find all console.log statements
grep -r "console.log" app/

# Replace with comments
# console.log('Debug info')
```

---

### 🔵 LOW-05: Hard-coded Strings (No i18n)
**Location**: All components
**Category**: Internationalization
**Severity**: LOW

#### Description
All user-facing strings are hard-coded in components.

#### Examples
```javascript
<button>Submit Investment</button>
<p>No transactions found</p>
<h1>Welcome to InvestorDesk</h1>
```

#### Impact
- Cannot internationalize app without major refactoring
- Difficult to change copy across app
- Inconsistent terminology
- Marketing team cannot easily update copy

#### Recommended Fix

**Option 1: String Constants**
```javascript
// lib/strings.js
export const STRINGS = {
  COMMON: {
    SUBMIT: 'Submit',
    CANCEL: 'Cancel',
    LOADING: 'Loading...',
    ERROR: 'An error occurred'
  },
  INVESTMENT: {
    SUBMIT_BUTTON: 'Submit Investment',
    MIN_AMOUNT: 'Minimum investment: $1,000',
    SUCCESS_MESSAGE: 'Investment submitted successfully'
  },
  DASHBOARD: {
    WELCOME: 'Welcome to InvestorDesk',
    NO_TRANSACTIONS: 'No transactions found',
    VIEW_DETAILS: 'View Details'
  }
}

// Usage
import { STRINGS } from '@/lib/strings'

<button>{STRINGS.INVESTMENT.SUBMIT_BUTTON}</button>
<p>{STRINGS.DASHBOARD.NO_TRANSACTIONS}</p>
```

**Option 2: Full i18n (Future-proof)**
```javascript
// Install: npm install react-intl

// messages/en.json
{
  "investment.submit": "Submit Investment",
  "dashboard.welcome": "Welcome to InvestorDesk",
  "dashboard.noTransactions": "No transactions found"
}

// Usage
import { FormattedMessage } from 'react-intl'

<FormattedMessage id="investment.submit" />

// Or
import { useIntl } from 'react-intl'

const intl = useIntl()
const buttonText = intl.formatMessage({ id: 'investment.submit' })
```

---

### 🔵 LOW-06: Magic Numbers in Code
**Location**: Multiple components
**Category**: Code Quality
**Severity**: LOW

#### Description
Numbers with special meaning not extracted to named constants.

#### Examples
```javascript
// InvestmentForm.js line 24
if (amount % 10 !== 0) {
  setError('Amount must be a multiple of 10')
}

// PortfolioSummary.js line 175
const months = Array.from({ length: 23 }, ...)

// TransactionsList.js line 56
const recentTransactions = transactions.slice(0, 5)
```

#### Impact
- Hard to understand what numbers mean
- Difficult to change values consistently
- Code less maintainable

#### Recommended Fix
```javascript
// constants/investment.js
export const INVESTMENT_CONSTRAINTS = {
  MIN_AMOUNT: 1000,
  MAX_AMOUNT: 1000000,
  AMOUNT_INCREMENT: 10,
  MIN_MONTHLY_PAYMENT: 100
}

export const DISPLAY_LIMITS = {
  RECENT_TRANSACTIONS: 5,
  MAX_TABLE_ROWS: 50,
  CHART_MONTHS: 23
}

// Usage
import { INVESTMENT_CONSTRAINTS, DISPLAY_LIMITS } from '@/constants/investment'

if (amount % INVESTMENT_CONSTRAINTS.AMOUNT_INCREMENT !== 0) {
  setError(`Amount must be a multiple of $${INVESTMENT_CONSTRAINTS.AMOUNT_INCREMENT}`)
}

const months = Array.from({ length: DISPLAY_LIMITS.CHART_MONTHS }, ...)
const recentTransactions = transactions.slice(0, DISPLAY_LIMITS.RECENT_TRANSACTIONS)
```

---

### 🔵 LOW-07: Undefined State Variables
**Location**: [app/components/ProfileView.js:537-571](../app/components/ProfileView.js)
**Category**: Dead Code
**Severity**: LOW

#### Description
Function references undefined state variables that were never declared.

#### Current Code
```javascript
const handleRequestDeletion = async () => {
  setIsRequestingDeletion(true) // Undefined
  setShowDeleteModal(false) // Undefined

  try {
    const response = await fetch(`/api/users/${user.id}/request-deletion`, {
      method: 'POST',
      body: JSON.stringify({ reason: deletionReason }) // Undefined
    })
    // ...
  } finally {
    setIsRequestingDeletion(false)
  }
}
```

#### Impact
- Runtime error if function called
- Dead code taking up space
- Confusing for developers

#### Recommended Fix

**Option 1: Remove if unused**
```javascript
// If account deletion not implemented yet, remove the function
// Or comment out for future implementation
```

**Option 2: Implement properly**
```javascript
const [isRequestingDeletion, setIsRequestingDeletion] = useState(false)
const [showDeleteModal, setShowDeleteModal] = useState(false)
const [deletionReason, setDeletionReason] = useState('')

const handleRequestDeletion = async () => {
  if (!deletionReason.trim()) {
    alert('Please provide a reason for account deletion')
    return
  }

  setIsRequestingDeletion(true)

  try {
    const response = await fetch(`/api/users/${user.id}/request-deletion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: deletionReason })
    })

    if (!response.ok) throw new Error('Request failed')

    const data = await response.json()

    if (data.success) {
      alert('Account deletion requested. An admin will review your request.')
      setShowDeleteModal(false)
      setDeletionReason('')
    }
  } catch (error) {
    console.error('Deletion request failed:', error)
    alert('Failed to request account deletion')
  } finally {
    setIsRequestingDeletion(false)
  }
}
```

---

### 🔵 LOW-08: Inconsistent Component File Organization
**Location**: Project structure
**Category**: Code Organization
**Severity**: LOW

#### Description
Components organized in multiple ways:
- Some in `/app/components`
- Some in `/app/admin/components`
- Some co-located with pages
- No clear naming convention

#### Current Structure
```
app/
├── components/           # Shared components
├── admin/
│   └── components/      # Admin-only components
├── dashboard/
│   └── page.js         # Page component
└── investment/
    └── page.js         # Page component
```

#### Impact
- Hard to find components
- Unclear which components are shared
- Difficult to refactor
- Inconsistent imports

#### Recommended Structure
```
app/
├── components/
│   ├── common/         # Truly shared components
│   │   ├── Button.js
│   │   ├── Modal.js
│   │   └── ErrorBoundary.js
│   ├── forms/         # Form-related components
│   │   ├── InvestmentForm.js
│   │   └── PersonalDetailsForm.js
│   ├── layout/        # Layout components
│   │   ├── Header.js
│   │   └── Footer.js
│   └── dashboard/     # Dashboard-specific
│       ├── PortfolioSummary.js
│       └── TransactionsList.js
├── admin/
│   ├── components/    # Admin-only components
│   └── page.js
└── (routes)/         # Page components
    ├── dashboard/
    ├── investment/
    └── onboarding/
```

---

### 🔵 LOW-09: Missing Component Documentation
**Location**: All components
**Category**: Documentation
**Severity**: LOW

#### Description
No JSDoc comments or component documentation.

#### Current State
```javascript
export default function InvestmentCard({ investment, onEdit }) {
  // What does this component do?
  // What props does it accept?
  // What are the prop types?
  return <div>...</div>
}
```

#### Recommended Fix
```javascript
/**
 * InvestmentCard displays a summary of an investment
 * with options to view details or edit.
 *
 * @component
 * @example
 * ```jsx
 * <InvestmentCard
 *   investment={{
 *     id: 'INV123',
 *     amount: 10000,
 *     status: 'active'
 *   }}
 *   onEdit={(id) => console.log('Edit', id)}
 * />
 * ```
 */
export default function InvestmentCard({
  /** Investment object containing id, amount, status, etc. */
  investment,
  /** Callback fired when edit button is clicked. Receives investment ID. */
  onEdit,
  /** Whether the card is in loading state */
  isLoading = false
}) {
  // Component implementation
}
```

---

### 🔵 LOW-10: No Loading Skeleton Components
**Location**: All data-loading components
**Category**: UX Polish
**Severity**: LOW

#### Description
Loading states show generic "Loading..." text instead of skeleton screens.

#### Current State
```javascript
if (isLoading) {
  return <div>Loading...</div>
}
```

#### Impact
- Less polished UI
- Users don't know what's loading
- Perceived performance is worse

#### Recommended Fix
```javascript
// components/common/Skeleton.js
export function Skeleton({ className = '', height = 20 }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ height }}
      aria-hidden="true"
    />
  )
}

// CSS
.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// Usage - TransactionsList skeleton
function TransactionsListSkeleton() {
  return (
    <div className="transactions-list">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="transaction-row">
          <Skeleton width={100} />
          <Skeleton width={150} />
          <Skeleton width={80} />
        </div>
      ))}
    </div>
  )
}

// In component
if (isLoading) {
  return <TransactionsListSkeleton />
}
```

---

## Summary

**Total Low Priority Issues**: 10
- **Backend**: 3 issues
  - Logging: 1
  - Security (testing): 1
  - Data validation: 1
- **Frontend**: 7 issues
  - Code quality: 4
  - Documentation: 1
  - Organization: 1
  - UX polish: 1

**Recommended Approach:**
- Address during regular development cycles
- Include in coding standards/style guide
- Can be delegated to junior developers
- Good candidates for community contributions
- Low priority but improve maintainability

**When to Address:**
- LOW-03 (Hardcoded verification): Before production (MUST)
- LOW-04 (Console logs): Before production (SHOULD)
- LOW-01, 02 (Logging, sanitization): During security hardening
- LOW-05, 06, 07 (Code quality): During refactoring sprints
- LOW-08, 09 (Organization, docs): During tech debt sprints
- LOW-10 (Skeletons): During UX polish phase

These issues don't require immediate attention but should be tracked and addressed over time to maintain code quality and developer productivity.
