import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../lib/database'
import { getCurrentAppTime } from '../../../lib/appTime'
import { generateTransactionId } from '../../../lib/idGenerator'

// Helper functions matching investmentCalculations.js
const MS_PER_DAY = 24 * 60 * 60 * 1000

const toUtcStartOfDay = (value) => {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const addDaysUtc = (date, days) => {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

const getDaysInMonthUtc = (date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

const diffDaysInclusive = (startDate, endDate) => {
  return Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1
}

const buildAccrualSegments = (startDate, endDate) => {
  if (endDate < startDate) return []

  const segments = []
  let cursor = startDate

  const pushPartial = (segmentStart, segmentEnd, daysInMonth) => {
    const days = diffDaysInclusive(segmentStart, segmentEnd)
    segments.push({
      type: 'partial',
      start: segmentStart,
      end: segmentEnd,
      days,
      daysInMonth
    })
  }

  if (cursor.getUTCDate() !== 1) {
    const daysInMonth = getDaysInMonthUtc(cursor)
    const monthEnd = toUtcStartOfDay(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), daysInMonth)))
    const segmentEnd = monthEnd < endDate ? monthEnd : endDate
    pushPartial(cursor, segmentEnd, daysInMonth)
    cursor = addDaysUtc(segmentEnd, 1)
  }

  while (cursor <= endDate) {
    const daysInMonth = getDaysInMonthUtc(cursor)
    const monthEnd = toUtcStartOfDay(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), daysInMonth)))
    if (monthEnd <= endDate) {
      segments.push({
        type: 'full',
        start: cursor,
        end: monthEnd,
        days: daysInMonth,
        daysInMonth
      })
      cursor = addDaysUtc(monthEnd, 1)
    } else {
      pushPartial(cursor, endDate, daysInMonth)
      break
    }
  }

  return segments
}

