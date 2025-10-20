import { NextResponse } from 'next/server'
import { updateUser } from '../../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../../lib/supabaseClient.js'
import { deleteDocument } from '../../../../../lib/supabaseStorage.js'
import { requireAdmin, authErrorResponse } from '../../../../../lib/authMiddleware.js'

/**
 * POST /api/admin/documents/delete
 * 
 * Delete documents
 * Supports: single user document, all documents
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const body = await request.json()
    const { mode, userId, documentId, year } = body

    if (!mode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    if (mode === 'single') {
      // Delete single document for a specific user
      if (!userId || !documentId) {
        return NextResponse.json(
          { success: false, error: 'userId and documentId required for single mode' },
          { status: 400 }
        )
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, documents')
        .eq('id', userId)
        .maybeSingle()
      
      if (userError || !user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }

      const documents = user.documents || []
      const docIndex = documents.findIndex(d => d.id === documentId)
      
      if (docIndex === -1) {
        return NextResponse.json(
          { success: false, error: 'Document not found' },
          { status: 404 }
        )
      }

      const document = documents[docIndex]

      // Delete from Supabase Storage
      const storagePath = document.storagePath || document.blobKey
      await deleteDocument(storagePath)

      // Remove from user record
      documents.splice(docIndex, 1)
      await updateUser(user.id, { documents })

      return NextResponse.json({
        success: true,
        message: 'Document deleted successfully',
        deleted: {
          userId: user.id,
          documentId: document.id,
          fileName: document.fileName
        }
      })

    } else if (mode === 'all') {
      // Delete all documents
      const deletedDocs = []
      const errors = []

      // Get all users with documents
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, documents')
        .not('documents', 'is', null)

      if (usersError) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch users' },
          { status: 500 }
        )
      }

      for (const user of (users || [])) {
        if (!user.documents || user.documents.length === 0) continue

        const docs = user.documents.filter(d => d.type === 'document')
        const updatedDocuments = user.documents.filter(d => d.type !== 'document')

        for (const doc of docs) {
          try {
            // Delete from Supabase Storage
            const storagePath = doc.storagePath || doc.blobKey
            await deleteDocument(storagePath)

            deletedDocs.push({
              userId: user.id,
              email: user.email,
              documentId: doc.id,
              fileName: doc.fileName
            })
          } catch (error) {
            errors.push({
              userId: user.id,
              documentId: doc.id,
              error: error.message
            })
          }
        }

        // Update user's documents in database
        await supabase
          .from('users')
          .update({ documents: updatedDocuments })
          .eq('id', user.id)
      }

      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedDocs.length} documents`,
        deleted: deletedDocs,
        errors: errors.length > 0 ? errors : undefined
      })

    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Use "single" or "all"' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

