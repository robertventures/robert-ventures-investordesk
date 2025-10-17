import { NextResponse } from 'next/server'
import { getUsers } from '../../../../../../lib/supabaseDatabase.js'
import { getDocument, downloadDocument } from '../../../../../../lib/supabaseStorage'

/**
 * GET /api/users/[id]/documents/[docId]
 * 
 * Download a specific document for a user
 * Users can only access their own documents
 */
export async function GET(request, { params }) {
  try {
    const { id: userId, docId } = params
    const { searchParams } = new URL(request.url)
    const requestingUserId = searchParams.get('requestingUserId')

    if (!requestingUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user can only access their own documents
    if (requestingUserId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - can only access your own documents' },
        { status: 403 }
      )
    }

    // Get user data
    const usersData = await getUsers()
    const user = usersData.users.find(u => u.id === userId)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Find document
    const document = user.documents?.find(d => d.id === docId)

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Retrieve document from Supabase Storage
    // Use storagePath if available (new), otherwise fallback to blobKey (legacy)
    const storagePath = document.storagePath || document.blobKey
    const result = await downloadDocument(storagePath)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to retrieve document' },
        { status: 500 }
      )
    }

    // Return PDF file
    return new NextResponse(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.fileName}"`,
      },
    })

  } catch (error) {
    console.error('Document download error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

