import { NextResponse } from 'next/server'
import { getUsers, updateUser, saveUsers } from '../../../../../lib/supabaseDatabase.js'
import { deleteDocument } from '../../../../../lib/supabaseStorage'
import { requireAdmin, authErrorResponse } from '../../../../../lib/authMiddleware'

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

    const usersData = await getUsers()

    if (mode === 'single') {
      // Delete single document for a specific user
      if (!userId || !documentId) {
        return NextResponse.json(
          { success: false, error: 'userId and documentId required for single mode' },
          { status: 400 }
        )
      }

      const user = usersData.users.find(u => u.id === userId)
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }

      const docIndex = user.documents?.findIndex(d => d.id === documentId)
      if (docIndex === -1 || docIndex === undefined) {
        return NextResponse.json(
          { success: false, error: 'Document not found' },
          { status: 404 }
        )
      }

      const document = user.documents[docIndex]

      // Delete from Supabase Storage
      // Use storagePath if available (new), otherwise fallback to blobKey (legacy)
      const storagePath = document.storagePath || document.blobKey
      await deleteDocument(storagePath)

      // Remove from user record
      user.documents.splice(docIndex, 1)
      await updateUser(user.id, { documents: user.documents })

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

      for (const user of usersData.users) {
        if (!user.documents || user.documents.length === 0) continue

        const docs = user.documents.filter(d => d.type === 'document')

        for (const doc of docs) {
          try {
            // Delete from Supabase Storage
            // Use storagePath if available (new), otherwise fallback to blobKey (legacy)
            const storagePath = doc.storagePath || doc.blobKey
            await deleteDocument(storagePath)

            // Remove from user's documents
            user.documents = user.documents.filter(d => d.id !== doc.id)

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
      }

      // Save all user updates
      await saveUsers(usersData)

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

