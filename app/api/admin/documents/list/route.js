import { NextResponse } from 'next/server'
import { getUsers } from '../../../../../lib/database'

/**
 * GET /api/admin/documents/list
 * 
 * List all documents across all users (admin only)
 * Optionally filter by year or type
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const adminEmail = searchParams.get('adminEmail')
    const year = searchParams.get('year')
    const type = searchParams.get('type')

    // Verify admin authentication
    const usersData = await getUsers()
    const adminUser = usersData.users.find(u => u.email === adminEmail && u.isAdmin)
    
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const allDocuments = []

    for (const user of usersData.users) {
      if (user.isAdmin) continue // Skip admin users
      if (!user.documents || user.documents.length === 0) continue

      let userDocs = user.documents

      // Apply filters
      if (year) {
        userDocs = userDocs.filter(d => d.year === year)
      }
      if (type) {
        userDocs = userDocs.filter(d => d.type === type)
      }

      for (const doc of userDocs) {
        allDocuments.push({
          ...doc,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          }
        })
      }
    }

    // Sort by upload date (most recent first)
    allDocuments.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )

    return NextResponse.json({
      success: true,
      documents: allDocuments,
      total: allDocuments.length
    })

  } catch (error) {
    console.error('List documents error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

