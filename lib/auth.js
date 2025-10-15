import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// JWT Secret Configuration and Validation
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production'

// Weak default secrets that should never be used in production
const WEAK_SECRETS = [
  'dev-secret-change-in-production',
  'dev-refresh-secret-change-in-production',
  'your-secure-jwt-secret-here',
  'your-secure-refresh-secret-here'
]

// Minimum secret length for security (256 bits = 32 bytes = 64 hex chars)
const MIN_SECRET_LENGTH = 32

/**
 * Validate JWT secrets on module load
 * Prevents application from running with weak secrets in production
 */
function validateSecrets() {
  const isProduction = process.env.NODE_ENV === 'production'
  const isNetlify = process.env.NETLIFY === 'true'

  // Critical: Fail fast in production if secrets are not set or are weak
  if (isProduction || isNetlify) {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error('❌ SECURITY ERROR: JWT secrets are not set in production environment!')
      console.error('   Set JWT_SECRET and JWT_REFRESH_SECRET environment variables.')
      throw new Error('Missing JWT secrets in production. Application cannot start.')
    }

    if (WEAK_SECRETS.includes(JWT_SECRET) || WEAK_SECRETS.includes(JWT_REFRESH_SECRET)) {
      console.error('❌ SECURITY ERROR: Weak/default JWT secrets detected in production!')
      console.error('   Generate strong secrets using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
      throw new Error('Weak JWT secrets detected in production. Application cannot start.')
    }

    if (JWT_SECRET.length < MIN_SECRET_LENGTH || JWT_REFRESH_SECRET.length < MIN_SECRET_LENGTH) {
      console.error(`❌ SECURITY ERROR: JWT secrets must be at least ${MIN_SECRET_LENGTH} characters long!`)
      console.error('   Current JWT_SECRET length:', JWT_SECRET.length)
      console.error('   Current JWT_REFRESH_SECRET length:', JWT_REFRESH_SECRET.length)
      throw new Error('JWT secrets too short. Application cannot start.')
    }
  }

  // Warning in development if using default secrets
  if (!isProduction && !isNetlify) {
    if (WEAK_SECRETS.includes(JWT_SECRET) || WEAK_SECRETS.includes(JWT_REFRESH_SECRET)) {
      console.warn('⚠️  WARNING: Using default JWT secrets in development.')
      console.warn('   Generate strong secrets for testing: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    }
  }
}

// Run validation when module is loaded
validateSecrets()

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
  const saltRounds = 10
  return await bcrypt.hash(password, saltRounds)
}

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if passwords match
 */
export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash)
}

/**
 * Sign a JWT access token for a user
 * @param {object} user - User object with id, email, isAdmin
 * @returns {string} - Signed JWT token
 */
export function signToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    isAdmin: user.isAdmin || false
  }
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d' // 7 days
  })
}

/**
 * Sign a JWT refresh token for a user
 * @param {object} user - User object with id, email
 * @returns {string} - Signed refresh token
 */
export function signRefreshToken(user) {
  const payload = {
    userId: user.id,
    email: user.email
  }
  
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '30d' // 30 days
  })
}

/**
 * Verify and decode a JWT access token
 * @param {string} token - JWT token to verify
 * @returns {object|null} - Decoded token payload or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    console.error('Token verification failed:', error.message)
    return null
  }
}

/**
 * Verify and decode a JWT refresh token
 * @param {string} token - Refresh token to verify
 * @returns {object|null} - Decoded token payload or null if invalid
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET)
  } catch (error) {
    console.error('Refresh token verification failed:', error.message)
    return null
  }
}

/**
 * Check if a password is hashed (bcrypt format)
 * @param {string} password - Password to check
 * @returns {boolean} - True if password is hashed
 */
export function isPasswordHashed(password) {
  // Bcrypt hashes start with $2a$, $2b$, or $2y$
  return typeof password === 'string' && /^\$2[aby]\$/.test(password)
}

