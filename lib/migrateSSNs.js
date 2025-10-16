/**
 * Migration utility to encrypt existing plaintext SSNs
 *
 * This script should be run once to migrate all existing plaintext SSNs
 * to encrypted format.
 *
 * Usage: node lib/migrateSSNs.js
 */

import { getUsers, saveUsers } from './supabaseDatabase.js'
import { encrypt, isEncrypted } from './encryption.js'

export async function migrateSSNs() {
  console.log('🔐 Starting SSN encryption migration...\n')

  try {
    const usersData = await getUsers()
    let migratedCount = 0
    let alreadyEncryptedCount = 0
    let emptySSNCount = 0

    console.log(`Found ${usersData.users.length} users to check\n`)

    for (let i = 0; i < usersData.users.length; i++) {
      const user = usersData.users[i]

      if (!user.ssn) {
        emptySSNCount++
        continue
      }

      if (isEncrypted(user.ssn)) {
        alreadyEncryptedCount++
        console.log(`✓ User ${user.email}: SSN already encrypted`)
        continue
      }

      // Encrypt plaintext SSN
      try {
        const encryptedSSN = encrypt(user.ssn)
        usersData.users[i].ssn = encryptedSSN
        migratedCount++
        console.log(`✅ User ${user.email}: SSN encrypted`)
      } catch (error) {
        console.error(`❌ User ${user.email}: Failed to encrypt SSN:`, error.message)
        throw error
      }
    }

    // Save updated users if any were migrated
    if (migratedCount > 0) {
      const saved = await saveUsers(usersData)
      if (!saved) {
        throw new Error('Failed to save migrated data')
      }
      console.log('\n✅ Migration data saved successfully')
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 Migration Summary:')
    console.log('='.repeat(50))
    console.log(`Total users:              ${usersData.users.length}`)
    console.log(`SSNs migrated:            ${migratedCount}`)
    console.log(`Already encrypted:        ${alreadyEncryptedCount}`)
    console.log(`Empty SSNs:               ${emptySSNCount}`)
    console.log('='.repeat(50))

    if (migratedCount > 0) {
      console.log('\n✅ SSN migration completed successfully!')
    } else {
      console.log('\n✓ No migration needed - all SSNs are already encrypted or empty')
    }

    return {
      success: true,
      migrated: migratedCount,
      alreadyEncrypted: alreadyEncryptedCount,
      empty: emptySSNCount
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateSSNs()
    .then((result) => {
      process.exit(result.success ? 0 : 1)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}
