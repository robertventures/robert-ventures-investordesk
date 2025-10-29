/**
 * File Validation Utilities
 * 
 * Provides comprehensive file validation for uploads including:
 * - File size limits
 * - MIME type validation
 * - File extension validation
 * - Filename sanitization
 * - Content-based validation (magic bytes)
 */

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes
const MAX_ZIP_SIZE = 50 * 1024 * 1024 // 50MB for ZIP files

const ALLOWED_MIME_TYPES = {
  'application/pdf': {
    extensions: ['.pdf'],
    magicBytes: [0x25, 0x50, 0x44, 0x46], // %PDF
    description: 'PDF Document'
  },
  'application/zip': {
    extensions: ['.zip'],
    magicBytes: [0x50, 0x4B, 0x03, 0x04], // PK.. (ZIP)
    description: 'ZIP Archive'
  }
}

/**
 * Validate file size
 * @param {File|number} file - File object or size in bytes
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {{valid: boolean, error?: string, size: number}}
 */
export function validateFileSize(file, maxSize = MAX_FILE_SIZE) {
  const size = typeof file === 'number' ? file : file.size
  
  if (!size || size === 0) {
    return {
      valid: false,
      error: 'File is empty',
      size: 0
    }
  }
  
  if (size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(1)
    const actualMB = (size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File size (${actualMB}MB) exceeds maximum allowed size (${maxMB}MB)`,
      size
    }
  }
  
  return {
    valid: true,
    size
  }
}

/**
 * Validate file extension
 * @param {string} filename - Filename to validate
 * @param {Array<string>} allowedExtensions - Allowed extensions (e.g., ['.pdf', '.zip'])
 * @returns {{valid: boolean, error?: string, extension: string}}
 */
export function validateFileExtension(filename, allowedExtensions = ['.pdf']) {
  if (!filename || typeof filename !== 'string') {
    return {
      valid: false,
      error: 'Invalid filename',
      extension: ''
    }
  }
  
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  
  if (!extension) {
    return {
      valid: false,
      error: 'File has no extension',
      extension: ''
    }
  }
  
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File extension ${extension} is not allowed. Allowed: ${allowedExtensions.join(', ')}`,
      extension
    }
  }
  
  return {
    valid: true,
    extension
  }
}

/**
 * Sanitize filename - remove or replace dangerous characters
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file'
  }
  
  // Split into name and extension
  const lastDot = filename.lastIndexOf('.')
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename
  const extension = lastDot > 0 ? filename.substring(lastDot) : ''
  
  // Sanitize name:
  // - Replace spaces with underscores
  // - Remove any character that's not alphanumeric, underscore, hyphen, or period
  // - Limit length to 100 characters
  let sanitizedName = name
    .replace(/\s+/g, '_') // spaces to underscores
    .replace(/[^a-zA-Z0-9._-]/g, '') // remove special chars
    .substring(0, 100) // limit length
  
  // Ensure name is not empty
  if (!sanitizedName) {
    sanitizedName = 'file'
  }
  
  // Sanitize extension (remove any non-alphanumeric except the dot)
  const sanitizedExtension = extension.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase()
  
  return sanitizedName + sanitizedExtension
}

/**
 * Validate file by magic bytes (file signature)
 * @param {ArrayBuffer|Buffer} data - File data
 * @param {string} expectedMimeType - Expected MIME type
 * @returns {{valid: boolean, error?: string, detectedType?: string}}
 */
