import { NextResponse } from 'next/server'
import { clearAuthCookies } from '../../../../lib/authMiddleware.js'

export async function POST(request) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })
    
    // Clear authentication cookies
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

