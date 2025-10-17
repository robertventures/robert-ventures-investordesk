/**
 * Encryption Service for Personally Identifiable Information (PII)
 *
 * Uses AES-256-GCM encryption to protect sensitive data like SSNs at rest
 * CRITICAL: Requires ENCRYPTION_KEY environment variable in production
 */

import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // Initialization vector length
const SALT_LENGTH = 64 // Salt length for key derivation
const TAG_LENGTH = 16 // Authentication tag length
const KEY_LENGTH = 32 // 256 bits

// Get encryption key from environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

/**
 * Validate encryption key at runtime
 *
 * IMPORTANT: Only validates when server is actually RUNNING (not during build)
 * - Build time (next build): Skip validation - encryption not needed yet
 * - Development (next dev): Allow dev defaults with warning
 * - Production runtime (Netlify/deployed): Require strong encryption key
 */
function validateEncryptionKey() {
  // Skip validation during build phase (Next.js static generation)
  // We only need encryption when the server actually runs
  if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
    // Check if we're in a build context by looking for Next.js build phase indicators
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
    if (isBuildPhase) {
      return // Skip validation during build
    }
  }

  // Only enforce strict validation when actually deployed to Netlify/production
  // This allows local builds and testing with dev secrets
  const isNetlify = process.env.NETLIFY === 'true'
  const requireStrictKey = isNetlify

  if (requireStrictKey) {
    // STRICT VALIDATION: Only when deployed to production (Netlify)
    if (!ENCRYPTION_KEY) {
      console.error('❌ SECURITY ERROR: ENCRYPTION_KEY is not set in production!')
      console.error('   Generate a key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
      console.error('   Set this in Netlify environment variables.')
      throw new Error('Missing ENCRYPTION_KEY in production. Application cannot start.')
    }

    if (ENCRYPTION_KEY.length < 64) {
      console.error('❌ SECURITY ERROR: ENCRYPTION_KEY must be at least 64 characters (32 bytes hex)!')
      console.error('   Current length:', ENCRYPTION_KEY.length)
      throw new Error('ENCRYPTION_KEY too short. Application cannot start.')
    }

    console.log('✅ Encryption key validated for production deployment')
  } else {
    // DEVELOPMENT/TESTING: Just warn if using defaults
    if (!ENCRYPTION_KEY) {
      console.warn('⚠️  WARNING: ENCRYPTION_KEY not set. Using development default.')
      console.warn('   This is OK for local testing, but generate a strong key for production.')
      console.warn('   Command: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    } else {
      console.log('✅ Encryption key configured for development')
    }
  }
}

// Lazy validation - only run when encryption is first used
let validationRun = false
function ensureValidation() {
  if (!validationRun) {
    validateEncryptionKey()
    validationRun = true
  }
}

// Use provided key or development default
const encryptionKey = ENCRYPTION_KEY || 'dev-key-change-in-production-0123456789abcdef0123456789abcdef'

/**
 * Derive encryption key from password using PBKDF2
 * @param {string} password - Base encryption key
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} - Derived key
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypt sensitive data (e.g., SSN)
 * @param {string} plaintext - Data to encrypt
 * @returns {string} - Encrypted data in format: salt:iv:encrypted:tag (hex encoded)
 */
export function encrypt(plaintext) {
  ensureValidation() // Run validation on first use
  
  if (!plaintext) {
    return null
  }

  try {
    // Generate random salt and IV for each encryption
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)

    // Derive key from master key and salt
    const key = deriveKey(encryptionKey, salt)

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Get authentication tag
    const tag = cipher.getAuthTag()

    // Return salt:iv:encrypted:tag (all hex encoded)
    return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`
  } catch (error) {
    console.error('Encryption error:', error.message)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Encrypted data in format: salt:iv:encrypted:tag
 * @returns {string|null} - Decrypted plaintext or null
 */
export function decrypt(encryptedData) {
  ensureValidation() // Run validation on first use
  
  if (!encryptedData) {
    return null
  }

  try {
    // Check if data is already in encrypted format
    const parts = encryptedData.split(':')
    if (parts.length !== 4) {
      // Data might be plaintext (legacy) - return as is with warning
      console.warn('⚠️  Attempting to decrypt data that is not in encrypted format. Returning as-is.')
      return encryptedData
    }

    const [saltHex, ivHex, encrypted, tagHex] = parts

    // Convert from hex
    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')

    // Derive key from master key and salt
    const key = deriveKey(encryptionKey, salt)

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Decryption error:', error.message)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Check if a value is encrypted (in our format)
 * @param {string} value - Value to check
 * @returns {boolean} - True if encrypted
 */
export function isEncrypted(value) {
  if (!value || typeof value !== 'string') {
    return false
  }

  // Check for our encryption format: salt:iv:encrypted:tag
  const parts = value.split(':')
  if (parts.length !== 4) {
    return false
  }

  // Verify each part is valid hex
  const [salt, iv, encrypted, tag] = parts
  const isValidHex = (str) => /^[0-9a-f]+$/i.test(str)

  return (
    isValidHex(salt) &&
    isValidHex(iv) &&
    isValidHex(encrypted) &&
    isValidHex(tag) &&
    salt.length === SALT_LENGTH * 2 && // hex is 2x bytes
    iv.length === IV_LENGTH * 2 &&
    tag.length === TAG_LENGTH * 2
  )
}

/**
 * Mask SSN for display (show last 4 digits only)
 * @param {string} ssn - SSN (encrypted or plaintext)
 * @returns {string} - Masked SSN (e.g., ***-**-1234)
 */
export function maskSSN(ssn) {
  if (!ssn) {
    return null
  }

  try {
    // Decrypt if encrypted
    const plainSSN = isEncrypted(ssn) ? decrypt(ssn) : ssn

    // Remove any non-digits
    const digits = plainSSN.replace(/\D/g, '')

    if (digits.length !== 9) {
      return '***-**-****'
    }

    // Show last 4 digits only
    return `***-**-${digits.slice(-4)}`
  } catch (error) {
    console.error('Error masking SSN:', error.message)
    return '***-**-****'
  }
}
