/**
 * Investment calculation utilities for compound interest and withdrawal eligibility
 */

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

/**
 * Calculate the current value of an investment with compounding
 * @param {Object} investment - Investment object
 * @param {number} investment.amount - Initial investment amount
 * @param {string} investment.paymentFrequency - 'monthly' or 'compounding'
 * @param {string} investment.lockupPeriod - '1-year' or '3-year'
 * @param {string} investment.confirmedAt - ISO date when investment was confirmed
 * @param {string} [asOfDate] - Calculate as of this date (defaults to current app time)
 * @returns {Object} Calculation results
 */
export function calculateInvestmentValue(investment, asOfDate = null) {
  if (!investment) {
    return {
      currentValue: 0,
      totalEarnings: 0,
      monthsElapsed: 0,
      isWithdrawable: false,
      lockupEndDate: null
    }
  }

  // Only calculate compounding for confirmed investments
  if (investment.status !== 'confirmed') {
    return {
      currentValue: investment.amount || 0,
      totalEarnings: 0,
      monthsElapsed: 0,
      isWithdrawable: false,
      lockupEndDate: null
    }
  }

  // Use confirmedAt as the confirmation date
  const confirmationTimestamp = investment.confirmedAt
  
  if (!confirmationTimestamp) {
    return {
      currentValue: investment.amount || 0,
      totalEarnings: 0,
      monthsElapsed: 0,
      isWithdrawable: false,
      lockupEndDate: null
    }
  }

  const confirmedDate = new Date(confirmationTimestamp)
  // Interest starts accruing from the day AFTER confirmation
  const accrualStartDate = addDaysUtc(toUtcStartOfDay(confirmedDate), 1)
  const currentDate = toUtcStartOfDay(asOfDate || new Date().toISOString())

  // Calculate lock up end date
  let lockupEndDate
  if (investment.lockupEndDate) {
    lockupEndDate = new Date(investment.lockupEndDate)
  } else {
    const lockupYears = investment.lockupPeriod === '3-year' ? 3 : 1
    lockupEndDate = new Date(confirmedDate)
    lockupEndDate.setFullYear(lockupEndDate.getFullYear() + lockupYears)
  }

  if (currentDate < accrualStartDate) {
    const monthlyInterestAmount = investment.paymentFrequency === 'monthly'
      ? Math.round((investment.amount || 0) * ((investment.lockupPeriod === '3-year' ? 0.10 : 0.08) / 12) * 100) / 100
      : 0
    return {
      currentValue: investment.amount || 0,
      totalEarnings: 0,
      monthsElapsed: 0,
      isWithdrawable: false,
      lockupEndDate: lockupEndDate.toISOString(),
      monthlyInterestAmount
    }
  }
  
  // Calculate APY based on lockup period
  const apy = investment.lockupPeriod === '3-year' ? 0.10 : 0.08
  const monthlyRate = apy / 12

  // Find the last completed month boundary
  // Earnings are only paid out when a month completes, not on a daily basis
  let lastCompletedMonthEnd = null
  let cursor = new Date(accrualStartDate)
  
  // Find the end of the month when accrual started
  const firstMonthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
  
  // If we haven't reached the end of the first month yet, no earnings
  if (currentDate < firstMonthEnd) {
    const monthlyInterestAmount = investment.paymentFrequency === 'monthly'
      ? Math.round((investment.amount || 0) * monthlyRate * 100) / 100
      : 0
    return {
      currentValue: investment.amount || 0,
      totalEarnings: 0,
      monthsElapsed: 0,
      isWithdrawable: lockupComparisonDate >= lockupEndDate,
      lockupEndDate: lockupEndDate.toISOString(),
      monthlyInterestAmount
    }
  }
  
  // Build segments up to the last completed month boundary only
  // Find all month-end boundaries between accrual start and current date
  const completedMonthEnds = []
  cursor = new Date(accrualStartDate)
  
  while (true) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
    if (monthEnd >= currentDate) break
    completedMonthEnds.push(monthEnd)
    cursor = addDaysUtc(monthEnd, 1)
  }
  
  if (completedMonthEnds.length === 0) {
    // No complete months yet
    const monthlyInterestAmount = investment.paymentFrequency === 'monthly'
      ? Math.round((investment.amount || 0) * monthlyRate * 100) / 100
      : 0
    return {
      currentValue: investment.amount || 0,
      totalEarnings: 0,
      monthsElapsed: 0,
      isWithdrawable: lockupComparisonDate >= lockupEndDate,
      lockupEndDate: lockupEndDate.toISOString(),
      monthlyInterestAmount
    }
  }
  
  // Calculate earnings up to the last completed month end
  lastCompletedMonthEnd = completedMonthEnds[completedMonthEnds.length - 1]
  const segments = buildAccrualSegments(accrualStartDate, lastCompletedMonthEnd)
  const monthsElapsed = segments.reduce((acc, segment) => {
    if (segment.type === 'full') return acc + 1
    return acc + (segment.days / segment.daysInMonth)
  }, 0)

  let currentValue = investment.amount || 0
  let totalEarnings = 0

  if (segments.length) {
    if (investment.paymentFrequency === 'compounding') {
      let balance = investment.amount || 0
      segments.forEach(segment => {
        if (segment.type === 'full') {
          const interest = balance * monthlyRate
          balance += interest
          totalEarnings += interest
        } else {
          const dailyRate = monthlyRate / segment.daysInMonth
          const interest = balance * dailyRate * segment.days
          balance += interest
          totalEarnings += interest
        }
      })
      currentValue = balance
    } else {
      const monthlyInterest = (investment.amount || 0) * monthlyRate
      segments.forEach(segment => {
        if (segment.type === 'full') {
          totalEarnings += monthlyInterest
        } else {
          const prorated = monthlyInterest * (segment.days / segment.daysInMonth)
          totalEarnings += prorated
        }
      })
      currentValue = investment.amount || 0
    }
  }

  const lockupComparisonDate = new Date(asOfDate || new Date().toISOString())

  return {
    currentValue: Math.round(currentValue * 100) / 100,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    monthsElapsed,
    isWithdrawable: lockupComparisonDate >= lockupEndDate,
    lockupEndDate: lockupEndDate.toISOString(),
    monthlyInterestAmount: investment.paymentFrequency === 'monthly' ? 
      Math.round(((investment.amount || 0) * monthlyRate) * 100) / 100 : 0
  }
}