// POST - Generate and persist transaction events for users (idempotent per period)
// - investment_created
// - investment_confirmed
// - monthly_distribution (for monthly payout investments, prorated first month)
// - monthly_compounded (for compounding investments, prorated first month, compounding principal)
// - withdrawal_requested (mirrors user.withdrawals)
export async function POST() {
  try {
    const usersData = await getUsers()
    const appTime = await getCurrentAppTime()
    const now = new Date(appTime || new Date().toISOString())

    let usersUpdated = 0
    let eventsCreated = 0

    for (const user of usersData.users) {
      const investments = Array.isArray(user.investments) ? user.investments : []
      const withdrawals = Array.isArray(user.withdrawals) ? user.withdrawals : []

      if (!Array.isArray(user.activity)) {
        user.activity = []
      }

      // Remove any future-dated generated events if app time moved backwards
      // Also prune events tied to investments that no longer exist
      const existingInvestmentIds = new Set((investments || []).map(i => i.id))
      user.activity = user.activity.filter(ev => {
        if (!ev || !ev.date) return true
        const evDate = new Date(ev.date)
        if (evDate > now) return false
        // If this event references an investment that is gone, drop it
        if (ev.investmentId && !existingInvestmentIds.has(ev.investmentId)) return false
        return true
      })

      const existingIds = new Set(user.activity.map(t => t.id))
      const ensureEvent = (event) => {
        if (!existingIds.has(event.id)) {
          user.activity.push(event)
          existingIds.add(event.id)
          eventsCreated++
          return true
        }
        return false
      }

      // Account created event (always present when user.createdAt exists)
      if (user.createdAt) {
        ensureEvent({
          id: generateTransactionId('USR', user.id, 'account_created'),
          type: 'account_created',
          date: user.createdAt
        })
      }

      // Investment events
      for (const inv of investments) {
        const invId = inv.id
        const amount = inv.amount || 0
        const lockup = inv.lockupPeriod
        const payFreq = inv.paymentFrequency

        // Created event: only for non-draft investments
        if (inv.status !== 'draft' && inv.createdAt) {
          ensureEvent({
            id: generateTransactionId('INV', invId, 'investment_created'),
            type: 'investment_created',
            investmentId: invId,
            amount,
            lockupPeriod: lockup,
            paymentFrequency: payFreq,
            date: inv.createdAt
          })
        }

        // Confirmed event (status = active)
        if (inv.status === 'active' && inv.confirmedAt) {
          ensureEvent({
            id: generateTransactionId('INV', invId, 'investment_confirmed'),
            type: 'investment_confirmed',
            investmentId: invId,
            amount,
            lockupPeriod: lockup,
            paymentFrequency: payFreq,
            date: inv.confirmedAt
          })
        }

        // Monthly distributions for monthly payout investments (prorated first month)
        if (inv.status === 'active' && inv.paymentFrequency === 'monthly' && inv.confirmedAt) {
          const confirmedDate = new Date(inv.confirmedAt)
          // Interest starts accruing from the day AFTER confirmation
          const accrualStartDate = addDaysUtc(toUtcStartOfDay(confirmedDate), 1)

          const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
          const monthlyRate = annualRate / 12
          
          // Resolve payout destination and check bank connection status
          const payoutMethod = user?.banking?.payoutMethod || 'bank-account'
          const investmentBank = inv?.banking?.bank
          let payoutBankId = investmentBank?.id || null
          let payoutBankNickname = investmentBank?.nickname || null
          let bankConnectionActive = true
          
          if (!payoutBankId && Array.isArray(user?.bankAccounts) && user?.banking?.defaultBankAccountId) {
            const acct = user.bankAccounts.find(b => b.id === user.banking.defaultBankAccountId)
            if (acct) {
              payoutBankId = acct.id
              payoutBankNickname = acct.nickname || 'Primary Account'
              // Check if bank account has connection issues
              bankConnectionActive = acct.connectionStatus !== 'disconnected' && acct.connectionStatus !== 'error'
            }
          }
          
          // If investment has specific bank info, check its connection status
          if (investmentBank) {
            bankConnectionActive = investmentBank.connectionStatus !== 'disconnected' && investmentBank.connectionStatus !== 'error'
          }
          
          // Find all completed month-end boundaries
          const completedMonthEnds = []
          let cursor = new Date(accrualStartDate)
          
          while (true) {
            const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
            if (monthEnd >= now) break
            completedMonthEnds.push(monthEnd)
            cursor = addDaysUtc(monthEnd, 1)
          }
          
          if (completedMonthEnds.length === 0) continue
          
          // Build segments up to the last completed month end
          const lastCompletedMonthEnd = completedMonthEnds[completedMonthEnds.length - 1]
          const segments = buildAccrualSegments(accrualStartDate, lastCompletedMonthEnd)
          
          // Generate distribution events for each segment
          // Distributions are paid on the 1st of the following month
          let monthIndex = 1
          segments.forEach(segment => {
            const monthlyInterest = (inv.amount || 0) * monthlyRate
            let distributionAmount = 0
            
            if (segment.type === 'full') {
              distributionAmount = monthlyInterest
            } else {
              const prorated = monthlyInterest * (segment.days / segment.daysInMonth)
              distributionAmount = prorated
            }
            
            // Distribution date is the 1st of the month AFTER the segment ends
            const distributionDate = addDaysUtc(segment.end, 1)
            const eventId = generateTransactionId('INV', invId, 'monthly_distribution', { date: distributionDate })
            
            // Determine payout status based on bank connection
            let payoutStatus = 'completed'
            let failureReason = null
            
            if (!bankConnectionActive) {
              payoutStatus = 'pending'
              failureReason = 'Bank account connection lost or misconfigured'
            } else if (!payoutBankId) {
              payoutStatus = 'pending'
              failureReason = 'No payout bank account configured'
            }
            
            ensureEvent({
              id: eventId,
              type: 'monthly_distribution',
              investmentId: invId,
              amount: Math.round(distributionAmount * 100) / 100,
              lockupPeriod: lockup,
              paymentFrequency: payFreq,
              date: distributionDate.toISOString(),
              monthIndex,
              payoutMethod,
              payoutBankId,
              payoutBankNickname,
              payoutStatus,
              failureReason,
              retryCount: 0
            })
            
            monthIndex += 1
          })
        }

        // Monthly compounding events (prorated first month, compounding principal)
        if (inv.status === 'active' && inv.paymentFrequency === 'compounding' && inv.confirmedAt) {
          const confirmedDate = new Date(inv.confirmedAt)
          // Interest starts accruing from the day AFTER confirmation
          const accrualStartDate = addDaysUtc(toUtcStartOfDay(confirmedDate), 1)

          const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
          const monthlyRate = annualRate / 12
          
          // Find all completed month-end boundaries
          const completedMonthEnds = []
          let cursor = new Date(accrualStartDate)
          
          while (true) {
            const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
            if (monthEnd >= now) break
            completedMonthEnds.push(monthEnd)
            cursor = addDaysUtc(monthEnd, 1)
          }
          
          if (completedMonthEnds.length === 0) continue
          
          // Build segments up to the last completed month end
          const lastCompletedMonthEnd = completedMonthEnds[completedMonthEnds.length - 1]
          const segments = buildAccrualSegments(accrualStartDate, lastCompletedMonthEnd)
          
          // Generate compounding events for each segment
          // Compounding happens on the 1st of the following month
          let monthIndex = 1
          let balance = amount
          
          segments.forEach(segment => {
            let interest = 0
            
            if (segment.type === 'full') {
              interest = balance * monthlyRate
            } else {
              const dailyRate = monthlyRate / segment.daysInMonth
              interest = balance * dailyRate * segment.days
            }
            
            // Compounding date is the 1st of the month AFTER the segment ends
            const compoundingDate = addDaysUtc(segment.end, 1)
            const eventId = generateTransactionId('INV', invId, 'monthly_compounded', { date: compoundingDate })
            ensureEvent({
              id: eventId,
              type: 'monthly_compounded',
              investmentId: invId,
              amount: Math.round(interest * 100) / 100,
              lockupPeriod: lockup,
              paymentFrequency: payFreq,
              date: compoundingDate.toISOString(),
              monthIndex,
              principal: Math.round(balance * 100) / 100
            })

            // Compound the interest into balance for next period
            balance += interest
            monthIndex += 1
          })
        }
      }

      // Mirror withdrawals as events based on status
      for (const wd of withdrawals) {
        if (!wd || !wd.id) continue
        const base = {
          investmentId: wd.investmentId,
          amount: wd.amount || 0
        }
        if (wd.status === 'notice') {
          ensureEvent({
            id: generateTransactionId('WDL', wd.id, 'withdrawal_notice_started'),
            type: 'withdrawal_notice_started',
            ...base,
            date: wd.noticeStartAt || wd.requestedAt || new Date().toISOString(),
            payoutDueBy: wd.payoutDueBy || null
          })
        } else if (wd.status === 'approved') {
          ensureEvent({
            id: generateTransactionId('WDL', wd.id, 'withdrawal_approved'),
            type: 'withdrawal_approved',
            ...base,
            date: wd.approvedAt || wd.paidAt || new Date().toISOString()
          })
        } else if (wd.status === 'rejected') {
          ensureEvent({
            id: generateTransactionId('WDL', wd.id, 'withdrawal_rejected'),
            type: 'withdrawal_rejected',
            ...base,
            date: wd.rejectedAt || new Date().toISOString()
          })
        } else {
          ensureEvent({
            id: generateTransactionId('WDL', wd.id, 'withdrawal_requested'),
            type: 'withdrawal_requested',
            ...base,
            date: wd.requestedAt || new Date().toISOString(),
            status: wd.status || 'pending'
          })
        }
      }

      if (eventsCreated > 0) {
        user.updatedAt = new Date().toISOString()
        usersUpdated++
      }
    }

    if (eventsCreated > 0) {
      const saved = await saveUsers(usersData)
      if (!saved) {
        return NextResponse.json({ success: false, error: 'Failed to save transaction events' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, usersUpdated, eventsCreated })
  } catch (error) {
    console.error('Error migrating transactions:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
