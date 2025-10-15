#!/usr/bin/env node
/**
 * Seed Wealthblock Accounts Script - CLI Wrapper
 *
 * ⚠️  WARNING: This creates test accounts based on real Wealthblock data
 * 
 * Purpose: Test the app with production-like scenarios from actual investor data
 * 
 * Usage: npm run seed-wealthblock
 *
 * IMPORTANT: 
 * 1. Turn OFF the time machine before running this script!
 * 2. Creates test accounts in Netlify Blobs (production) or data/users.json (local)
 * 3. Based on real Wealthblock investor data (sanitized PII)
 */

import { seedWealthblockAccounts } from '../lib/seedWealthblockAccounts.js'

// Run the seed when executed directly from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  ;(async () => {
    try {
      await seedWealthblockAccounts()
    } catch (error) {
      console.error('❌ Error seeding Wealthblock accounts:', error)
      process.exit(1)
    }
  })()
}

export default seedWealthblockAccounts

