# Backend Documentation

**Single source of truth for backend developers**

## 📄 BACKEND-GUIDE.md

This is the **only document** you need to implement the backend.

### What's Inside

✅ **Investment States** - Complete lifecycle from draft to withdrawn  
✅ **Business Rules** - All validation and calculation logic  
✅ **Interest Calculations** - Prorated monthly calculations with examples  
✅ **Pending Payouts** - Failed payment queue system  
✅ **Withdrawal Logic** - 90-day notice + lockup period rules  
✅ **Data Models** - Complete JSON schemas for all entities  
✅ **API Endpoints** - All required endpoints  
✅ **Code Examples** - Python implementation examples  
✅ **Database Indexes** - Performance optimization queries  
✅ **Testing Guide** - How to validate your implementation  

### Quick Start

1. Read **BACKEND-GUIDE.md** from top to bottom
2. Implement the 6 investment states exactly as defined
3. Use the code examples as your reference
4. Match the API endpoint structure precisely
5. Test against the existing Next.js implementation

### Key Points

- Frontend expects **exact JSON structure** from data models
- Investment states are: `draft`, `pending`, `active`, `withdrawal_notice`, `withdrawn`, `rejected`
- Interest calculations must be **daily-prorated** for partial months
- All dates/times must use **app time** (not real time) for testing support
- Calculations must match **to the penny**

---

**Need help?** Check the existing Next.js API routes in `/app/api/` for reference implementation.
