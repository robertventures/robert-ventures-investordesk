/**
 * Supabase Storage Service
 * Handles document storage and retrieval using Supabase Storage
 * Replaces Netlify Blobs for document storage
 */

import { createServiceClient } from './supabaseClient.js'
import { generateTransactionId } from './idGenerator.js'

const BUCKET_NAME = 'documents'

/**
 * Upload a document to Supabase Storage
 * @param {string} userId - User ID
 * @param {string} fileName - Original file name
 * @param {Buffer|ArrayBuffer|Blob} data - File data
 * @param {string} contentType - MIME type
 * @param {object} metadata - Additional metadata
 * @returns {Promise<{success: boolean, path?: string, id?: string, error?: string}>}
 */
export async function uploadDocument(userId, fileName, data, contentType = 'application/pdf', metadata = {}) {
  try {
    const supabase = createServiceClient()

    // Generate unique file path
    const timestamp = Date.now()
    const extension = fileName.split('.').pop()
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${userId}/${timestamp}-${safeName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .upload(storagePath, data, {
        contentType,
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError)
      return { success: false, error: uploadError.message }
    }

    // Store metadata in database
    const documentId = generateTransactionId('DOC', userId, fileName)
    const { error: dbError } = await supabase
      .from('documents_metadata')
      .insert({
        id: documentId,
        user_id: userId,
        investment_id: metadata.investmentId || null,
        file_name: fileName,
        file_type: contentType,
        file_size: data.byteLength || data.size || 0,
        storage_path: storagePath,
        document_type: metadata.documentType || 'other',
        uploaded_by: metadata.uploadedBy || userId,
        metadata: metadata
      })

    if (dbError) {
      console.error('Error storing document metadata:', dbError)
      // Still return success since file was uploaded
    }

    console.log(`Document uploaded successfully: ${storagePath}`)
    return { success: true, path: storagePath, id: documentId }
  } catch (error) {
    console.error(`Error uploading document:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Get a document from Supabase Storage
 * Returns a signed URL for download
 * @param {string} storagePath - Path in storage
 * @param {number} expiresIn - URL expiration in seconds (default 1 hour)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function getDocument(storagePath, expiresIn = 3600) {
  try {
    const supabase = createServiceClient()

    // Generate signed URL
    const { data, error } = await supabase
      .storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresIn)

    if (error) {
      console.error('Error creating signed URL:', error)
      return { success: false, error: error.message }
    }

    if (!data || !data.signedUrl) {
      return { success: false, error: 'Document not found' }
    }

    return { success: true, url: data.signedUrl }
  } catch (error) {
    console.error(`Error retrieving document:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Download document data directly
 * @param {string} storagePath - Path in storage
 * @returns {Promise<{success: boolean, data?: ArrayBuffer, error?: string}>}
 */
export async function downloadDocument(storagePath) {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .storage
      .from(BUCKET_NAME)
      .download(storagePath)

    if (error) {
      console.error('Error downloading document:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'Document not found' }
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await data.arrayBuffer()

    return { success: true, data: arrayBuffer }
  } catch (error) {
    console.error(`Error downloading document:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a document from Supabase Storage
 * @param {string} storagePath - Path in storage
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteDocument(storagePath) {
  try {
    const supabase = createServiceClient()

    // Delete from storage
    const { error: storageError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .remove([storagePath])

    if (storageError) {
      console.error('Error deleting from storage:', storageError)
      return { success: false, error: storageError.message }
    }

    // Delete metadata from database
    const { error: dbError } = await supabase
      .from('documents_metadata')
      .delete()
      .eq('storage_path', storagePath)

    if (dbError) {
      console.error('Error deleting document metadata:', dbError)
      // Still return success since file was deleted
    }

    console.log(`Document deleted successfully: ${storagePath}`)
    return { success: true }
  } catch (error) {
    console.error(`Error deleting document:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * List documents for a user
 * @param {string} userId - User ID
 * @param {object} filters - Optional filters
 * @returns {Promise<{success: boolean, documents?: Array, error?: string}>}
 */
export async function listUserDocuments(userId, filters = {}) {
  try {
    const supabase = createServiceClient()

    let query = supabase
      .from('documents_metadata')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })

    if (filters.investmentId) {
      query = query.eq('investment_id', filters.investmentId)
    }

    if (filters.documentType) {
      query = query.eq('document_type', filters.documentType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error listing documents:', error)
      return { success: false, error: error.message }
    }

    return { success: true, documents: data || [] }
  } catch (error) {
    console.error('Error in listUserDocuments:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get document metadata by ID
 * @param {string} documentId - Document ID
 * @returns {Promise<{success: boolean, document?: object, error?: string}>}
 */
export async function getDocumentMetadata(documentId) {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('documents_metadata')
      .select('*')
      .eq('id', documentId)
      .single()

    if (error) {
      console.error('Error getting document metadata:', error)
      return { success: false, error: error.message }
    }

    return { success: true, document: data }
  } catch (error) {
    console.error('Error in getDocumentMetadata:', error)
    return { success: false, error: error.message }
  }
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

/**
 * Get public URL for a document (if bucket is public)
 * @param {string} storagePath - Path in storage
 * @returns {string}
 */
export function getPublicUrl(storagePath) {
  const supabase = createServiceClient()
  const { data } = supabase
    .storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath)

  return data?.publicUrl || null
}

