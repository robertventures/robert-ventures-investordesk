import { NextResponse } from 'next/server'
import { getUsers } from '../../../../lib/database'

/**
 * GET /api/admin/tax-report?year=2024&userId=USR-1002
 * 
 * Export tax data for a specific user and year
 * Returns all transactions with taxable income
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const taxYear = parseInt(searchParams.get('year'))
    const userId = searchParams.get('userId')
    const format = searchParams.get('format') || 'json' // json or csv

    if (!taxYear) {
      return NextResponse.json(
        { error: 'Tax year is required (e.g., ?year=2024)' },
        { status: 400 }
      )
    }

    const usersData = await getUsers()
    let users = usersData.users

    // Filter to specific user if provided
    if (userId) {
      users = users.filter(u => u.id === userId)
      if (users.length === 0) {
        return NextResponse.json(
          { error: `User ${userId} not found` },
          { status: 404 }
        )
      }
    }

    // Collect all tax data
    const taxReport = []

    for (const user of users) {
      const investments = user.investments || []
      
      for (const inv of investments) {
        const transactions = inv.transactions || []
        
        for (const tx of transactions) {
          // Filter to specified tax year
          if (tx.taxYear !== taxYear) continue

          taxReport.push({
            // User info
            userId: user.id,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            userEmail: user.email,
            ssn: user.ssn || 'Not Provided',
            
            // Investment info
            investmentId: inv.id,
            lockupPeriod: inv.lockupPeriod,
            paymentFrequency: inv.paymentFrequency,
            
            // Transaction info
            transactionId: tx.id,
            transactionType: tx.type,
            date: tx.date,
            amount: tx.amount,
            status: tx.status,
            
            // Tax metadata
            taxYear: tx.taxYear,
            taxableIncome: tx.taxableIncome || 0,
            incomeType: tx.incomeType,
            
            // Special flags (for compounding)
            constructiveReceipt: tx.constructiveReceipt || false,
            actualReceipt: tx.actualReceipt !== false, // Default true
            
            // Reference
            distributionTxId: tx.distributionTxId || null
          })
        }
      }
    }

    // Sort by user, then date
    taxReport.sort((a, b) => {
      if (a.userId !== b.userId) return a.userId.localeCompare(b.userId)
      return new Date(a.date) - new Date(b.date)
    })

    // Calculate summary
    const summary = {
      taxYear,
      totalUsers: new Set(taxReport.map(r => r.userId)).size,
      totalTransactions: taxReport.length,
      totalTaxableIncome: taxReport.reduce((sum, r) => sum + r.taxableIncome, 0),
      
      // Breakdown by income type
      byIncomeType: {},
      
      // Constructive receipt tracking
      constructiveReceiptTotal: taxReport
        .filter(r => r.constructiveReceipt)
        .reduce((sum, r) => sum + r.taxableIncome, 0),
      
      actualReceiptTotal: taxReport
        .filter(r => r.actualReceipt && !r.constructiveReceipt)
        .reduce((sum, r) => sum + r.taxableIncome, 0)
    }

    // Group by income type
    taxReport.forEach(r => {
      const type = r.incomeType || 'other'
      if (!summary.byIncomeType[type]) {
        summary.byIncomeType[type] = {
          count: 0,
          totalIncome: 0
        }
      }
      summary.byIncomeType[type].count++
      summary.byIncomeType[type].totalIncome += r.taxableIncome
    })

    // Round totals
    summary.totalTaxableIncome = Math.round(summary.totalTaxableIncome * 100) / 100
    summary.constructiveReceiptTotal = Math.round(summary.constructiveReceiptTotal * 100) / 100
    summary.actualReceiptTotal = Math.round(summary.actualReceiptTotal * 100) / 100
    
    Object.keys(summary.byIncomeType).forEach(type => {
      summary.byIncomeType[type].totalIncome = 
        Math.round(summary.byIncomeType[type].totalIncome * 100) / 100
    })

    // Format output
    if (format === 'csv') {
      const csv = generateCSV(taxReport)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="tax-report-${taxYear}.csv"`
        }
      })
    }

    return NextResponse.json({
      success: true,
      taxYear,
      userId: userId || 'all',
      summary,
      transactions: taxReport
    })

  } catch (error) {
    console.error('Error generating tax report:', error)
    return NextResponse.json(
      { error: 'Failed to generate tax report' },
      { status: 500 }
    )
  }
}

/**
 * Generate CSV from tax report data
 */
function generateCSV(taxReport) {
  const headers = [
    'User ID',
    'User Name',
    'User Email',
    'SSN',
    'Investment ID',
    'Lockup Period',
    'Payment Frequency',
    'Transaction ID',
    'Transaction Type',
    'Date',
    'Amount',
    'Status',
    'Tax Year',
    'Taxable Income',
    'Income Type',
    'Constructive Receipt',
    'Actual Receipt',
    'Distribution Tx ID'
  ]

  const rows = taxReport.map(r => [
    r.userId,
    r.userName,
    r.userEmail,
    r.ssn,
    r.investmentId,
    r.lockupPeriod,
    r.paymentFrequency,
    r.transactionId,
    r.transactionType,
    r.date,
    r.amount,
    r.status,
    r.taxYear,
    r.taxableIncome,
    r.incomeType,
    r.constructiveReceipt,
    r.actualReceipt,
    r.distributionTxId || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape commas and quotes in CSV
      const str = String(cell)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(','))
  ].join('\n')

  return csvContent
}

