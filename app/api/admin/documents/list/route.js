import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseClient'

/**
 * GET /api/admin/documents/list
 * Get list of documents for admin
 * Query params:
 *   - adminEmail: Email of admin making request
 *   - type: Type of document (e.g., 'document')
 */
export async function GET(request) {
  try {
    const supabase = createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const adminEmail = searchParams.get('adminEmail')
    const type = searchParams.get('type') || 'document'
    
    // Verify admin access
    if (adminEmail) {
      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('email', adminEmail)
        .single()
      
      if (adminError || !adminUser?.is_admin) {
        return NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        )
      }
    }
    
    // Query documents table
    // Note: Adjust table name and columns based on your actual schema
    // Common schema: documents table with user_id, file_name, uploaded_at, etc.
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select(`
        *,
        user:users!documents_user_id_fkey (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('type', type)
      .order('uploaded_at', { ascending: false })
    
    if (documentsError) {
      console.error('Error fetching documents:', documentsError)
      
      // If documents table doesn't exist, return empty array
      // This allows the UI to work even if documents feature isn't set up yet
      if (documentsError.code === 'PGRST116' || documentsError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          documents: []
        })
      }
      
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }
    
    // Convert to camelCase format expected by frontend
    const formattedDocuments = (documents || []).map(doc => ({
      id: doc.id,
      fileName: doc.file_name || doc.fileName,
      uploadedAt: doc.uploaded_at || doc.uploadedAt,
      type: doc.type,
      userId: doc.user_id || doc.userId,
      user: doc.user ? {
        id: doc.user.id,
        email: doc.user.email,
        firstName: doc.user.first_name || doc.user.firstName,
        lastName: doc.user.last_name || doc.user.lastName
      } : null
    }))
    
    return NextResponse.json({
      success: true,
      documents: formattedDocuments
    })
  } catch (error) {
    console.error('Get documents error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

