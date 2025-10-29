import { NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware.js'
import { getAuditLogs, queryAuditLogs, AUDIT_EVENTS } from '../../../../lib/auditLog.js'

/**
 * GET /api/admin/audit-logs
 * Retrieve audit logs with optional filtering
 * Query params:
 *   - eventType: Filter by event type
 *   - targetUserId: Filter by target user
 *   - startDate: Filter by start date
 *   - endDate: Filter by end date
 *   - severity: Filter by severity (low, medium, high, critical)
 *   - limit: Maximum number of logs to return (default: 100)
 */
export async function GET(request) {
  try {
    // Require admin authentication
    const admin = await requireAdmin(request)

    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const { searchParams } = new URL(request.url)

    // Build query filters
    const filters = {}

    if (searchParams.get('eventType')) {
      filters.eventType = searchParams.get('eventType')
    }

    if (searchParams.get('targetUserId')) {
      filters.targetUserId = searchParams.get('targetUserId')
    }

    if (searchParams.get('startDate')) {
      filters.startDate = searchParams.get('startDate')
    }

    if (searchParams.get('endDate')) {
      filters.endDate = searchParams.get('endDate')
    }

    if (searchParams.get('severity')) {
      filters.severity = searchParams.get('severity')
    }

    // Default limit to 100, max 1000
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    filters.limit = limit

    // Query audit logs with filters
    const logs = await queryAuditLogs(filters)

    // Get summary statistics
    const auditData = await getAuditLogs()
    const totalLogs = auditData.logs.length

    // Count by event type
    const eventTypeCounts = {}
    auditData.logs.forEach(log => {
      eventTypeCounts[log.eventType] = (eventTypeCounts[log.eventType] || 0) + 1
    })

    // Count by severity
    const severityCounts = {}
    auditData.logs.forEach(log => {
      severityCounts[log.severity] = (severityCounts[log.severity] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        returned: logs.length,
        limit: limit,
        total: totalLogs
      },
      summary: {
        totalLogs,
        eventTypeCounts,
        severityCounts,
        oldestLog: auditData.logs[0]?.timestamp || null,
        newestLog: auditData.logs[auditData.logs.length - 1]?.timestamp || null
      },
      availableEventTypes: Object.values(AUDIT_EVENTS)
    })
  } catch (error) {
    console.error('Error in GET /api/admin/audit-logs:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
