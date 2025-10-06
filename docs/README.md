# Backend Documentation

**Welcome to the Robert Ventures Investment Platform backend team!**

This documentation is your complete reference for implementing a Python backend that powers our investment management platform. Everything you need is here.

---

## 📚 Documentation Structure

### 📄 [BACKEND-GUIDE.md](./BACKEND-GUIDE.md)

**The complete implementation guide.** Read this document thoroughly before starting development.

#### What's Inside

✅ **Authentication & Verification** - User sign-up, verification, password reset  
✅ **Dual Approval System** - Bank and admin approval workflow for investments  
✅ **ID Architecture** - Sequential, human-readable ID system for all entities  
✅ **Investment States** - Complete lifecycle from draft to withdrawn  
✅ **Business Rules** - All validation and calculation logic  
✅ **Interest Calculations** - Daily-prorated monthly calculations with examples  
✅ **Pending Payouts System** - Admin approval workflow for monthly payments  
✅ **Withdrawal Logic** - 90-day processing window rules  
✅ **Data Models** - Complete JSON schemas for all entities  
✅ **API Endpoints** - All required endpoints with request/response examples  
✅ **Code Examples** - Python implementation patterns  
✅ **Admin Interface Requirements** - UI/UX specifications for admin dashboard  
✅ **Database Indexes** - Performance optimization queries  
✅ **Testing Guide** - Validation scenarios and test cases  

---

## 🚀 Quick Start Guide

### 1. **Read the Documentation** (2-3 hours)
   - Start with this README
   - Read BACKEND-GUIDE.md from top to bottom
   - Pay special attention to Investment States and Interest Calculations sections

### 2. **Understand the Data Flow**
   ```
   User Sign-Up → Email Verification → Investment Creation → Dual Approval → 
   Active Investment → Monthly Events → Withdrawal Request → Withdrawal Processing
   ```

### 3. **Set Up Your Development Environment**
   - Python 3.9+ with FastAPI [[memory:9422626]]
   - Use Netlify Blobs for data storage [[memory:9329168]]
   - Configure app time system for testing

### 4. **Implementation Order**
   1. Authentication & user management
   2. Investment CRUD and state transitions
   3. Dual approval system
   4. Interest calculations and monthly events
   5. Withdrawal system
   6. Admin endpoints

### 5. **Reference Implementation**
   - Check `/app/api/` for Next.js reference routes
   - See `/lib/` for calculation logic
   - Review `/testing-docs/` for test scenarios

---

## 🎯 Critical Requirements

### Data Models
- Frontend expects **exact JSON structure** - do not modify field names or types
- Activity events use `activity` field (not `transactions`)
- Investment IDs are sequential (e.g., `INV-10000`, `INV-10001`)
- All event IDs must be **ALL UPPERCASE** (e.g., `TX-INV-10000-CREATED`)

### Investment States
Six states define the investment lifecycle:
- `draft` - User created, can edit/delete
- `pending` - Submitted for approval (requires bank + admin approval)
- `active` - Live investment earning interest
- `withdrawal_notice` - User requested withdrawal (still earning interest)
- `withdrawn` - Completed withdrawal (final state)
- `rejected` - Admin rejected (final state)

### Interest Calculations
- **Daily prorated** for partial months
- Interest starts day **after** confirmation
- Monthly payout: Principal × (APY/12) × (days_accrued/days_in_month)
- Compounding: Interest added to principal monthly

### App Time System
- All date/time calculations must use "app time" (not system time)
- Admin can set custom dates for testing
- Enables time travel for demonstrations

### Dual Approval System
**Phase 1 (Current):**
- Bank approval: Auto-approved (defaults to `true`)
- Admin approval: Required for activation
- Investment activates when admin approves

**Phase 2 (Future - Banking Integration):**
- Bank approval: Required (via banking API webhook)
- Admin approval: Required
- Investment activates when BOTH approvals complete

### Monthly Payout Approval
- All monthly payouts start as `pending_approval`
- Admin must approve before funds sent to bank
- Failed payouts queued for retry
- Batch approval supported

---

## 💡 Key Concepts

### Account Type Locking
Once a user submits an investment, their account locks to that account type. Users cannot mix account types (individual, joint, entity, ira) within the same account.

### Withdrawal Timeline
- User can only withdraw after lockup period ends
- Robert Ventures has **90 days** to process (business deadline, not user waiting)
- Investment continues earning interest during processing
- Withdrawn investments remain visible for historical records

### Activity Events
All significant events create activity records:
- Account creation
- Investment creation, confirmation
- Monthly distributions (payouts)
- Monthly compounding
- Withdrawal requests and approvals

### Admin Dashboard
Comprehensive admin interface for:
- User account management
- Investment approvals (dual approval workflow)
- Payout approvals (monthly distributions)
- Withdrawal processing
- Time machine (testing tool)

---

## 📊 Data Storage

### Using Netlify Blobs [[memory:9329168]]
- Production data stored in Netlify Blobs
- Simple JSON-based storage
- Seed admin account in production to match local mock

### Development Data
- See `/data/users.json` for sample data structure
- Admin user ID: `USR-1000` (hardcoded)
- Investment IDs start at `INV-10000`
- Withdrawal IDs start at `WDL-10000`

---

## 🔍 Testing Your Implementation

### Test Scenarios (in `/testing-docs/`)
- `test-all-account-types.js` - 16 account type combinations
- `test-time-machine.js` - Time-based calculations
- `test-edge-cases.js` - Edge cases and validation
- `test-pending-payouts.js` - Payout approval system
- `test-account-type-locking.js` - Account locking behavior

### Validation Checklist
- [ ] Investment calculations match to the penny
- [ ] All 6 investment states work correctly
- [ ] Dual approval workflow functions properly
- [ ] Monthly events generate correctly
- [ ] Withdrawals process within 90-day window
- [ ] Admin can approve/reject at appropriate times
- [ ] App time affects all calculations
- [ ] API responses match expected JSON structure

---

## 🛠 Development Workflow

1. **Implement endpoint** - Follow API endpoint specification
2. **Add business logic** - Use code examples as reference
3. **Test locally** - Compare against reference implementation
4. **Validate calculations** - Ensure penny-perfect accuracy
5. **Test edge cases** - Run test scenarios
6. **Document** - Comment complex logic

---

## 📞 Need Help?

### Documentation Issues
If anything is unclear or missing, please flag it immediately. This documentation should be your complete reference.

### Reference Implementation
The existing Next.js implementation in `/app/api/` serves as the source of truth. When in doubt, check how the current API handles a specific scenario.

### Calculation Verification
Use the admin time machine to test calculations at different dates. Results must match the existing system exactly.

---

## 🎓 Additional Resources

- **Project Root README** - Project overview and setup instructions
- **BACKEND-GUIDE.md** - Comprehensive implementation guide (read first!)
- `/lib/investmentCalculations.js` - Reference calculation logic
- `/lib/idGenerator.js` - ID generation patterns
- `/lib/database.js` - Data access patterns
- `/testing-docs/` - Test scenarios and expected results

---

**Ready to start?** Open [BACKEND-GUIDE.md](./BACKEND-GUIDE.md) and begin reading! 🚀
