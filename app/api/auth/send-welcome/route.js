import { NextResponse } from 'next/server'
import { getUser, updateUser } from '../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { sendWelcomeEmail, sendBulkWelcomeEmails } from '../../../../lib/emailService'
import crypto from 'crypto'

/**
 * Send welcome emails to newly imported investors
 * POST /api/auth/send-welcome
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { adminUserId, userIds, single = false } = body

    // Verify admin access
    const admin = await getUser(adminUserId)
    if (!admin || !admin.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    if (!userIds || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No user IDs provided' },
        { status: 400 }
      )
    }

    // Send emails to each user
    const results = []
    
    for (const userId of userIds) {
      const user = await getUser(userId)
      
      if (!user) {
        results.push({
          userId,
          email: 'unknown',
          success: false,
          error: 'User not found'
        })
        continue
      }

      // Generate password reset token (valid for 24 hours)
      const resetToken = crypto.randomBytes(32).toString('hex')
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      // Update user with reset token
      const updateResult = await updateUser(userId, {
        resetToken,
        resetTokenExpiry: resetTokenExpiry.toISOString()
      })

      if (!updateResult.success) {
        results.push({
          userId,
          email: user.email,
          success: false,
          error: 'Failed to generate reset token'
        })
        continue
      }

      // Send welcome email (convert snake_case to camelCase)
      const emailResult = await sendWelcomeEmail({
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        resetToken
      })

      results.push({
        userId,
        email: user.email,
        ...emailResult
      })

      // Small delay to avoid rate limiting
      if (!single) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      totalSent: successCount,
      totalFailed: failureCount,
      results
    })

  } catch (error) {
    console.error('Error sending welcome emails:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

