# Wealthblock Seed Accounts Guide

## ⚠️ SECURITY WARNING

This file contains instructions for working with **REAL investor data** from Wealthblock.

**CRITICAL: Before committing any changes to Git:**
1. Review `lib/seedWealthblockAccounts.js` for real PII
2. Replace ALL real data with sanitized/fake test data
3. Only commit sanitized versions
4. Keep real data local for testing only

## Overview

This guide explains how to seed test accounts based on **real user data from Wealthblock** to test the InvestorDesk application with production-like scenarios.

## Purpose

Testing with synthetic test data is helpful, but testing with real investor patterns and edge cases from production (Wealthblock) helps validate:
- ✅ Real investment amounts and patterns
- ✅ Mid-month investment starts (prorated distributions)
- ✅ Actual account types and accreditation scenarios
- ✅ Production-like activity timelines
- ✅ Edge cases that only appear in real data

## Files Created

### 1. Core Logic
**`/lib/seedWealthblockAccounts.js`**
- Contains the `WEALTHBLOCK_USERS` array with real user data (sanitized)
- Main seeding function `seedWealthblockAccounts()`
- Generates user IDs in the 2000+ range (vs test accounts in 1000+ range)

### 2. CLI Script
**`/scripts/seed-wealthblock-accounts.js`**
- CLI wrapper for running the seed function
- Run via: `npm run seed-wealthblock`

### 3. API Endpoint
**`/app/api/admin/seed-wealthblock/route.js`**
- Admin-only POST endpoint
- Called by the Time Machine UI button
- Logs audit events

### 4. UI Integration
Updated files:
- `app/admin/components/TimeMachineTab.js` - Added "Seed Real Users" button
- `app/admin/components/TimeMachineTab.module.css` - Purple button styling
- `app/admin/components/OperationsTab.js` - Passes props
- `app/admin/page.js` - State management and handler

## Usage

### Method 1: CLI (Recommended for Local Dev)
```bash
npm run seed-wealthblock
```

### Method 2: Time Machine UI (Recommended for Testing)
1. Log in as admin
2. Go to **Operations** tab
3. Scroll to **Time Machine** section
4. Click **"Seed Real Users"** button (purple button)
5. Confirm the action
6. Wait for success message

## Current Real Users

### Joseph Robert
- **Wealthblock ID:** 5645638687
- **Email:** `joseph.robert@test.com`
- **Account Type:** Individual
- **Accreditation:** Net Worth >$1M
- **Location:** Raleigh, NC
- **Verification:** Verified (KYC: Manually Approved)

**Investments:**
1. **$1,000 - Compounding, 3-year**
   - Start: Oct 13, 2024 12:29 PM
   - Mid-month start = prorated first month
   - Distributions reinvested automatically
   
2. **$1,000 - Monthly Payout, 3-year**
   - Start: Nov 21, 2024 09:03 AM
   - Mid-month start = prorated first month
   - Regular monthly payouts: $8.33/month (10% APR)
   - First payout: $2.78 (prorated)

## Adding New Real Users

When you capture more Wealthblock data:

1. **Open:** `/lib/seedWealthblockAccounts.js`
2. **Find:** The `WEALTHBLOCK_USERS` array
3. **Copy** the Joseph Robert structure
4. **Fill in** the new user's data from Wealthblock screenshots
5. **Sanitize** all PII (use test SSN, etc.)
6. **Save** and run `npm run seed-wealthblock`

### Template Structure

```javascript
{
  // Source: Wealthblock screenshots - [Name] ([Date])
  wealthblockId: '1234567890',
  accountType: 'individual', // or 'joint', 'entity', 'ira'
  
  // Personal Information
  firstName: 'John',
  middleName: '',
  lastName: 'Doe',
  email: 'john.doe@test.com',
  phoneNumber: '+15551234567',
  dob: '1980-01-15',
  ssn: '123-45-6789', // Test SSN only
  
  // Address
  address: {
    street1: '123 Main St',
    street2: '',
    city: 'San Francisco',
    state: 'California',
    zip: '94102',
    country: 'United States'
  },
  
  // Identity Verification
  identificationType: 'drivers-license',
  identificationDocument: 'CA Drivers License.pdf',
  nationality: 'United States',
  
  // Accreditation
  accreditationStatus: 'net-worth-1m', // or 'income-200k', 'joint-income-300k', 'series-7-65-82', 'not-accredited'
  accreditationVerified: true,
  
  // KYC Status
  kycStatus: 'manually-approved',
  kycApprovedAt: '2024-10-13T12:29:00.000Z',
  
  // Account Status
  isVerified: true,
  verifiedAt: '2024-10-13T12:29:00.000Z',
  createdAt: '2024-10-13T12:29:00.000Z',
  
  // Bank Account
  bankAccounts: [
    {
      accountHolder: 'John Doe',
      routingNumber: '123456789',
      accountNumber: '9876543210',
      accountType: 'checking',
      isPrimary: true
    }
  ],
  
  // Investments
  investments: [
    {
      offerName: 'Fixed-Rate Bonds',
      amount: 10000,
      paymentFrequency: 'monthly', // or 'compounding'
      lockupPeriod: '1-year', // or '3-year'
      interestRate: 10.0,
      
      startDate: '2024-10-13T12:29:00.000Z',
      submittedAt: '2024-10-13T12:29:00.000Z',
      confirmedAt: '2024-10-13T12:29:00.000Z',
      
      status: 'active',
      paymentMethod: 'ACH',
      paymentStatus: 'payment-received',
      
      bankApproved: true,
      bankApprovedBy: 'system',
      bankApprovedAt: '2024-10-13T12:29:00.000Z',
      adminApproved: true,
      adminApprovedBy: 'system',
      adminApprovedAt: '2024-10-13T12:29:00.000Z',
      
      eSignStatus: 'complete',
      eSignCompletedAt: '2024-10-13T12:29:00.000Z',
      
      // For monthly payout accounts only
      payoutDetails: {
        accountHolder: 'John Doe',
        routingNumber: '123456789',
        accountNumber: '9876543210',
        accountType: 'checking'
      }
    }
  ]
}
```

