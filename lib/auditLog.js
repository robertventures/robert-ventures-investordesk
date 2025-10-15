/**
 * Audit Logging System
 *
 * Tracks security-sensitive actions like master password usage,
 * admin impersonation, and other privileged operations.
 *
 * IMPORTANT: For production compliance (SOC 2, HIPAA), consider:
 * - Storing logs in immutable append-only storage
 * - Sending logs to external service (e.g., Datadog, Splunk)
 * - Encrypting sensitive audit data
 */

import fs from 'fs'
import path from 'path'
import { getStore } from '@netlify/blobs'

const dataDir = path.join(process.cwd(), 'data')
const auditLogFile = path.join(dataDir, 'audit-log.json')
const isNetlify = process.env.NETLIFY === 'true'
const useBlobs = isNetlify || process.env.NODE_ENV === 'production'

// Audit event types
export const AUDIT_EVENTS = {
  MASTER_PASSWORD_GENERATED: 'master_password_generated',
  MASTER_PASSWORD_LOGIN: 'master_password_login',
  MASTER_PASSWORD_FAILED: 'master_password_failed',
  ADMIN_IMPERSONATION: 'admin_impersonation',
  USER_DELETED: 'user_deleted',
  SENSITIVE_DATA_ACCESS: 'sensitive_data_access',
  SECURITY_SETTING_CHANGED: 'security_setting_changed'
}

/**
 * Initialize audit log storage
 */
async function initializeAuditLog() {
  if (!useBlobs) {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      if (!fs.existsSync(auditLogFile)) {
        fs.writeFileSync(auditLogFile, JSON.stringify({ logs: [] }, null, 2))
        console.log('Audit log initialized at:', auditLogFile)
      }
    } catch (error) {
      console.error('Error initializing audit log:', error)
    }
  }
}

/**
 * Get blob store for audit logs
 */
function getBlobStore() {
  return getStore({ name: 'users' })
}

/**
 * Read audit logs
 * @returns {object} - Audit log data
 */
export async function getAuditLogs() {
  try {
    if (useBlobs) {
      const store = getBlobStore()
      let data = await store.get('audit-log.json', { type: 'json' })
      if (!data && typeof store.getJSON === 'function') {
        try {
          data = await store.getJSON('audit-log.json')
        } catch (e) {
          console.log('No audit log found, creating new one')
        }
      }
      return data || { logs: [] }
    }

    await initializeAuditLog()
    const data = fs.readFileSync(auditLogFile, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading audit logs:', error)
    return { logs: [] }
  }
}

/**
 * Save audit logs
 * @param {object} auditData - Audit log data
 * @returns {boolean} - Success status
 */
async function saveAuditLogs(auditData) {
  try {
    if (useBlobs) {
      const store = getBlobStore()
      if (typeof store.setJSON === 'function') {
        await store.setJSON('audit-log.json', auditData)
      } else {
        await store.set('audit-log.json', JSON.stringify(auditData, null, 2), {
          contentType: 'application/json'
        })
      }
      return true
    }

    await initializeAuditLog()
    fs.writeFileSync(auditLogFile, JSON.stringify(auditData, null, 2))
    return true
  } catch (error) {
    console.error('Error saving audit logs:', error)
    return false
  }
}

/**
 * Log an audit event
 * @param {object} event - Audit event details
 * @returns {Promise<boolean>} - Success status
 */
export async function logAuditEvent(event) {
  try {
    const auditData = await getAuditLogs()

    const auditEntry = {
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      eventType: event.eventType,
      actorId: event.actorId || null,
      actorEmail: event.actorEmail || null,
      actorIP: event.actorIP || null,
      targetUserId: event.targetUserId || null,
      targetEmail: event.targetEmail || null,
      action: event.action || '',
      details: event.details || {},
      severity: event.severity || 'medium', // low, medium, high, critical
      metadata: {
        userAgent: event.userAgent || null,
        ...event.metadata
      }
    }

    auditData.logs.push(auditEntry)

    // Keep only last 10,000 logs to prevent unbounded growth
    // In production, archive old logs to external storage
    if (auditData.logs.length > 10000) {
      auditData.logs = auditData.logs.slice(-10000)
    }

    const saved = await saveAuditLogs(auditData)

    if (saved) {
      // Also log to console for immediate visibility
      console.log('🔐 AUDIT:', auditEntry.eventType, '|',
        `Actor: ${auditEntry.actorEmail || auditEntry.actorId || 'unknown'}`,
        `Target: ${auditEntry.targetEmail || auditEntry.targetUserId || 'none'}`)
      return true
    }

    return false
  } catch (error) {
    console.error('Failed to log audit event:', error)
    return false
  }
}

/**
 * Log master password usage
 * @param {object} details - Login details
 */
export async function logMasterPasswordLogin(details) {
  return await logAuditEvent({
    eventType: AUDIT_EVENTS.MASTER_PASSWORD_LOGIN,
    actorId: 'admin', // Admin who generated the master password
    actorEmail: 'admin@system',
    actorIP: details.ip,
    targetUserId: details.userId,
    targetEmail: details.userEmail,
    action: 'Admin logged in as user using master password',
    details: {
      loginTime: new Date().toISOString(),
      success: true
    },
    severity: 'high',
    userAgent: details.userAgent,
    metadata: details.metadata || {}
  })
}

/**
 * Log master password generation
 * @param {object} details - Generation details
 */
export async function logMasterPasswordGeneration(details) {
  return await logAuditEvent({
    eventType: AUDIT_EVENTS.MASTER_PASSWORD_GENERATED,
    actorId: details.adminUserId,
    actorEmail: details.adminEmail,
    actorIP: details.ip,
    action: 'Master password generated',
    details: {
      expiresAt: details.expiresAt,
      generatedAt: new Date().toISOString()
    },
    severity: 'high',
    userAgent: details.userAgent,
    metadata: details.metadata || {}
  })
}

/**
 * Query audit logs with filters
 * @param {object} filters - Query filters
 * @returns {array} - Filtered audit logs
 */
export async function queryAuditLogs(filters = {}) {
  const auditData = await getAuditLogs()
  let logs = auditData.logs

  // Filter by event type
  if (filters.eventType) {
    logs = logs.filter(log => log.eventType === filters.eventType)
  }

  // Filter by actor
  if (filters.actorId) {
    logs = logs.filter(log => log.actorId === filters.actorId)
  }

  // Filter by target user
  if (filters.targetUserId) {
    logs = logs.filter(log => log.targetUserId === filters.targetUserId)
  }

  // Filter by date range
  if (filters.startDate) {
    logs = logs.filter(log => new Date(log.timestamp) >= new Date(filters.startDate))
  }

  if (filters.endDate) {
    logs = logs.filter(log => new Date(log.timestamp) <= new Date(filters.endDate))
  }

  // Filter by severity
  if (filters.severity) {
    logs = logs.filter(log => log.severity === filters.severity)
  }

  // Sort by timestamp (newest first)
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  // Limit results
  if (filters.limit) {
    logs = logs.slice(0, filters.limit)
  }

  return logs
}
