import { hashPassword, comparePassword } from './auth.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

/**
 * Master Password Storage - Uses Local File System
 * 
 * For production, consider storing in Supabase app_settings table with encryption
 */

// In-memory storage for local development
let localMasterPasswordData = null

// File path for local development storage
const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'data', 'master-password.json')

/**
 * Generate a secure random password
 * @returns {string} - 16 character random password
 */
function generateSecurePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  const length = 16
  let password = ''
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, chars.length)
    password += chars[randomIndex]
  }
  
  return password
}

/**
 * Store master password data to local file
 * @param {object} data - Master password data
 */
async function storeMasterPasswordData(data) {
  // Use file-based storage to persist across hot reloads
  try {
    const dir = path.dirname(LOCAL_STORAGE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2))
    localMasterPasswordData = data // Also keep in memory for performance
  } catch (error) {
    console.error('Error storing master password to file:', error)
    // Fallback to in-memory only
    localMasterPasswordData = data
  }
}

/**
 * Get master password data from local file
 * @returns {object|null} - Master password data or null
 */
async function getMasterPasswordData() {
  // First try in-memory cache
  if (localMasterPasswordData) {
    return localMasterPasswordData
  }
  
  // Then try file-based storage
  try {
    if (fs.existsSync(LOCAL_STORAGE_PATH)) {
      const fileContent = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8')
      localMasterPasswordData = JSON.parse(fileContent)
      return localMasterPasswordData
    }
  } catch (error) {
    console.error('Error reading master password from file:', error)
  }
  
  return null
}

/**
 * Generate a new master password
 * @param {string} adminUserId - ID of admin generating the password
 * @returns {object} - { password: string, expiresAt: string }
 */
export async function generateMasterPassword(adminUserId) {
  const plainPassword = generateSecurePassword()
  const hashedPassword = await hashPassword(plainPassword)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
  
  const data = {
    masterPassword: hashedPassword,
    expiresAt,
    generatedBy: adminUserId,
    generatedAt: new Date().toISOString()
  }
  
  await storeMasterPasswordData(data)
  
  return {
    password: plainPassword,
    expiresAt
  }
}

/**
 * Verify if a password matches the active master password
 * @param {string} password - Password to verify
 * @returns {Promise<boolean>} - True if valid and not expired
 */
export async function verifyMasterPassword(password) {
  const data = await getMasterPasswordData()
  
  if (!data) {
    return false
  }
  
  // Check if expired
  const now = new Date()
  const expiresAt = new Date(data.expiresAt)
  
  if (now > expiresAt) {
    console.log('Master password has expired')
    return false
  }
  
  // Verify password
  return await comparePassword(password, data.masterPassword)
}

/**
 * Get master password info (without the actual password)
 * @returns {object|null} - Master password info or null
 */
export async function getMasterPasswordInfo() {
  const data = await getMasterPasswordData()
  
  if (!data) {
    return null
  }
  
  const now = new Date()
  const expiresAt = new Date(data.expiresAt)
  const isExpired = now > expiresAt
  
  return {
    expiresAt: data.expiresAt,
    generatedAt: data.generatedAt,
    generatedBy: data.generatedBy,
    isExpired,
    timeRemaining: isExpired ? 0 : Math.max(0, expiresAt - now)
  }
}

