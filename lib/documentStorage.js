/**
 * Document Storage Service - Netlify Blobs
 * 
 * Handles storage and retrieval of user documents (statements, notices, etc.)
 */

import { getStore } from '@netlify/blobs'

const isNetlify = process.env.NETLIFY === 'true'
const useBlobs = isNetlify || process.env.NODE_ENV === 'production'

function getDocumentStore() {
  return getStore({ name: 'documents' })
}

/**
 * Upload a document to blob storage
 * @param {string} key - The blob key (e.g., 'documents/2024/USR-1001.pdf')
 * @param {Buffer|ArrayBuffer} data - The document data
 * @param {string} contentType - MIME type (default: application/pdf)
 * @returns {Promise<{success: boolean, key?: string, error?: string}>}
 */
export async function uploadDocument(key, data, contentType = 'application/pdf') {
  try {
    if (!useBlobs) {
      console.warn('Blob storage not enabled in development. Skipping upload.')
      return { success: true, key, message: 'Development mode - upload skipped' }
    }

    const store = getDocumentStore()
    await store.set(key, data, { 
      contentType,
      metadata: {
        uploadedAt: new Date().toISOString()
      }
    })
    
    console.log(`Document uploaded successfully: ${key}`)
    return { success: true, key }
  } catch (error) {
    console.error(`Error uploading document ${key}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Get a document from blob storage
 * @param {string} key - The blob key
 * @returns {Promise<{success: boolean, data?: ArrayBuffer, metadata?: object, error?: string}>}
 */
export async function getDocument(key) {
  try {
    if (!useBlobs) {
      console.warn('Blob storage not enabled in development.')
      return { success: false, error: 'Blob storage not enabled in development' }
    }

    const store = getDocumentStore()
    const blob = await store.get(key, { type: 'arrayBuffer' })
    
    if (!blob) {
      return { success: false, error: 'Document not found' }
    }

    const metadata = await store.getMetadata(key)
    
    return { success: true, data: blob, metadata }
  } catch (error) {
    console.error(`Error retrieving document ${key}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a document from blob storage
 * @param {string} key - The blob key
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteDocument(key) {
  try {
    if (!useBlobs) {
      console.warn('Blob storage not enabled in development. Skipping delete.')
      return { success: true, message: 'Development mode - delete skipped' }
    }

    const store = getDocumentStore()
    await store.delete(key)
    
    console.log(`Document deleted successfully: ${key}`)
    return { success: true }
  } catch (error) {
    console.error(`Error deleting document ${key}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * List all documents with a specific prefix
 * @param {string} prefix - The prefix to filter by (e.g., 'documents/2024/')
 * @returns {Promise<{success: boolean, documents?: Array, error?: string}>}
 */
export async function listDocuments(prefix = '') {
  try {
    if (!useBlobs) {
      console.warn('Blob storage not enabled in development.')
      return { success: true, documents: [] }
    }

    const store = getDocumentStore()
    const { blobs } = await store.list({ prefix })
    
    return { success: true, documents: blobs }
  } catch (error) {
    console.error(`Error listing documents with prefix ${prefix}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Generate a standard blob key for a document
 * @param {string} type - Document type (e.g., 'documents', 'statements')
 * @param {string} year - Year (e.g., '2024')
 * @param {string} userId - User ID
 * @param {string} fileName - Original filename
 * @returns {string} - Blob key
 */
export function generateDocumentKey(type, year, userId, fileName) {
  const timestamp = Date.now()
  const extension = fileName.split('.').pop()
  return `${type}/${year}/${userId}-${timestamp}.${extension}`
}

/**
 * Check if a file is a valid PDF
 * @param {Buffer|ArrayBuffer} data - File data
 * @returns {boolean}
 */
export function isPDF(data) {
  const arr = new Uint8Array(data.slice(0, 5))
  // PDF files start with %PDF-
  return arr[0] === 0x25 && arr[1] === 0x50 && arr[2] === 0x44 && arr[3] === 0x46
}

