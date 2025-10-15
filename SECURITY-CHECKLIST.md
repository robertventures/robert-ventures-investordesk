# 🔒 Security Checklist - Before Git Commit

## ⚠️ CRITICAL: Prevent PII Leaks

This checklist MUST be reviewed before committing changes to `lib/seedWealthblockAccounts.js`

---

## Files to Check

### `/lib/seedWealthblockAccounts.js`
Contains `WEALTHBLOCK_USERS` array with investor data.

**Review every user in the array:**

- [ ] **Real names?** → Replace with "Test User", "Jane Doe", etc.
- [ ] **Real addresses?** → Replace with fake addresses
- [ ] **Real phone numbers?** → Replace with +1555... test numbers
- [ ] **Real SSNs?** → Use test SSN: 123-45-6789
- [ ] **Real bank accounts?** → Use test routing: 123456789, account: 9876543210
- [ ] **Real Wealthblock IDs?** → Review if sensitive, replace if needed
- [ ] **Emails @test.com?** → Must be @test.com, NOT real emails
- [ ] **Investment amounts accurate?** → Can be real amounts (not PII)
- [ ] **Dates accurate?** → Can be real dates (not PII)

---

## Quick Sanitization Guide

### ✅ Safe to Keep (Not PII)
- Investment amounts
- Investment dates
- Interest rates
- Account types
- Lockup periods
- Payment frequencies
- Transaction types

### ⚠️ MUST SANITIZE (PII)
- First and last names
- Phone numbers
- Email addresses (use @test.com)
- Street addresses
- SSN numbers
- Bank routing/account numbers
- Wealthblock IDs (if contain personal info)
- Any document filenames with real names

---

## Example Sanitization

### Before (❌ DO NOT COMMIT):
```javascript
{
  firstName: 'Joseph',
  lastName: 'Robert',
  email: 'joseph.robert@realemailprovider.com',
  phoneNumber: '+12153706658',
  address: {
    street1: '10201 Sporting Club Dr',
    city: 'Raleigh',
    state: 'North Carolina',
    zip: '27617'
  },
  ssn: '123-45-6789'
}
```

### After (✅ Safe to Commit):
```javascript
{
  firstName: 'Test',
  lastName: 'User',
  email: 'test.user@test.com',
  phoneNumber: '+15551234567',
  address: {
    street1: '123 Test Street',
    city: 'San Francisco',
    state: 'California',
    zip: '94102'
  },
  ssn: '123-45-6789'
}
```

---

## Git Pre-Commit Steps

1. **Search for Real Data**
   ```bash
   # Search for potential real names in the file
   grep -n "firstName\|lastName" lib/seedWealthblockAccounts.js
   
   # Search for potential real phone numbers
   grep -n "phoneNumber" lib/seedWealthblockAccounts.js
   
   # Search for non-test emails
   grep -n "@" lib/seedWealthblockAccounts.js | grep -v "@test.com"
   ```

2. **Review Git Diff**
   ```bash
   git diff lib/seedWealthblockAccounts.js
   ```

3. **Double-Check WEALTHBLOCK_USERS Array**
   - Open the file
   - Manually review each user object
   - Confirm all data is sanitized

4. **Safe to Commit**
   ```bash
   git add lib/seedWealthblockAccounts.js
   git commit -m "Update Wealthblock seed accounts (sanitized)"
   ```

---

## Local Development Workflow

### Adding Real User Data Locally

1. Edit `lib/seedWealthblockAccounts.js`
2. Add REAL data to `WEALTHBLOCK_USERS` array
3. Test locally
4. **DO NOT COMMIT YET**

### Before Committing

1. Review this checklist
2. Sanitize ALL PII in the file
3. Test with sanitized data still works
4. Commit sanitized version only

### After Commit (If Needed)

- Restore real data locally from backup
- OR re-add real data manually
- Keep real data local only

---

## Emergency: Committed Real Data?

If you accidentally committed real PII:

1. **DO NOT PUSH** to remote if you haven't already
2. If not pushed yet:
   ```bash
   git reset --soft HEAD~1  # Undo commit, keep changes
   # Sanitize the data
   git add .
   git commit -m "Update with sanitized data"
   ```

3. If already pushed:
   - Contact repository admin immediately
   - May need to force-push (rewrite history)
   - Consider rotating any exposed credentials
   - Notify affected users if real PII was exposed

---

## Best Practice

**Golden Rule:** Keep TWO versions locally:
1. `seedWealthblockAccounts.js` - Sanitized version (for commits)
2. `seedWealthblockAccounts.local.js` - Real data (never commit, backup locally)

When working:
- Swap in real data file for local testing
- Swap back to sanitized file before committing
- Never have real data in the committed file

---

**Last Updated:** October 2024  
**Importance:** CRITICAL - Review every time before commit

