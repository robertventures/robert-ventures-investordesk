import { NextResponse } from 'next/server'
import { getUsers, addUser, getUserByEmail } from '../../../lib/database'

// GET - Retrieve all users or a specific user by email
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    
    if (email) {
      // Get specific user by email
      const user = getUserByEmail(email)
      if (user) {
        return NextResponse.json({ success: true, user })
      } else {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }
    } else {
      // Get all users
      const usersData = getUsers()
      return NextResponse.json({ success: true, users: usersData.users })
    }
  } catch (error) {
    console.error('Error in GET /api/users:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new user
export async function POST(request) {
  try {
    const body = await request.json()
    console.log('Received user data:', body)
    const { email, firstName, lastName, phoneNumber, password } = body
    
    // Validate required fields - only email is required for initial creation
    if (!email) {
      console.log('Missing required field: email')
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }
    
    // Check if user already exists
    const existingUser = getUserByEmail(email)
    if (existingUser) {
      console.log('User already exists:', email)
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      )
    }
    
    // Add new user
    console.log('Adding new user...')
    const result = addUser({ email, firstName, lastName, phoneNumber, password })
    console.log('Add user result:', result)
    
    if (result.success) {
      return NextResponse.json({ success: true, user: result.user }, { status: 201 })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in POST /api/users:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
