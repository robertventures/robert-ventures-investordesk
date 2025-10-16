import { NextResponse } from 'next/server'
import { getUser, addInvestment, updateInvestment, deleteInvestment } from '../../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../../lib/supabaseClient.js'
import { getCurrentAppTime } from '../../../../../lib/appTime.js'
import { generateGlobalInvestmentId, generateTransactionId } from '../../../../../lib/idGenerator.js'

/**
 * POST /api/users/[id]/investments
 * Create a new investment
 */
export async function POST(request, { params }) {
  try {
    const { id: userId } = params
    const investmentData = await request.json()

    // Get user
    const user = await getUser(userId)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if admin (admins cannot create investments)
    if (user.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Admins cannot create investments' },
        { status: 403 }
      )
    }

    // Validate user is verified
    if (!user.is_verified) {
      return NextResponse.json(
        { success: false, error: 'Account must be verified before creating investments' },
        { status: 403 }
      )
    }

    // VALIDATIONS
    if (typeof investmentData.amount === 'number') {
      if (investmentData.amount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Investment amount must be greater than zero' },
          { status: 400 }
        )
      }
      if (investmentData.amount < 1000) {
        return NextResponse.json(
          { success: false, error: 'Minimum investment amount is $1,000' },
          { status: 400 }
        )
      }
      if (investmentData.amount % 10 !== 0) {
        return NextResponse.json(
          { success: false, error: 'Investment amount must be in $10 increments' },
          { status: 400 }
        )
      }
    }

    // Validate payment frequency
    const validFrequencies = ['compounding', 'monthly']
    if (investmentData.paymentFrequency && !validFrequencies.includes(investmentData.paymentFrequency)) {
      return NextResponse.json(
        { success: false, error: 'Payment frequency must be "compounding" or "monthly"' },
        { status: 400 }
      )
    }

    // Validate lockup period
    const validLockups = ['1-year', '3-year']
    if (investmentData.lockupPeriod && !validLockups.includes(investmentData.lockupPeriod)) {
      return NextResponse.json(
        { success: false, error: 'Lockup period must be "1-year" or "3-year"' },
        { status: 400 }
      )
    }

    // IRA accounts cannot use monthly payment frequency
    if (investmentData.accountType === 'ira' && investmentData.paymentFrequency === 'monthly') {
      return NextResponse.json(
        { success: false, error: 'IRA accounts can only use compounding payment frequency' },
        { status: 400 }
      )
    }

    // Use user's account type if not provided
    if (user.account_type && !investmentData.accountType) {
      investmentData.accountType = user.account_type
    }

    // TODO: Generate proper investment ID (requires querying all investments globally)
    const investmentId = `INV-${Date.now()}`

    // Create investment
    const result = await addInvestment(userId, {
      id: investmentId,
      ...investmentData,
      status: 'draft'
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      investment: result.investment
    }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/users/[id]/investments:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/users/[id]/investments
 * Get all investments for a user
 */
export async function GET(request, { params }) {
  try {
    const { id: userId } = params

    const supabase = createServiceClient()
    const { data: investments, error } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching investments:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch investments' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      investments: investments || []
    })

  } catch (error) {
    console.error('Error in GET /api/users/[id]/investments:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/[id]/investments
 * Update an investment
 */
export async function PATCH(request, { params }) {
  try {
    const { id: userId } = params
    const { investmentId, ...updateData } = await request.json()

    if (!investmentId) {
      return NextResponse.json(
        { success: false, error: 'Investment ID is required' },
        { status: 400 }
      )
    }

    const result = await updateInvestment(investmentId, updateData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      investment: result.investment
    })

  } catch (error) {
    console.error('Error in PATCH /api/users/[id]/investments:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id]/investments?investmentId=...
 * Delete a draft investment
 */
export async function DELETE(request, { params }) {
  try {
    const { id: userId } = params
    const { searchParams } = new URL(request.url)
    const investmentId = searchParams.get('investmentId')

    if (!investmentId) {
      return NextResponse.json(
        { success: false, error: 'Investment ID is required' },
        { status: 400 }
      )
    }

    const result = await deleteInvestment(investmentId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Investment deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/users/[id]/investments:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

