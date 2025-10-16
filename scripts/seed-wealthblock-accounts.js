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
 * 4. If lib/seedWealthblockAccounts.js doesn't exist, copy from template:
 *    cp lib/seedWealthblockAccounts.template.js lib/seedWealthblockAccounts.js
 */

// Run the seed when executed directly from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  ;(async () => {
    try {
      // Dynamically import seedWealthblockAccounts (file is gitignored)
      let seedWealthblockAccounts
      try {
        const module = await import('../lib/seedWealthblockAccounts.js')
        seedWealthblockAccounts = module.seedWealthblockAccounts || module.default
      } catch (importError) {
        console.error('❌ Error: lib/seedWealthblockAccounts.js not found')
        console.error('   This file is gitignored for security (contains real PII)')
        console.error('   Create it from the template:')
        console.error('   cp lib/seedWealthblockAccounts.template.js lib/seedWealthblockAccounts.js')
        process.exit(1)
      }

      await seedWealthblockAccounts()
    } catch (error) {
      console.error('❌ Error seeding Wealthblock accounts:', error)
      process.exit(1)
    }
  })()
}

