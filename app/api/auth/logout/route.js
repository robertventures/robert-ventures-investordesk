import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseClient.js'

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
    
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/auth/logout:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