## New Fields Identified

These fields exist in Wealthblock but were not in our original data model:

1. **`middleName`** - Middle name field
2. **`wealthblockId`** - External system ID for tracking
3. **`identificationType`** - Type of ID (drivers-license, passport, etc.)
4. **`identificationDocument`** - Document filename
5. **`nationality`** - Country of nationality
6. **`accreditationStatus`** - Accreditation level (new field)
7. **`accreditationVerified`** - Whether accreditation was verified
8. **`kycStatus`** - KYC approval status
9. **`kycApprovedAt`** - KYC approval timestamp
10. **`offerName`** - Investment offer name
11. **`paymentMethod`** - ACH, wire, etc.
12. **`paymentStatus`** - Payment received, pending, etc.
13. **`eSignStatus`** - E-signature completion status
14. **`eSignCompletedAt`** - E-signature completion time

## Data Cleanup

The seeding function automatically:
- ✅ Removes previous Wealthblock test accounts (identified by `wealthblockId` or email pattern)
- ✅ Assigns sequential user IDs in 2000+ range
- ✅ Generates investment IDs in 20000+ range
- ✅ Creates activity logs for each investment
- ✅ Preserves admin accounts

## Testing Workflow

1. **Capture Wealthblock data** via screenshots
2. **Add user** to `WEALTHBLOCK_USERS` array
3. **Run seed** via CLI or Time Machine
4. **Test the app** with real data patterns
5. **Use Time Machine** to advance time and see how distributions work
6. **Validate** prorated calculations, compounding, payouts

## Best Practices

- ✅ **Always sanitize PII** - Use test SSNs, generic bank accounts
- ✅ **Document the source** - Add comment with screenshot date
- ✅ **Keep mid-month starts** - These test proration logic
- ✅ **Mix account types** - Individual, joint, entity, IRA
- ✅ **Vary investment amounts** - Small ($1K) to large ($100K+)
- ✅ **Include edge cases** - Multiple investments, partial months, etc.

## Troubleshooting

**Q: The button doesn't work**
- Check browser console for errors
- Verify admin authentication
- Check API endpoint logs

**Q: Users aren't showing up**
- Refresh the page after seeding
- Check that Time Machine is OFF (it can affect queries)
- Verify the seed completed successfully

**Q: Calculations seem wrong**
- Check the investment `confirmedAt` date
- Verify interest rate matches expected
- Use Time Machine to test different time periods

## Related Files

- `/lib/seedAccounts.js` - Original test account seeding (1000+ range)
- `/scripts/seed-test-accounts.js` - CLI for test accounts
- `/app/api/admin/seed/route.js` - API for test accounts
- `/lib/investmentCalculations.js` - Interest calculations with proration
- `/lib/appTime.js` - Time Machine system

## Security Notes

⚠️ **Production Safety:**
- These accounts are created with `.test.com` emails
- User IDs in 2000+ range to avoid conflicts
- All PII is sanitized
- Master password required for account access
- Only admin users can trigger seeding

## Next Steps

As you continue testing with real data:

1. Add more diverse user profiles
2. Test edge cases (very old accounts, large amounts, etc.)
3. Validate all calculations against Wealthblock
4. Document any discrepancies found
5. Update this guide with learnings

## Production Deployment Workflow

Once you've validated the app locally with real Wealthblock data patterns, you can deploy to production using the **existing Import Investors feature**.

### Step-by-Step Process

**Local Development:**
1. ✅ Seed Wealthblock users (`npm run seed-wealthblock`)
2. ✅ Use Time Machine to advance time and generate activity
   - Distributions will be created automatically
   - Compounding will accumulate
   - Monthly payouts will be recorded
3. ✅ Export local database:
   - Option 1: Copy `data/users.json` directly
   - Option 2: Create CSV export endpoint (TODO)
   - Format: CSV with headers matching import fields

**Production Import:**
1. 🌐 Login to production admin panel
2. 🌐 Go to **Operations** tab
3. 🌐 Find **Import Investors** section
4. 🌐 Upload your CSV file
5. 🌐 Map CSV columns to system fields
6. 🌐 Review imported data
7. 🌐 Confirm import
8. 🌐 Optionally send welcome emails

### Import Investors Feature Supports

The existing import system already handles:
- ✅ CSV upload with custom field mapping
- ✅ User data (email, name, phone, DOB, SSN)
- ✅ Address data (street, city, state, zip)
- ✅ Account types (individual, joint, entity, IRA)
- ✅ Investment data (amount, frequency, lockup, dates)
- ✅ Investment status
- ✅ Distributions and contributions (via manual entry or CSV)
- ✅ Send welcome emails option

### TODO: Export Feature

To make this workflow easier, we should add:
- [ ] Admin button: "Export Current Database as CSV"
- [ ] Format export to match ImportInvestorsTab field structure
- [ ] Include all user data, investments, and transactions
- [ ] Option to export specific date range or user subset
- [ ] Download as CSV file ready for import

---

**Version:** 1.0  
**Last Updated:** October 2024  
**Maintainer:** Eduardo de Matos

