/**
 * Investment calculation utilities for compound interest and withdrawal eligibility
 */

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
      lockdownEndDate: null
    }
  }

  // Only calculate compounding for confirmed investments
  if (investment.status !== 'confirmed') {
    return {
      currentValue: investment.amount || 0,
      totalEarnings: 0,
      monthsElapsed: 0,
      isWithdrawable: false,
      lockdownEndDate: null
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
      lockdownEndDate: null
    }
  }

  const confirmedDate = new Date(confirmationTimestamp)
  // Accrual starts the day AFTER confirmation
  const accrualStartDate = new Date(confirmedDate)
  accrualStartDate.setDate(accrualStartDate.getDate() + 1)
  const currentDate = new Date(asOfDate || new Date().toISOString())
  
  // Calculate lockdown end date if missing
  let lockdownEndDate
  if (investment.lockdownEndDate) {
    lockdownEndDate = new Date(investment.lockdownEndDate)
  } else {
    // Calculate it on the fly
    const lockupYears = investment.lockupPeriod === '3-year' ? 3 : 1
    lockdownEndDate = new Date(confirmedDate)
    lockdownEndDate.setFullYear(lockdownEndDate.getFullYear() + lockupYears)
  }
  
  // Calculate APY based on lockup period
  const apy = investment.lockupPeriod === '3-year' ? 0.10 : 0.08
  const monthlyRate = apy / 12

  // Calculate time elapsed
  const totalMonthsElapsed = calculateMonthsElapsed(accrualStartDate, currentDate)
  
  let currentValue = investment.amount
  let totalEarnings = 0

  if (investment.paymentFrequency === 'compounding') {
    // Compound monthly from confirmation date
    currentValue = investment.amount * Math.pow(1 + monthlyRate, totalMonthsElapsed)
    totalEarnings = currentValue - investment.amount
  } else {
    // Monthly interest payments (interest paid out to investor, principal remains constant)
    totalEarnings = investment.amount * monthlyRate * totalMonthsElapsed
    // Current value for monthly payout bonds should remain the original principal
    currentValue = investment.amount
  }

  return {
    currentValue: Math.round(currentValue * 100) / 100,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    monthsElapsed: totalMonthsElapsed,
    isWithdrawable: currentDate >= lockdownEndDate,
    lockdownEndDate: lockdownEndDate.toISOString(),
    monthlyInterestAmount: investment.paymentFrequency === 'monthly' ? 
      Math.round(investment.amount * monthlyRate * 100) / 100 : 0
  }
}

/**
 * Calculate months elapsed between two dates, handling mid-month calculations
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Months elapsed (with fractional months)
 */
export function calculateMonthsElapsed(startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (end <= start) return 0

  // Calculate full months
  let months = 0
  let currentDate = new Date(start)
  
  // Move to the first of the next month after confirmation
  const firstOfNextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  
  // Calculate partial first month (from confirmation to end of month)
  const daysInFirstMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const daysRemainingInFirstMonth = daysInFirstMonth - start.getDate() + 1
  const partialFirstMonth = daysRemainingInFirstMonth / daysInFirstMonth
  
  if (end >= firstOfNextMonth) {
    // Add the partial first month
    months += partialFirstMonth
    currentDate = new Date(firstOfNextMonth)
    
    // Add full months
    while (true) {
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      if (end >= nextMonth) {
        months += 1
        currentDate = nextMonth
      } else {
        // Add partial last month if needed
        if (end > currentDate) {
          const daysInLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
          const daysElapsedInLastMonth = end.getDate()
          const partialLastMonth = daysElapsedInLastMonth / daysInLastMonth
          months += partialLastMonth
        }
        break
      }
    }
  } else {
    // Investment hasn't reached the first full month yet
    const daysElapsed = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    months = daysElapsed / daysInFirstMonth
  }
  
  return Math.max(0, months)
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
      lockdownEndDate: currentValue.lockdownEndDate
    }
  }

  return {
    canWithdraw: true,
    withdrawableAmount: currentValue.currentValue,
    principalAmount: investment.amount,
    earningsAmount: currentValue.totalEarnings,
    lockdownEndDate: currentValue.lockdownEndDate
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
 * Get investment status with lockdown information
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
      statusLabel: 'Pending Confirmation',
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
    lockdownEndDate: currentValue.lockdownEndDate
  }
}
