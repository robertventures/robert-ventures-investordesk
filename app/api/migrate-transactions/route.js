import { NextResponse } from 'next/server'
import { getUsers } from '../../../lib/supabaseDatabase.js'
import { getCurrentAppTime, getAutoApproveDistributions } from '../../../lib/appTime'
import { generateTransactionId } from '../../../lib/idGenerator'
import { createServiceClient } from '../../../lib/supabaseClient.js'
import { requireAdmin, authErrorResponse } from '../../../lib/authMiddleware'

// Helper functions matching investmentCalculations.js
const MS_PER_DAY = 24 * 60 * 60 * 1000

const toUtcStartOfDay = (value) => {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const addDaysUtc = (date, days) => {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

// Check if a date falls within Eastern Daylight Time (EDT)
// EDT starts second Sunday in March, ends first Sunday in November
const isDateInEDT = (date) => {
  const year = date.getFullYear()
  const month = date.getMonth() // 0-based
  const day = date.getDate()

  // EDT: March (2) to November (10), but check exact boundaries
  if (month < 2 || month > 10) return false // Before March or after November
  if (month > 2 && month < 10) return true  // April through October

  // March: EDT starts on second Sunday
  if (month === 2) {
    const secondSunday = findNthWeekdayOfMonth(year, 2, 0, 2) // Second Sunday in March
    return day >= secondSunday
  }

  // November: EDT ends on first Sunday
  if (month === 10) {
    const firstSunday = findNthWeekdayOfMonth(year, 10, 0, 1) // First Sunday in November
    return day < firstSunday
  }

  return false
}

// Find the nth weekday of a month (0=Sunday, 1=Monday, etc.)
const findNthWeekdayOfMonth = (year, month, weekday, n) => {
  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  const daysToAdd = (weekday - firstWeekday + 7) % 7
  return 1 + daysToAdd + (n - 1) * 7
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
    // Fallback: Calculate correct Eastern Time offset (EST vs EDT)
    // EST (UTC-5): Nov-Mar, EDT (UTC-4): Mar-Nov
    const date = new Date(year, month - 1, day)
    const isDST = isDateInEDT(date)
    const offsetHours = isDST ? 4 : 5  // EDT: UTC-4, EST: UTC-5
    return new Date(Date.UTC(year, month - 1, day, 9 + offsetHours, 0, 0, 0))
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

const mapLegacyPayoutStatus = (status) => {
  if (!status) return 'pending'
  switch (status) {
    case 'completed':
      return 'received'
    case 'failed':
      return 'rejected'
    case 'approved':
      return 'approved'
    default:
      return 'pending'
  }
}

// POST - Generate and persist transaction events for users (idempotent per period)
// - investment_created
// - investment_confirmed
// - monthly_distribution (for monthly payout investments, prorated first month)
// - monthly_compounded (for compounding investments, prorated first month, compounding principal)
// - withdrawal_requested (mirrors user.withdrawals)
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const supabase = createServiceClient()
    const usersData = await getUsers()
    const appTime = await getCurrentAppTime()
    const now = new Date(appTime || new Date().toISOString())
    const autoApproveDistributions = await getAutoApproveDistributions()

    let usersUpdated = 0
    let eventsCreated = 0
    
    // Collect all new activity events to batch insert at the end
    const activityEventsToInsert = []

    let dataMutated = false

    for (const user of usersData.users) {
      const investments = Array.isArray(user.investments) ? user.investments : []
      const withdrawals = Array.isArray(user.withdrawals) ? user.withdrawals : []
      let userTouched = false

      if (!Array.isArray(user.activity)) {
        user.activity = []
      }

      const existingInvestmentIds = new Set(investments.map(i => i.id))
      const legacyDistributionEvents = new Map()
      const legacyContributionEvents = new Map()

      for (const event of user.activity) {
        if (!event || !event.investmentId) continue
        if (!existingInvestmentIds.has(event.investmentId)) continue
        const referenceDate = event.displayDate || event.date
        if (!referenceDate) continue
        const key = `${event.investmentId}-${new Date(referenceDate).toISOString()}`
        if (event.type === 'monthly_distribution') {
          legacyDistributionEvents.set(key, event)
        } else if (event.type === 'monthly_compounded') {
          legacyContributionEvents.set(key, event)
        }
      }

      const transactionActivityTypes = new Set([
        'monthly_distribution',
        'monthly_compounded',
        'withdrawal_requested',
        'withdrawal_notice_started',
        'withdrawal_approved',
        'withdrawal_rejected'
      ])

      const originalActivityLength = user.activity.length
      user.activity = user.activity.filter(ev => {
        if (!ev || !ev.date) return true
        const evDate = new Date(ev.date)
        if (evDate > now) return false
        if (ev.investmentId && !existingInvestmentIds.has(ev.investmentId)) return false
        if (transactionActivityTypes.has(ev.type)) return false
        return true
      })
      if (user.activity.length !== originalActivityLength) {
        userTouched = true
        dataMutated = true
      }

      if (user.createdAt) {
        const accountEventId = generateTransactionId('USR', user.id, 'account_created')
        const hasAccountEvent = user.activity.some(ev => ev.id === accountEventId)
        if (!hasAccountEvent) {
          activityEventsToInsert.push({
            id: accountEventId,
            user_id: user.id,
            type: 'account_created',
            date: user.createdAt
          })
          eventsCreated++
          userTouched = true
          dataMutated = true
        }
      }

      // Ensure investment_created and investment_confirmed activity events exist for all investments
      for (const inv of investments) {
        if (!inv || !inv.id) continue
        
        // 1. Check for investment_created event
        const investmentCreatedEventId = generateTransactionId('INV', inv.id, 'created')
        const hasInvestmentCreatedEvent = user.activity.some(ev => ev.id === investmentCreatedEventId)
        const investmentCreatedDate = inv.submittedAt || inv.createdAt
        
        if (!hasInvestmentCreatedEvent && investmentCreatedDate) {
          activityEventsToInsert.push({
            id: investmentCreatedEventId,
            user_id: user.id,
            type: 'investment_created',
            investment_id: inv.id,
            date: investmentCreatedDate
          })
          eventsCreated++
          userTouched = true
          dataMutated = true
        }
        
        // 2. Check for investment_confirmed event (only for confirmed/active investments)
        if (inv.status !== 'draft' && inv.status !== 'pending' && inv.status !== 'rejected') {
          const investmentConfirmedEventId = generateTransactionId('INV', inv.id, 'confirmed')
          const hasInvestmentConfirmedEvent = user.activity.some(ev => ev.id === investmentConfirmedEventId)
          const investmentConfirmedDate = inv.confirmedAt
          
          if (!hasInvestmentConfirmedEvent && investmentConfirmedDate) {
            activityEventsToInsert.push({
              id: investmentConfirmedEventId,
              user_id: user.id,
              type: 'investment_confirmed',
              investment_id: inv.id,
              amount: inv.amount || 0,
              date: investmentConfirmedDate
            })
            eventsCreated++
            userTouched = true
            dataMutated = true
          }
        }
      }

      for (const inv of investments) {
        if (!inv || !inv.id) continue
        let investmentTouched = false

        if (!Array.isArray(inv.transactions)) {
          inv.transactions = []
          investmentTouched = true
        }

        const filteredTransactions = inv.transactions.filter(tx => {
          if (!tx || !tx.date) return true
          if ((tx.type === 'distribution' || tx.type === 'contribution') && new Date(tx.date) > now) {
            return false
          }
          return true
        })

        if (filteredTransactions.length !== inv.transactions.length) {
          inv.transactions = filteredTransactions
          investmentTouched = true
          dataMutated = true
        }

        // VALIDATION: Check ALL existing contributions for valid distributionTxId links
        // This catches orphaned contributions that may exist from before validation was added
        for (const tx of inv.transactions) {
          if (tx.type === 'contribution') {
            if (!tx.distributionTxId) {
              throw new Error(`Existing contribution transaction ${tx.id} must have a distributionTxId`)
            }
            const distribution = inv.transactions.find(existing => existing.id === tx.distributionTxId)
            if (!distribution) {
              throw new Error(`Existing contribution ${tx.id} references non-existent distribution ${tx.distributionTxId}`)
            }
            if (distribution.type !== 'distribution') {
              throw new Error(`Existing contribution ${tx.id} references transaction ${tx.distributionTxId} which is not a distribution`)
            }
            // Distribution must be created before the contribution
            if (new Date(distribution.date) >= new Date(tx.date)) {
              throw new Error(`Existing contribution ${tx.id} references distribution ${tx.distributionTxId} that was not created before the contribution`)
            }
          }
        }

        const findTransaction = (id) => inv.transactions.find(tx => tx.id === id)
        const ensureTransaction = (tx) => {
          // VALIDATION: Contributions must have a distributionTxId and the distribution must exist
          if (tx.type === 'contribution') {
            if (!tx.distributionTxId) {
              throw new Error(`Contribution transaction ${tx.id} must have a distributionTxId`)
            }
            const distribution = findTransaction(tx.distributionTxId)
            if (!distribution) {
              throw new Error(`Contribution ${tx.id} references non-existent distribution ${tx.distributionTxId}`)
            }
            if (distribution.type !== 'distribution') {
              throw new Error(`Contribution ${tx.id} references transaction ${tx.distributionTxId} which is not a distribution`)
            }
            // Distribution must be created before the contribution
            if (new Date(distribution.date) >= new Date(tx.date)) {
              throw new Error(`Contribution ${tx.id} references distribution ${tx.distributionTxId} that was not created before the contribution`)
            }
          }

          const existingIndex = inv.transactions.findIndex(existing => existing.id === tx.id)
          const createdAt = tx.createdAt || tx.date || now.toISOString()
          if (existingIndex === -1) {
            inv.transactions.push({
              ...tx,
              createdAt,
              updatedAt: tx.updatedAt || createdAt
            })
            investmentTouched = true
            userTouched = true
            dataMutated = true
            eventsCreated++
            return
          }
          const existing = inv.transactions[existingIndex]
          let modified = false
          for (const [key, value] of Object.entries(tx)) {
            if (key === 'id') continue
            const current = existing[key]
            const isSame = (typeof value === 'object' && value !== null)
              ? JSON.stringify(current) === JSON.stringify(value)
              : current === value
            if (!isSame) {
              existing[key] = value
              modified = true
            }
          }
          if (modified) {
            existing.updatedAt = tx.updatedAt || now.toISOString()
            investmentTouched = true
            userTouched = true
            dataMutated = true
          }
        }

        if (inv.status === 'draft') {
          const before = inv.transactions.length
          inv.transactions = inv.transactions.filter(tx => tx.type !== 'investment')
          if (inv.transactions.length !== before) {
            investmentTouched = true
            dataMutated = true
          }
          if (investmentTouched) {
            inv.updatedAt = now.toISOString()
          }
          continue
        }

        const amount = inv.amount || 0
        const lockup = inv.lockupPeriod
        const payFreq = inv.paymentFrequency

        const investmentTxId = generateTransactionId('INV', inv.id, 'investment')
        const investmentStatus = (() => {
          switch (inv.status) {
            case 'pending':
              return 'pending'
            case 'rejected':
              return 'rejected'
            case 'withdrawn':
              return 'received'
            case 'withdrawal_notice':
            case 'active':
            default:
              return 'approved'
          }
        })()
        const investmentDate = inv.submittedAt || inv.createdAt || inv.confirmedAt || inv.updatedAt || now.toISOString()
        ensureTransaction({
          id: investmentTxId,
          type: 'investment',
          amount,
          status: investmentStatus,
          date: investmentDate,
          lockupPeriod: lockup,
          paymentFrequency: payFreq,
          confirmedAt: inv.confirmedAt || null,
          approvedAt: inv.confirmedAt || null,
          rejectedAt: inv.rejectedAt || null
        })

        // Distributions for monthly payout investments
        if ((inv.status === 'active' || inv.status === 'withdrawal_notice') && payFreq === 'monthly' && inv.confirmedAt) {
          const confirmedDate = new Date(inv.confirmedAt)
          const accrualStartDate = addDaysUtc(toUtcStartOfDay(confirmedDate), 1)
          const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
          const monthlyRate = annualRate / 12

          const payoutMethod = user?.banking?.payoutMethod || 'bank-account'
          const investmentBank = inv?.banking?.bank
          let payoutBankId = investmentBank?.id || null
          let payoutBankNickname = investmentBank?.nickname || null

          if (!payoutBankId && Array.isArray(user?.bankAccounts) && user?.banking?.defaultBankAccountId) {
            const acct = user.bankAccounts.find(b => b.id === user.banking.defaultBankAccountId)
            if (acct) {
              payoutBankId = acct.id
              payoutBankNickname = acct.nickname || 'Primary Account'
            }
          }

          if (!payoutBankId) {
            payoutBankId = 'MOCK-BANK-001'
            payoutBankNickname = 'Test Bank Account (Mock)'
          }

          const completedMonthEnds = []
          let cursor = new Date(accrualStartDate)

          while (true) {
            const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
            if (monthEnd >= now) break
            completedMonthEnds.push(monthEnd)
            cursor = addDaysUtc(monthEnd, 1)
          }

          if (completedMonthEnds.length > 0) {
            const lastCompletedMonthEnd = completedMonthEnds[completedMonthEnds.length - 1]
            const segments = buildAccrualSegments(accrualStartDate, lastCompletedMonthEnd)
            let monthIndex = 1

            segments.forEach(segment => {
              const monthlyInterest = amount * monthlyRate
              const distributionAmount = segment.type === 'full'
                ? monthlyInterest
                : monthlyInterest * (segment.days / segment.daysInMonth)

              const segmentEndDate = new Date(segment.end)
              const nextYear = segmentEndDate.getUTCMonth() === 11
                ? segmentEndDate.getUTCFullYear() + 1
                : segmentEndDate.getUTCFullYear()
              const nextMonth = segmentEndDate.getUTCMonth() === 11
                ? 1
                : segmentEndDate.getUTCMonth() + 2
              const distributionDate = createEasternTime9AM(nextYear, nextMonth, 1)
              const distributionDateIso = distributionDate.toISOString()
              const txId = generateTransactionId('INV', inv.id, 'distribution', { date: distributionDate })
              const existingTx = findTransaction(txId)
              const legacyKey = `${inv.id}-${distributionDateIso}`
              const legacyEvent = legacyDistributionEvents.get(legacyKey)

              // Determine status based on priority:
              // 1. If transaction exists with non-pending status, keep that status
              // 2. If legacy event has status, use that
              // 3. If auto-approve is enabled AND this is a NEW distribution, auto-approve it
              // 4. Otherwise, default to pending
              let status = 'pending'
              let autoApproved = false
              
              if (existingTx && existingTx.status && existingTx.status !== 'pending') {
                status = existingTx.status
              } else if (legacyEvent) {
                status = mapLegacyPayoutStatus(legacyEvent.payoutStatus)
              } else if (!existingTx && autoApproveDistributions) {
                // NEW distribution and auto-approve is enabled
                status = 'approved'
                autoApproved = true
              }

              ensureTransaction({
                id: txId,
                type: 'distribution',
                amount: Math.round(distributionAmount * 100) / 100,
                status,
                date: distributionDateIso,
                monthIndex,
                lockupPeriod: lockup,
                paymentFrequency: payFreq,
                payoutMethod,
                payoutBankId,
                payoutBankNickname,
                autoApproved: autoApproved || existingTx?.autoApproved || false,
                failureReason: legacyEvent?.failureReason || existingTx?.failureReason || null,
                retryCount: legacyEvent?.retryCount ?? existingTx?.retryCount ?? 0,
                lastRetryAt: legacyEvent?.lastRetryAt || existingTx?.lastRetryAt || null,
                completedAt: legacyEvent?.completedAt || existingTx?.completedAt || null,
                manuallyCompleted: legacyEvent?.manuallyCompleted || existingTx?.manuallyCompleted || false,
                failedAt: legacyEvent?.failedAt || existingTx?.failedAt || null
              })

              // Create activity event for this distribution
              const activityEventId = txId  // Use same ID as transaction for consistency
              if (!activity.some(ev => ev.id === activityEventId)) {
                activityEventsToInsert.push({
                  id: activityEventId,
                  user_id: user.id,
                  type: 'distribution',
                  investment_id: inv.id,
                  amount: Math.round(distributionAmount * 100) / 100,
                  date: distributionDateIso,
                  status
                })
                eventsCreated++
              }

              monthIndex += 1
            })
          }
        }

        // Distributions and Contributions for compounding investments
        // Compounding investments generate TWO transactions per month:
        // 1. Distribution (earnings generated)
        // 2. Contribution (distribution reinvested back into the investment)
        if ((inv.status === 'active' || inv.status === 'withdrawal_notice') && payFreq === 'compounding' && inv.confirmedAt) {
          const confirmedDate = new Date(inv.confirmedAt)
          const accrualStartDate = addDaysUtc(toUtcStartOfDay(confirmedDate), 1)
          const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
          const monthlyRate = annualRate / 12

          const completedMonthEnds = []
          let cursor = new Date(accrualStartDate)

          while (true) {
            const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
            if (monthEnd >= now) break
            completedMonthEnds.push(monthEnd)
            cursor = addDaysUtc(monthEnd, 1)
          }

          if (completedMonthEnds.length > 0) {
            const lastCompletedMonthEnd = completedMonthEnds[completedMonthEnds.length - 1]
            const segments = buildAccrualSegments(accrualStartDate, lastCompletedMonthEnd)
            let monthIndex = 1
            let balance = amount

            segments.forEach(segment => {
              const interest = segment.type === 'full'
                ? balance * monthlyRate
                : balance * (monthlyRate / segment.daysInMonth) * segment.days

              const segmentEndDate = new Date(segment.end)
              const nextYear = segmentEndDate.getUTCMonth() === 11
                ? segmentEndDate.getUTCFullYear() + 1
                : segmentEndDate.getUTCFullYear()
              const nextMonth = segmentEndDate.getUTCMonth() === 11
                ? 1
                : segmentEndDate.getUTCMonth() + 2
              const compoundingDate = createEasternTime9AM(nextYear, nextMonth, 1)
              const compoundingDateIso = compoundingDate.toISOString()
              
              const legacyKey = `${inv.id}-${compoundingDateIso}`
              const legacyDistributionEvent = legacyDistributionEvents.get(legacyKey)
              const legacyContributionEvent = legacyContributionEvents.get(legacyKey)

              // 1. First, create the DISTRIBUTION (earnings generated)
              // For compounding investments, distributions are auto-approved and don't require admin action
              const distributionTxId = generateTransactionId('INV', inv.id, 'distribution', { date: compoundingDate })
              ensureTransaction({
                id: distributionTxId,
                type: 'distribution',
                amount: Math.round(interest * 100) / 100,
                status: 'received',  // Auto-complete for compounding (no admin approval needed)
                date: compoundingDateIso,
                displayDate: compoundingDateIso,
                monthIndex,
                lockupPeriod: lockup,
                paymentFrequency: payFreq,
                principal: Math.round(balance * 100) / 100,
                completedAt: compoundingDateIso,  // Mark as completed immediately
                legacyReferenceId: legacyDistributionEvent?.id || null
              })

              // Create activity event for this distribution
              if (!activity.some(ev => ev.id === distributionTxId)) {
                activityEventsToInsert.push({
                  id: distributionTxId,
                  user_id: user.id,
                  type: 'distribution',
                  investment_id: inv.id,
                  amount: Math.round(interest * 100) / 100,
                  date: compoundingDateIso,
                  status: 'received'
                })
                eventsCreated++
              }

              // 2. Then, create the CONTRIBUTION (distribution reinvested)
              // Contribution happens 1 second after distribution to maintain correct chronological order
              // For compounding investments, contributions are auto-applied immediately
              const contributionDate = new Date(compoundingDate.getTime() + 1000)
              const contributionDateIso = contributionDate.toISOString()
              const contributionTxId = generateTransactionId('INV', inv.id, 'contribution', { date: compoundingDate })
              ensureTransaction({
                id: contributionTxId,
                type: 'contribution',
                amount: Math.round(interest * 100) / 100,
                status: 'received',  // Auto-complete for compounding (no admin approval needed)
                date: contributionDateIso,
                displayDate: compoundingDateIso,  // Show same display date as distribution
                monthIndex,
                lockupPeriod: lockup,
                paymentFrequency: payFreq,
                principal: Math.round(balance * 100) / 100,
                distributionTxId,  // Link to the distribution that was reinvested
                completedAt: contributionDateIso,  // Mark as completed immediately
                legacyReferenceId: legacyContributionEvent?.id || null
              })

              // Create activity event for this contribution
              if (!activity.some(ev => ev.id === contributionTxId)) {
                activityEventsToInsert.push({
                  id: contributionTxId,
                  user_id: user.id,
                  type: 'contribution',
                  investment_id: inv.id,
                  amount: Math.round(interest * 100) / 100,
                  date: contributionDateIso,
                  status: 'received'
                })
                eventsCreated++
              }

              balance += interest
              monthIndex += 1
            })
          }
          
          // Force re-sort for compounding investments to ensure correct order
          investmentTouched = true
        }

        // Redemptions for withdrawals
        const linkedWithdrawals = withdrawals.filter(wd => wd?.investmentId === inv.id)
        const activeWithdrawalIds = new Set()

        for (const wd of linkedWithdrawals) {
          if (!wd || !wd.id) continue
          activeWithdrawalIds.add(wd.id)
          const txId = generateTransactionId('INV', inv.id, 'redemption', { withdrawalId: wd.id })
          const existingTx = findTransaction(txId)

          let status
          switch (wd.status) {
            case 'approved':
              status = 'received'
              break
            case 'rejected':
              status = 'rejected'
              break
            case 'pending':
            case 'notice':
            default:
              status = 'pending'
          }
          if (existingTx && existingTx.status && existingTx.status !== 'pending' && status === 'pending') {
            status = existingTx.status
          }

          const redemptionDate = wd.requestedAt || wd.noticeStartAt || wd.approvedAt || wd.paidAt || now.toISOString()
          ensureTransaction({
            id: txId,
            type: 'redemption',
            amount: wd.amount || 0,
            status,
            date: redemptionDate,
            withdrawalId: wd.id,
            payoutDueBy: wd.payoutDueBy || null,
            approvedAt: wd.approvedAt || null,
            paidAt: wd.paidAt || null,
            rejectedAt: wd.rejectedAt || null
          })
        }

        const beforeRedemptionLength = inv.transactions.length
        inv.transactions = inv.transactions.filter(tx => {
          if (tx.type !== 'redemption') return true
          if (!tx.withdrawalId) return false
          return activeWithdrawalIds.has(tx.withdrawalId)
        })
        if (inv.transactions.length !== beforeRedemptionLength) {
          investmentTouched = true
          userTouched = true
          dataMutated = true
        }

        if (investmentTouched) {
          // Sort transactions by date, then by type order (for same-date transactions)
          // Type order: investment -> distribution -> contribution -> redemption
          const typeOrder = { investment: 1, distribution: 2, contribution: 3, redemption: 4 }
          inv.transactions.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0).getTime()
            const dateB = new Date(b.date || b.createdAt || 0).getTime()
            if (dateA !== dateB) {
              return dateA - dateB
            }
            // Same date: sort by type order
            const orderA = typeOrder[a.type] || 99
            const orderB = typeOrder[b.type] || 99
            return orderA - orderB
          })
          inv.updatedAt = now.toISOString()
          userTouched = true
        }
      }

      if (userTouched) {
        user.updatedAt = now.toISOString()
        usersUpdated++
      }
    }

    // Collect all transactions to save to the transactions table
    const transactionsToUpsert = []
    for (const user of usersData.users) {
      const investments = Array.isArray(user.investments) ? user.investments : []
      for (const inv of investments) {
        if (!inv || !inv.id || !inv.transactions) continue
        for (const tx of inv.transactions) {
          // Convert camelCase to snake_case for database
          const dbTx = {
            id: tx.id,
            investment_id: inv.id,
            type: tx.type,
            amount: tx.amount,
            status: tx.status,
            date: tx.date,
            created_at: tx.createdAt || now.toISOString(),
            updated_at: now.toISOString()
          }
          
          // Add optional fields if they exist
          if (tx.displayDate) dbTx.display_date = tx.displayDate
          if (tx.monthIndex) dbTx.month_index = tx.monthIndex
          if (tx.lockupPeriod) dbTx.lockup_period = tx.lockupPeriod
          if (tx.paymentFrequency) dbTx.payment_frequency = tx.paymentFrequency
          if (tx.payoutMethod) dbTx.payout_method = tx.payoutMethod
          if (tx.payoutBankId) dbTx.payout_bank_id = tx.payoutBankId
          if (tx.payoutBankNickname) dbTx.payout_bank_nickname = tx.payoutBankNickname
          if (tx.principal !== undefined) dbTx.principal = tx.principal
          if (tx.distributionTxId) dbTx.distribution_tx_id = tx.distributionTxId
          if (tx.withdrawalId) dbTx.withdrawal_id = tx.withdrawalId
          if (tx.payoutDueBy) dbTx.payout_due_by = tx.payoutDueBy
          if (tx.confirmedAt) dbTx.confirmed_at = tx.confirmedAt
          if (tx.approvedAt) dbTx.approved_at = tx.approvedAt
          if (tx.rejectedAt) dbTx.rejected_at = tx.rejectedAt
          if (tx.completedAt) dbTx.completed_at = tx.completedAt
          if (tx.failedAt) dbTx.failed_at = tx.failedAt
          if (tx.autoApproved !== undefined) dbTx.auto_approved = tx.autoApproved
          if (tx.manuallyCompleted !== undefined) dbTx.manually_completed = tx.manuallyCompleted
          if (tx.failureReason) dbTx.failure_reason = tx.failureReason
          if (tx.retryCount !== undefined) dbTx.retry_count = tx.retryCount
          if (tx.lastRetryAt) dbTx.last_retry_at = tx.lastRetryAt
          if (tx.legacyReferenceId) dbTx.legacy_reference_id = tx.legacyReferenceId
          
          transactionsToUpsert.push(dbTx)
        }
      }
    }

    // Batch upsert all transactions to Supabase
    if (transactionsToUpsert.length > 0) {
      const { error: transactionsError } = await supabase
        .from('transactions')
        .upsert(transactionsToUpsert, { onConflict: 'id' })
      
      if (transactionsError) {
        console.error('Failed to upsert transactions:', transactionsError)
        return NextResponse.json({ 
          success: false, 
          error: `Failed to save transactions: ${transactionsError.message}` 
        }, { status: 500 })
      }
      
      console.log(`✅ Successfully upserted ${transactionsToUpsert.length} transactions`)
    }

    // Batch insert all new activity events to Supabase
    if (activityEventsToInsert.length > 0) {
      const { error: activityError } = await supabase
        .from('activity')
        .insert(activityEventsToInsert)
      
      if (activityError) {
        console.error('Failed to insert activity events:', activityError)
        return NextResponse.json({ 
          success: false, 
          error: `Failed to save activity events: ${activityError.message}` 
        }, { status: 500 })
      }
      
      console.log(`✅ Successfully inserted ${activityEventsToInsert.length} activity events`)
    }

    return NextResponse.json({ 
      success: true, 
      usersUpdated, 
      eventsCreated,
      activityEventsInserted: activityEventsToInsert.length,
      transactionsUpserted: transactionsToUpsert.length
    })
  } catch (error) {
    console.error('Error migrating transactions:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
