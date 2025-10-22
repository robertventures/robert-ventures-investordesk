import { NextResponse } from 'next/server'
import { getUsers, updateUser } from '../../../../../lib/supabaseDatabase.js'
import { uploadDocument } from '../../../../../lib/supabaseStorage.js'
import { sendDocumentNotification } from '../../../../../lib/emailService.js'
import { generateTransactionId } from '../../../../../lib/idGenerator.js'
import { requireAdmin, authErrorResponse } from '../../../../../lib/authMiddleware.js'
import { validateFile } from '../../../../../lib/fileValidation.js'

/**
 * POST /api/admin/documents/upload-single
 * 
 * Upload a single document to a specific user
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const userId = formData.get('userId')

    if (!file || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Read file data
    const arrayBuffer = await file.arrayBuffer()

    // Comprehensive file validation (size, extension, MIME type, content)
    const validation = validateFile({
      file: { name: file.name, size: file.size },
      data: arrayBuffer,
      expectedMimeType: 'application/pdf'
    })

    if (!validation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'File validation failed',
          details: validation.errors 
        },
        { status: 400 }
      )
    }

    // Auto-set year to current year for organizational purposes
    const year = new Date().getFullYear().toString()

    const usersData = await getUsers()

    // Find target user
    const user = usersData.users.find(u => u.id === userId)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // No duplicate checking - allow multiple documents per user
    
    // Upload to Supabase Storage using sanitized filename
    const uploadResult = await uploadDocument(
      user.id,
      validation.sanitizedFilename,
      arrayBuffer,
      'application/pdf',
      {
        documentType: 'document',
        uploadedBy: admin.id,
        year: year,
        originalFilename: file.name
      }
    )

    if (!uploadResult.success) {
      return NextResponse.json(
        { success: false, error: uploadResult.error },
        { status: 500 }
      )
    }

    // Update user record with document metadata
    const documentId = uploadResult.id
    const newDocument = {
      id: documentId,
      type: 'document',
      fileName: validation.sanitizedFilename,
      originalFileName: file.name,
      year,
      uploadedAt: new Date().toISOString(),
      uploadedBy: admin.id,
      storagePath: uploadResult.path
    }

    const documents = user.documents || []
    documents.push(newDocument)

    await updateUser(user.id, { documents })

    // Send email notification
    const emailResult = await sendDocumentNotification({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`
      },
      document: newDocument,
      emailSent: emailResult.success
    })

  } catch (error) {
    console.error('Single upload error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

