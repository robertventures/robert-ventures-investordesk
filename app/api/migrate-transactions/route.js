import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../lib/database'
import { getCurrentAppTime } from '../../../lib/appTime'

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

      if (!Array.isArray(user.transactions)) {
        user.transactions = []
      }

      // Remove any future-dated generated events if app time moved backwards
      // Also prune events tied to investments that no longer exist
      const existingInvestmentIds = new Set((investments || []).map(i => i.id))
      user.transactions = user.transactions.filter(ev => {
        if (!ev || !ev.date) return true
        const evDate = new Date(ev.date)
        if (evDate > now) return false
        // If this event references an investment that is gone, drop it
        if (ev.investmentId && !existingInvestmentIds.has(ev.investmentId)) return false
        return true
      })

      const existingIds = new Set(user.transactions.map(t => t.id))
      const ensureEvent = (event) => {
        if (!existingIds.has(event.id)) {
          user.transactions.push(event)
          existingIds.add(event.id)
          eventsCreated++
          return true
        }
        return false
      }

      // Account created event (always present when user.createdAt exists)
      if (user.createdAt) {
        ensureEvent({
          id: `tx-${user.id}-account-created`,
          type: 'account_created',
          amount: 0,
          date: user.createdAt
        })
      }

      // Investment events
      for (const inv of investments) {
        const invId = inv.id
        const amount = inv.amount || 0
        const lockup = inv.lockupPeriod
        const payFreq = inv.paymentFrequency

        // Created event
        if (inv.createdAt) {
          ensureEvent({
            id: `tx-${invId}-created`,
            type: 'investment_created',
            investmentId: invId,
            amount,
            lockupPeriod: lockup,
            paymentFrequency: payFreq,
            date: inv.createdAt
          })
        }

        // Confirmed event
        if (inv.status === 'confirmed' && inv.confirmedAt) {
          ensureEvent({
            id: `tx-${invId}-confirmed`,
            type: 'investment_confirmed',
            investmentId: invId,
            amount,
            lockupPeriod: lockup,
            paymentFrequency: payFreq,
            date: inv.confirmedAt
          })
        }

        // Monthly distributions for monthly payout investments (prorated first month)
        if (inv.status === 'confirmed' && inv.paymentFrequency === 'monthly' && inv.confirmedAt) {
          const confirmedAt = new Date(inv.confirmedAt)
          // Start day after confirmation
          const startDate = new Date(confirmedAt)
          startDate.setDate(startDate.getDate() + 1)

          const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
          const monthlyRate = annualRate / 12
          // Resolve payout destination (mocked as connected)
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
          let periodStart = new Date(startDate)
          let monthIndex = 1
          while (periodStart <= now) {
            // Period end: same day next month
            const periodEnd = new Date(periodStart)
            periodEnd.setMonth(periodEnd.getMonth() + 1)
            if (periodEnd > now) break

            // Proration fraction based on days within the start month
            const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate()
            const daysFromStartToMonthEnd = daysInMonth - periodStart.getDate() + 1
            const fraction = monthIndex === 1 ? (daysFromStartToMonthEnd / daysInMonth) : 1
            const monthlyAmount = (inv.amount || 0) * monthlyRate * fraction

            const eventId = `tx-${invId}-md-${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, '0')}`
            ensureEvent({
              id: eventId,
              type: 'monthly_distribution',
              investmentId: invId,
              amount: Math.round(monthlyAmount * 100) / 100,
              lockupPeriod: lockup,
              paymentFrequency: payFreq,
              date: periodEnd.toISOString(),
              monthIndex,
              payoutMethod,
              payoutBankId,
              payoutBankNickname,
              payoutStatus: 'completed'
            })

            periodStart = periodEnd
            monthIndex += 1
          }
        }

        // Monthly compounding events (prorated first month, compounding principal)
        if (inv.status === 'confirmed' && inv.paymentFrequency === 'compounding' && inv.confirmedAt) {
          const confirmedAt = new Date(inv.confirmedAt)
          const startDate = new Date(confirmedAt)
          startDate.setDate(startDate.getDate() + 1)

          const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
          const monthlyRate = annualRate / 12
          let periodStart = new Date(startDate)
          let principal = amount
          let monthIndex = 1
          while (periodStart <= now) {
            const periodEnd = new Date(periodStart)
            periodEnd.setMonth(periodEnd.getMonth() + 1)
            if (periodEnd > now) break

            const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate()
            const daysFromStartToMonthEnd = daysInMonth - periodStart.getDate() + 1
            const fraction = monthIndex === 1 ? (daysFromStartToMonthEnd / daysInMonth) : 1
            const interest = principal * monthlyRate * fraction

            const eventId = `tx-${invId}-mc-${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, '0')}`
            ensureEvent({
              id: eventId,
              type: 'monthly_compounded',
              investmentId: invId,
              amount: Math.round(interest * 100) / 100,
              lockupPeriod: lockup,
              paymentFrequency: payFreq,
              date: periodEnd.toISOString(),
              monthIndex
            })

            principal += interest
            periodStart = periodEnd
            monthIndex += 1
          }
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
            id: `tx-${wd.id}-notice`,
            type: 'withdrawal_notice_started',
            ...base,
            date: wd.noticeStartAt || wd.requestedAt || new Date().toISOString(),
            noticeEndAt: wd.noticeEndAt || null,
            payoutEligibleAt: wd.payoutEligibleAt || null
          })
        } else if (wd.status === 'approved') {
          ensureEvent({
            id: `tx-${wd.id}-approved`,
            type: 'withdrawal_approved',
            ...base,
            date: wd.approvedAt || wd.paidAt || new Date().toISOString()
          })
        } else if (wd.status === 'rejected') {
          ensureEvent({
            id: `tx-${wd.id}-rejected`,
            type: 'withdrawal_rejected',
            ...base,
            date: wd.rejectedAt || new Date().toISOString()
          })
        } else {
          ensureEvent({
            id: `tx-${wd.id}-requested`,
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


