import { NextResponse } from 'next/server'
import { verifyRefreshToken, signToken } from '../../../../lib/auth.js'
import { getUser } from '../../../../lib/supabaseDatabase.js'

export async function POST(request) {
  try {
    // Extract refresh token from cookies
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) {
      return NextResponse.json(
        { success: false, error: 'No refresh token provided' },
        { status: 401 }
      )
    }
    
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {})
    
    const refreshToken = cookies['refresh-token']
    
    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'No refresh token provided' },
        { status: 401 }
      )
    }
    
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken)
    
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }
    
    // Fetch user from Supabase to ensure they still exist
    const dbUser = await getUser(payload.userId)
    
    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Generate new access token (convert snake_case to camelCase for signToken)
    const newAccessToken = signToken({
      id: dbUser.id,
      email: dbUser.email,
      isAdmin: dbUser.is_admin || false
    })
    
    // Create response and set new access token cookie
    const response = NextResponse.json({
      success: true,
      message: 'Token refreshed successfully'
    })
    
    response.cookies.set('auth-token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    return response
  } catch (error) {
    console.error('Error in POST /api/auth/refresh:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

