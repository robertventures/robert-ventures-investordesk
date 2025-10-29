import { NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware.js'
import { generateMasterPassword, getMasterPasswordInfo } from '../../../../lib/masterPassword.js'
import { logMasterPasswordGeneration } from '../../../../lib/auditLog.js'

export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)

    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    // Generate new master password
    const result = await generateMasterPassword(admin.userId)

    // Log master password generation to audit trail
    await logMasterPasswordGeneration({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      expiresAt: result.expiresAt,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        timestamp: new Date().toISOString()
      }
    })

    return NextResponse.json({
      success: true,
      password: result.password,
      expiresAt: result.expiresAt,
      message: 'Master password generated successfully. This password can be used to login to any investor account for the next 30 minutes.'
    })
  } catch (error) {
    console.error('Error in POST /api/admin/generate-master-password:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }
    
    // Get current master password info (without the actual password)
    const info = await getMasterPasswordInfo()
    
    if (!info) {
      return NextResponse.json({
        success: true,
        hasPassword: false,
        message: 'No master password currently active'
      })
    }
    
    return NextResponse.json({
      success: true,
      hasPassword: true,
      expiresAt: info.expiresAt,
      generatedAt: info.generatedAt,
      isExpired: info.isExpired,
      timeRemainingMs: info.timeRemaining
    })
  } catch (error) {
    console.error('Error in GET /api/admin/generate-master-password:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

