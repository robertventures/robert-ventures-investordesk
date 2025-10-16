import { NextResponse } from 'next/server'
import { getUsers, updateUser } from '../../../../../lib/supabaseDatabase.js'
import { uploadDocument, generateDocumentKey, isPDF } from '../../../../../lib/documentStorage'
import { sendDocumentNotification } from '../../../../../lib/emailService'
import { generateTransactionId } from '../../../../../lib/idGenerator'
import { requireAdmin, authErrorResponse } from '../../../../../lib/authMiddleware'

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
    
    // Read and validate PDF
    const arrayBuffer = await file.arrayBuffer()
    
    if (!isPDF(arrayBuffer)) {
      return NextResponse.json(
        { success: false, error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    // Upload to blob storage
    const blobKey = generateDocumentKey('documents', year, user.id, file.name)
    const uploadResult = await uploadDocument(blobKey, arrayBuffer, 'application/pdf')

    if (!uploadResult.success) {
      return NextResponse.json(
        { success: false, error: uploadResult.error },
        { status: 500 }
      )
    }

    // Update user record
    const documentId = generateTransactionId('DOC', user.id, 'document')
    const newDocument = {
      id: documentId,
      type: 'document',
      fileName: file.name,
      year,
      uploadedAt: new Date().toISOString(),
      uploadedBy: adminUser.id,
      blobKey
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

