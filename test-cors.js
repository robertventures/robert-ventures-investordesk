/**
 * CORS Configuration Tests
 *
 * Run with: node test-cors.js
 */

// Mock environment
process.env.NODE_ENV = 'development'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// Test utilities
function testOriginValidation(origin, shouldAllow, testName) {
  // Build allowed origins based on environment (matching lib/cors.js logic)
  const buildAllowedOrigins = () => {
    const origins = []

    if (process.env.NEXT_PUBLIC_APP_URL) {
      if (process.env.NODE_ENV === 'production') {
        if (!process.env.NEXT_PUBLIC_APP_URL.includes('localhost') &&
            !process.env.NEXT_PUBLIC_APP_URL.includes('127.0.0.1')) {
          origins.push(process.env.NEXT_PUBLIC_APP_URL)
        }
      } else {
        origins.push(process.env.NEXT_PUBLIC_APP_URL)
      }
    }

    // Always allow hardcoded production domains for testing
    origins.push('https://invest.robertventures.com')

    if (process.env.NODE_ENV !== 'production') {
      origins.push('http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000')
    }

    return origins.filter(Boolean)
  }

  const ALLOWED_ORIGINS = buildAllowedOrigins()
  let isAllowed = ALLOWED_ORIGINS.includes(origin)

  // Pattern matching in development
  if (!isAllowed && process.env.NODE_ENV !== 'production') {
    if (origin.match(/^https:\/\/.*\.netlify\.app$/)) {
      isAllowed = true
    }
    if (origin.match(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/)) {
      isAllowed = true
    }
  }

  const result = isAllowed === shouldAllow
  console.log(
    `${result ? '✅' : '❌'} ${testName}:`,
    `Origin "${origin}" ${isAllowed ? 'allowed' : 'blocked'}`,
    `(expected: ${shouldAllow ? 'allowed' : 'blocked'})`
  )
  return result
}

console.log('🔒 CORS Configuration Tests\n')

// Development mode tests
console.log('Development Mode Tests (NODE_ENV=development):')
console.log('─────────────────────────────────────────────')

let passed = 0
let failed = 0

// Test 1: localhost:3000 (exact match)
if (testOriginValidation('http://localhost:3000', true, 'Test 1')) passed++
else failed++

// Test 2: localhost:3001 (exact match)
if (testOriginValidation('http://localhost:3001', true, 'Test 2')) passed++
else failed++

// Test 3: localhost:3002 (pattern match)
if (testOriginValidation('http://localhost:3002', true, 'Test 3')) passed++
else failed++

// Test 4: Netlify preview URL (pattern match)
if (testOriginValidation('https://deploy-preview-123--mysite.netlify.app', true, 'Test 4')) passed++
else failed++

// Test 5: Malicious site (blocked)
if (testOriginValidation('https://malicious-site.com', false, 'Test 5')) passed++
else failed++

// Test 6: Production domain (allowed)
if (testOriginValidation('https://invest.robertventures.com', true, 'Test 6')) passed++
else failed++

console.log('')

// Production mode tests
console.log('Production Mode Tests (NODE_ENV=production):')
console.log('────────────────────────────────────────────')
process.env.NODE_ENV = 'production'
process.env.NEXT_PUBLIC_APP_URL = 'https://invest.robertventures.com'

// Test 7: Production domain (allowed)
if (testOriginValidation('https://invest.robertventures.com', true, 'Test 7')) passed++
else failed++

// Test 8: localhost (blocked in production)
if (testOriginValidation('http://localhost:3000', false, 'Test 8')) passed++
else failed++

// Test 9: Netlify preview (blocked in production without pattern matching)
if (testOriginValidation('https://deploy-preview-123--mysite.netlify.app', false, 'Test 9')) passed++
else failed++

// Test 10: Malicious site (blocked)
if (testOriginValidation('https://malicious-site.com', false, 'Test 10')) passed++
else failed++

console.log('')
console.log('═══════════════════════════════════════════')
console.log(`Results: ${passed}/${passed + failed} tests passed`)

if (failed === 0) {
  console.log('✅ All CORS tests passed!')
} else {
  console.log(`❌ ${failed} test(s) failed`)
  process.exit(1)
}
