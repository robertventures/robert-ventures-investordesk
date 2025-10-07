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

// Create a Date object representing 9:00 AM Eastern Time on a specific calendar date
// All distributions happen at 9:00 AM Eastern Time (EST/EDT) regardless of investor time zones
// This function properly handles the UTC offset for Eastern Time
const createEasternTime9AM = (year, month, day) => {
  // Strategy: Create a date at noon UTC on the target date, then use Intl to find 
  // what time it is in Eastern. Calculate the offset, then adjust to get 9 AM Eastern.
  
  // Create a reference time on the target date (using noon to avoid date boundary issues)
  const refDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
  
  // Format it in Eastern Time to determine the UTC offset on this date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  const easternString = formatter.format(refDate)
  // Format is "MM/DD/YYYY, HH:MM"
  const match = easternString.match(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+)/)
  if (!match) {
    // Fallback: assume EST (UTC-5)
    return new Date(Date.UTC(year, month - 1, day, 14, 0, 0, 0))
  }
  
  const [_, monthET, dayET, yearET, hourET, minET] = match
  
  // refDate is at 12:00 UTC, which appears as hourET:minET in Eastern
  // Calculate offset in hours
  const utcHour = 12
  const easternHour = parseInt(hourET)
  const offsetHours = utcHour - easternHour
  
  // 9 AM Eastern = (9 + offsetHours) UTC
  // EST: offset = 5, so 9 AM EST = 14:00 UTC
  // EDT: offset = 4, so 9 AM EDT = 13:00 UTC
  return new Date(Date.UTC(year, month - 1, day, 9 + offsetHours, 0, 0, 0))
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

        // Rejected event (status = rejected)
        if (inv.status === 'rejected' && inv.rejectedAt) {
          ensureEvent({
            id: generateTransactionId('INV', invId, 'investment_rejected'),
            type: 'investment_rejected',
            investmentId: invId,
            amount,
            lockupPeriod: lockup,
            paymentFrequency: payFreq,
            date: inv.rejectedAt
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
          // CRITICAL: Distributions are paid on the 1st of the NEXT month after accrual period ends
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
            
            // Distribution date is explicitly set to the 1st of the NEXT month at 9:00 AM Eastern Time
            // This ensures consistency across all time zones - all distributions happen at 9:00 AM EST/EDT
            const segmentEndDate = new Date(segment.end)
            // Calculate the year and month for the 1st of the NEXT month
            const nextYear = segmentEndDate.getUTCMonth() === 11 ? 
              segmentEndDate.getUTCFullYear() + 1 : 
              segmentEndDate.getUTCFullYear()
            const nextMonth = segmentEndDate.getUTCMonth() === 11 ? 1 : segmentEndDate.getUTCMonth() + 2
            
            // Create the distribution date at 9:00 AM Eastern Time on the 1st
            const distributionDate = createEasternTime9AM(nextYear, nextMonth, 1)
            const eventId = generateTransactionId('INV', invId, 'monthly_distribution', { date: distributionDate })
            
            // TESTING MODE: All payouts require admin approval
            // In production, admin must manually approve all monthly payouts
            // This ensures proper oversight and compliance
            let payoutStatus = 'pending'
            let failureReason = 'Awaiting admin approval'
            
            // For testing: Use mock bank details if no real bank is configured
            if (!payoutBankId) {
              payoutBankId = 'MOCK-BANK-001'
              payoutBankNickname = 'Test Bank Account (Mock)'
            }
            
            ensureEvent({
              id: eventId,
              type: 'monthly_distribution',
              investmentId: invId,
              amount: Math.round(distributionAmount * 100) / 100,
              lockupPeriod: lockup,
              paymentFrequency: payFreq,
              date: distributionDate.toISOString(),
              displayDate: distributionDate.toISOString(),
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
          // CRITICAL: Compounding happens on the 1st of the NEXT month after accrual period ends
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
            
            // Compounding date is explicitly set to the 1st of the NEXT month at 9:00 AM Eastern Time
            // This ensures consistency across all time zones - all compounding happens at 9:00 AM EST/EDT
            const segmentEndDate = new Date(segment.end)
            // Calculate the year and month for the 1st of the NEXT month
            const nextYear = segmentEndDate.getUTCMonth() === 11 ? 
              segmentEndDate.getUTCFullYear() + 1 : 
              segmentEndDate.getUTCFullYear()
            const nextMonth = segmentEndDate.getUTCMonth() === 11 ? 1 : segmentEndDate.getUTCMonth() + 2
            
            // Create the compounding date at 9:00 AM Eastern Time on the 1st
            const compoundingDate = createEasternTime9AM(nextYear, nextMonth, 1)
            const eventId = generateTransactionId('INV', invId, 'monthly_compounded', { date: compoundingDate })
            ensureEvent({
              id: eventId,
              type: 'monthly_compounded',
              investmentId: invId,
              amount: Math.round(interest * 100) / 100,
              lockupPeriod: lockup,
              paymentFrequency: payFreq,
              date: compoundingDate.toISOString(),
              displayDate: compoundingDate.toISOString(),
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
