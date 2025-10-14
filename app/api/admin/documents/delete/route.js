import { NextResponse } from 'next/server'
import { getUsers, updateUser, saveUsers } from '../../../../../lib/database'
import { deleteDocument } from '../../../../../lib/documentStorage'

/**
 * POST /api/admin/documents/delete
 * 
 * Delete tax documents
 * Supports: single user document, all documents for a year
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { mode, userId, documentId, year, adminEmail } = body

    if (!mode || !adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify admin authentication
    const usersData = await getUsers()
    const adminUser = usersData.users.find(u => u.email === adminEmail && u.isAdmin)
    
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

      // Delete from blob storage
      await deleteDocument(document.blobKey)

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
      // Delete all tax documents
      const deletedDocs = []
      const errors = []

      for (const user of usersData.users) {
        if (!user.documents || user.documents.length === 0) continue

        const taxDocs = user.documents.filter(d => d.type === 'tax_document')

        for (const doc of taxDocs) {
          try {
            // Delete from blob storage
            await deleteDocument(doc.blobKey)

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
        message: `Deleted ${deletedDocs.length} tax documents`,
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

