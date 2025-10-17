import { NextResponse } from 'next/server'
import { getUsers, updateUser } from '../../../../../lib/supabaseDatabase.js'
import { uploadDocument, isPDF } from '../../../../../lib/supabaseStorage'
import { sendDocumentNotification } from '../../../../../lib/emailService'
import { generateTransactionId } from '../../../../../lib/idGenerator'
import { requireAdmin, authErrorResponse } from '../../../../../lib/authMiddleware'

/**
 * POST /api/admin/documents/assign-pending
 * 
 * Manually assign a pending document to a specific user
 * Used for duplicate name scenarios or manual corrections
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const body = await request.json()
    const { userId, fileName, pdfData } = body

    if (!userId || !fileName || !pdfData) {
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
    
    // Decode base64 PDF data
    const buffer = Buffer.from(pdfData, 'base64')
    
    // Validate PDF
    if (!isPDF(buffer)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PDF file' },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const uploadResult = await uploadDocument(
      user.id,
      fileName,
      buffer,
      'application/pdf',
      {
        documentType: 'document',
        uploadedBy: adminUser.id,
        year: year
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
      fileName,
      year,
      uploadedAt: new Date().toISOString(),
      uploadedBy: adminUser.id,
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
        email: user.email
      },
      emailSent: emailResult.success
    })

  } catch (error) {
    console.error('Assign pending document error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

