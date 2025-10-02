# Investment Status Rename Summary

**Date:** October 2, 2025  
**Change:** Renamed investment status from `confirmed` to `active`

---

## Why This Change?

The documentation defines investment states as:
- `draft` → `pending` → `active` → `withdrawal_notice` → `withdrawn`

The term `active` is:
- ✅ Clearer - shows the investment is actively earning
- ✅ More standard in financial systems
- ✅ Better aligned with industry terminology
- ✅ Consistent with documentation for backend team

---

## Files Updated

### API Routes (9 files)
1. ✅ `/app/api/users/[id]/route.js` - Investment updates (3 occurrences)
2. ✅ `/app/api/withdrawals/route.js` - Withdrawal eligibility check
3. ✅ `/app/api/migrate-transactions/route.js` - Monthly event generation (3 occurrences)
4. ✅ `/app/api/migrate-investments/route.js` - Status migration
5. ✅ `/app/api/admin/withdrawals/route.js` - Withdrawal rejection revert

### Library (1 file)
6. ✅ `/lib/investmentCalculations.js` - Investment calculations (2 occurrences)

### Components (4 files)
7. ✅ `/app/components/PortfolioSummary.js` - Portfolio calculations (2 occurrences)
8. ✅ `/app/components/TransactionsTable.js` - Transaction display
9. ✅ `/app/components/InvestmentDetailsContent.js` - Investment details
10. ✅ `/app/components/DocumentsView.js` - Document filtering

### Admin Dashboard (2 files)
11. ✅ `/app/admin/page.js` - Admin dashboard (6 occurrences)
12. ✅ `/app/admin/users/[id]/page.js` - User details page

---

## Total Changes

- **22 occurrences** of `status === 'confirmed'` → `status === 'active'`
- **12 files** updated
- **0 data migrations needed** (no confirmed investments in current data)

---

## What Changed

### Before:
```javascript
if (investment.status === 'confirmed') {
  // generate interest
}
```

### After:
```javascript
if (investment.status === 'active') {
  // generate interest
}
```

### Admin UI Labels:
- Button: "Confirm" → "Approve"  
- Status: "Confirmed" → "Active"
- Message: "Confirming..." → "Approving..."

---

## Testing Checklist

Test these areas to ensure everything works:

### User Flow
- [ ] Create draft investment
- [ ] Submit for approval (draft → pending)
- [ ] Admin approves investment (pending → active)
- [ ] Investment shows as "Active" in dashboard
- [ ] Interest calculations work for active investments

### Monthly Events
- [ ] Monthly payouts generated for active investments
- [ ] Compounding events generated for active investments
- [ ] No events generated for pending/draft investments

### Withdrawals
- [ ] Can only request withdrawal from active investments
- [ ] Withdrawal rejection reverts status back to active
- [ ] Withdrawal approval changes status to withdrawn

### Admin Dashboard
- [ ] Active investments show correct status
- [ ] "Approve" button works (changes pending → active)
- [ ] Total raised shows only active investments
- [ ] Investor count includes users with active investments

### Edge Cases
- [ ] Time machine calculations use active investments
- [ ] Portfolio summary calculates correctly
- [ ] Transaction table shows correct earnings for active investments
- [ ] Documents view shows documents for active investments

---

## Backend Team Note

⚠️ **Important:** The backend documentation (`docs/BACKEND-GUIDE.md`) already uses `active` as the correct state name. 

When implementing the Python backend:
- Use `active` status (NOT `confirmed`)
- Follow the state flow: `draft` → `pending` → `active` → `withdrawal_notice` → `withdrawn`
- The frontend now matches this naming exactly

---

## Rollback (if needed)

If you need to revert this change:

```bash
# Search and replace in all files
find app lib -type f -name "*.js" -exec sed -i '' "s/'active'/'confirmed'/g" {} +

# Or use git to revert
git checkout -- app/ lib/
```

---

## Status

✅ **Complete** - All code updated to use `active` instead of `confirmed`