export function validateFileMagicBytes(data, expectedMimeType) {
  if (!data || data.byteLength === 0) {
    return {
      valid: false,
      error: 'File data is empty'
    }
  }
  
  const mimeConfig = ALLOWED_MIME_TYPES[expectedMimeType]
  if (!mimeConfig) {
    return {
      valid: false,
      error: `MIME type ${expectedMimeType} is not supported`
    }
  }
  
  const arr = new Uint8Array(data.slice(0, Math.max(...Object.values(ALLOWED_MIME_TYPES).map(c => c.magicBytes.length))))
  
  // Check if magic bytes match
  const magicBytes = mimeConfig.magicBytes
  const matches = magicBytes.every((byte, index) => arr[index] === byte)
  
  if (!matches) {
    // Try to detect what it actually is
    let detectedType = 'unknown'
    for (const [mimeType, config] of Object.entries(ALLOWED_MIME_TYPES)) {
      const allMatch = config.magicBytes.every((byte, idx) => arr[idx] === byte)
      if (allMatch) {
        detectedType = config.description
        break
      }
    }
    
    return {
      valid: false,
      error: `File content does not match expected type ${mimeConfig.description}. Detected: ${detectedType}`,
      detectedType
    }
  }
  
  return {
    valid: true,
    detectedType: mimeConfig.description
  }
}

/**
 * Comprehensive file validation
 * Validates size, extension, MIME type, and content
 * 
 * @param {Object} params - Validation parameters
 * @param {File|Object} params.file - File object with name and size
 * @param {ArrayBuffer} params.data - File content data
 * @param {string} params.expectedMimeType - Expected MIME type (e.g., 'application/pdf')
 * @param {number} [params.maxSize] - Maximum file size (defaults based on type)
 * @returns {{valid: boolean, errors: Array<string>, sanitizedFilename?: string}}
 */
export function validateFile({ file, data, expectedMimeType = 'application/pdf', maxSize }) {
  const errors = []
  const filename = file.name || 'unknown'
  
  // Get MIME configuration
  const mimeConfig = ALLOWED_MIME_TYPES[expectedMimeType]
  if (!mimeConfig) {
    return {
      valid: false,
      errors: [`Unsupported file type: ${expectedMimeType}`]
    }
  }
  
  // Set default max size based on type
  if (!maxSize) {
    maxSize = expectedMimeType === 'application/zip' ? MAX_ZIP_SIZE : MAX_FILE_SIZE
  }
  
  // 1. Validate file size
  const sizeValidation = validateFileSize(file.size || data.byteLength, maxSize)
  if (!sizeValidation.valid) {
    errors.push(sizeValidation.error)
  }
  
  // 2. Validate file extension
  const extensionValidation = validateFileExtension(filename, mimeConfig.extensions)
  if (!extensionValidation.valid) {
    errors.push(extensionValidation.error)
  }
  
  // 3. Validate magic bytes (file content)
  if (data && data.byteLength > 0) {
    const magicBytesValidation = validateFileMagicBytes(data, expectedMimeType)
    if (!magicBytesValidation.valid) {
      errors.push(magicBytesValidation.error)
    }
  } else {
    errors.push('File data is missing or empty')
  }
  
  // 4. Sanitize filename
  const sanitizedFilename = sanitizeFilename(filename)
  
  return {
    valid: errors.length === 0,
    errors,
    sanitizedFilename,
    size: sizeValidation.size,
    extension: extensionValidation.extension
  }
}

/**
 * Quick PDF validation (for backward compatibility)
 * @param {ArrayBuffer|Buffer} data - File data
 * @returns {boolean}
 */
export function isPDF(data) {
  const result = validateFileMagicBytes(data, 'application/pdf')
  return result.valid
}

/**
 * Quick ZIP validation
 * @param {ArrayBuffer|Buffer} data - File data
 * @returns {boolean}
 */
export function isZIP(data) {
  const result = validateFileMagicBytes(data, 'application/zip')
  return result.valid
}

// Export constants for external use
export const FILE_SIZE_LIMITS = {
  PDF: MAX_FILE_SIZE,
  ZIP: MAX_ZIP_SIZE
}

export const SUPPORTED_MIME_TYPES = Object.keys(ALLOWED_MIME_TYPES)

export default {
  validateFile,
  validateFileSize,
  validateFileExtension,
  validateFileMagicBytes,
  sanitizeFilename,
  isPDF,
  isZIP,
  FILE_SIZE_LIMITS,
  SUPPORTED_MIME_TYPES
}

