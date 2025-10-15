import { NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '../../../../lib/authMiddleware.js'
import { getUsers } from '../../../../lib/database.js'

export async function GET(request) {
  try {
    // Verify authentication
    const authUser = await requireAuth(request)
    
    if (!authUser) {
      return authErrorResponse('Not authenticated', 401)
    }
    
    // Fetch full user data from database
    const usersData = await getUsers()
    const user = usersData.users.find(u => u.id === authUser.userId)
    
    if (!user) {
      return authErrorResponse('User not found', 404)
    }
    
    // Return user data (no sensitive info like password)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        dob: user.dob,
        address: user.address,
        isAdmin: user.isAdmin || false,
        isVerified: user.isVerified || false,
        verifiedAt: user.verifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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

