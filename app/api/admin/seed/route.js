import { NextResponse } from 'next/server'
import { getUserByEmail, addUser, updateUser } from '../../../../lib/database'

// POST /api/admin/seed
// Idempotently ensures an admin account exists in the backing store
export async function POST() {
  try {
    const email = 'admin@rv.com'
    const adminFields = {
      email,
      password: 'Admin1234$',
      firstName: 'Admin',
      lastName: 'User',
      phoneNumber: '',
      dob: '',
      ssn: '',
      isVerified: true,
      verifiedAt: '2025-01-23T00:00:00.000Z',
      isAdmin: true,
      address: null
    }

    const existing = await getUserByEmail(email)

    if (!existing) {
      const created = await addUser(adminFields)
      if (!created.success) {
        return NextResponse.json({ success: false, error: created.error || 'Failed to create admin' }, { status: 500 })
      }
      // Ensure flags are set as expected
      const updated = await updateUser(created.user.id, {
        isAdmin: true,
        isVerified: true,
        verifiedAt: adminFields.verifiedAt,
        firstName: adminFields.firstName,
        lastName: adminFields.lastName,
        phoneNumber: adminFields.phoneNumber,
        dob: adminFields.dob,
        ssn: adminFields.ssn,
        address: adminFields.address
      })
      if (!updated.success) {
        return NextResponse.json({ success: true, user: created.user, created: true, note: 'Created but follow-up update failed' })
      }
      return NextResponse.json({ success: true, user: updated.user, created: true })
    }

    const promoted = await updateUser(existing.id, {
      ...adminFields
    })
    if (!promoted.success) {
      return NextResponse.json({ success: false, error: promoted.error || 'Failed to update admin' }, { status: 500 })
    }
    return NextResponse.json({ success: true, user: promoted.user, created: false })
  } catch (error) {
    console.error('Error seeding admin:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}


