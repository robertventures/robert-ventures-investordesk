import { NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware.js'
import { getUser } from '../../../../lib/supabaseDatabase.js'

/**
 * POST /api/admin/send-onboarding-email
 * Generate onboarding setup link for admin-created user
 * Admin only
 * 
 * Note: Email sending is disabled for now - returns the link instead
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const { userId, token } = await request.json()

    if (!userId || !token) {
      return NextResponse.json(
        { success: false, error: 'User ID and token are required' },
        { status: 400 }
      )
    }

    // Get user details
    const user = await getUser(userId)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Build setup link
    const setupLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding?token=${token}`

    // TODO: Send email when email service is configured
    // For now, just return the link so admin can share it manually
    console.log(`📧 Setup link generated for ${user.email}: ${setupLink}`)

    return NextResponse.json({
      success: true,
      message: 'Setup link generated successfully',
      setupLink: setupLink,
      userEmail: user.email
    })

  } catch (error) {
    console.error('Error generating setup link:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate setup link' },
      { status: 500 }
    )
  }
}

