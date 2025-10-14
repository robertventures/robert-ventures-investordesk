import { NextResponse } from 'next/server'
import { getUsers, updateUser } from '../../../../../lib/database'
import { uploadDocument, generateDocumentKey, isPDF } from '../../../../../lib/documentStorage'
import { sendTaxDocumentNotification } from '../../../../../lib/emailService'
import { generateTransactionId } from '../../../../../lib/idGenerator'

/**
 * POST /api/admin/documents/assign-pending
 * 
 * Manually assign a pending document to a specific user
 * Used for duplicate name scenarios or manual corrections
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { userId, fileName, pdfData, adminEmail } = body

    if (!userId || !fileName || !pdfData) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Auto-set year to current year for organizational purposes
    const year = new Date().getFullYear().toString()

    // Verify admin authentication
    const usersData = await getUsers()
    const adminUser = usersData.users.find(u => u.email === adminEmail && u.isAdmin)
    
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    // Upload to blob storage
    const blobKey = generateDocumentKey('tax-documents', year, user.id, fileName)
    const uploadResult = await uploadDocument(blobKey, buffer, 'application/pdf')

    if (!uploadResult.success) {
      return NextResponse.json(
        { success: false, error: uploadResult.error },
        { status: 500 }
      )
    }

    // Update user record
    const documentId = generateTransactionId('DOC', user.id, 'tax_document')
    const newDocument = {
      id: documentId,
      type: 'tax_document',
      fileName,
      year,
      uploadedAt: new Date().toISOString(),
      uploadedBy: adminUser.id,
      blobKey
    }

    const documents = user.documents || []
    documents.push(newDocument)

    await updateUser(user.id, { documents })

    // Send email notification
    const emailResult = await sendTaxDocumentNotification({
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