/**
 * Calculate months elapsed between two dates, handling mid-month calculations
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Months elapsed (with fractional months)
 */
export function calculateMonthsElapsed(startDate, endDate) {
  const startUtc = toUtcStartOfDay(startDate)
  const endUtc = toUtcStartOfDay(endDate)
  if (endUtc < startUtc) return 0
  const segments = buildAccrualSegments(startUtc, endUtc)
  return segments.reduce((acc, segment) => {
    if (segment.type === 'full') return acc + 1
    return acc + (segment.days / segment.daysInMonth)
  }, 0)
}

/**
 * Calculate withdrawal amounts for an investment
 * @param {Object} investment - Investment object
 * @param {Object} currentValue - Current value calculation from calculateInvestmentValue
 * @returns {Object} Withdrawal details
 */
export function calculateWithdrawalAmount(investment, currentValue) {
  if (!currentValue.isWithdrawable) {
    return {
      canWithdraw: false,
      withdrawableAmount: 0,
      principalAmount: investment.amount,
      earningsAmount: 0,
      lockupEndDate: currentValue.lockupEndDate
    }
  }

  return {
    canWithdraw: true,
    withdrawableAmount: currentValue.currentValue,
    principalAmount: investment.amount,
    earningsAmount: currentValue.totalEarnings,
    lockupEndDate: currentValue.lockupEndDate
  }
}

/**
 * Format currency for display
 * @param {number} amount 
 * @returns {string}
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Get investment status with lock up information
 * @param {Object} investment 
 * @returns {Object}
 */
export function getInvestmentStatus(investment, asOfDate = null) {
  if (investment.status === 'draft') {
    return {
      status: 'draft',
      statusLabel: 'Draft',
      isActive: false,
      isLocked: false
    }
  }
  
  if (investment.status === 'pending') {
    return {
      status: 'pending',
      statusLabel: 'Pending',
      isActive: false,
      isLocked: true
    }
  }
  
  if (investment.status !== 'confirmed') {
    return {
      status: investment.status,
      statusLabel: investment.status === 'withdrawn' ? 'Withdrawn' : 'Processing',
      isActive: false,
      isLocked: false
    }
  }

  const currentValue = calculateInvestmentValue(investment, asOfDate)
  
  return {
    status: 'active',
    statusLabel: currentValue.isWithdrawable ? 'Available for Withdrawal' : 'Locked',
    isActive: true,
    isLocked: !currentValue.isWithdrawable,
    lockupEndDate: currentValue.lockupEndDate
  }
}
