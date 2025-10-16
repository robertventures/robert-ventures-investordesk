import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { clearAuthCookies } from '../../../../lib/authMiddleware.js'

export async function POST(request) {
  try {
    const supabase = createServiceClient()

    // Get token from header if present
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      
      // Sign out from Supabase
      await supabase.auth.admin.signOut(token)
    }
    
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    // Clear JWT authentication cookies
    clearAuthCookies(response)
    
    return response
  } catch (error) {
    console.error('Error in POST /api/auth/logout:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

