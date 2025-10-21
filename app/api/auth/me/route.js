import { NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '../../../../lib/authMiddleware.js'
import { getUser } from '../../../../lib/supabaseDatabase.js'

export async function GET(request) {
  try {
    // Verify authentication
    const authUser = await requireAuth(request)
    
    if (!authUser) {
      return authErrorResponse('Not authenticated', 401)
    }
    
    // Fetch full user data from Supabase
    const user = await getUser(authUser.userId)
    
    if (!user) {
      return authErrorResponse('User not found', 404)
    }
    
    // Return user data (no sensitive info like password)
    // Convert snake_case to camelCase for frontend compatibility
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phoneNumber: user.phone_number,
        dob: user.dob,
        isAdmin: user.is_admin || false,
        isVerified: user.is_verified || false,
        verifiedAt: user.verified_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        investments: user.investments || [],
        activity: user.activity || []
      }
    })
  } catch (error) {
    console.error('Error in GET /api/auth/me:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

