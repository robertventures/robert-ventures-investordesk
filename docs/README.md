# Documentation Index

## 📚 Backend Documentation

Complete backend implementation guide for the Robert Ventures Investment Platform.

### Main Documentation

**[BACKEND-GUIDE.md](./BACKEND-GUIDE.md)** - Complete backend implementation guide

**Purpose:** Comprehensive guide for implementing the backend in any technology stack
**Contains:**
- Quick Setup & Configuration
- Platform Overview & Business Rules
- JWT Authentication & Security
- Data Models & ID Architecture
- Investment State Machine
- Interest Calculations (penny-perfect formulas)
- Transaction System & Audit Trail
- Withdrawal Rules
- **API Endpoints** (RESTful endpoints including new refactored structure)
- Admin Features
- Testing Requirements
- Migration & Onboarding System
- Supabase Architecture
- Document Manager System

**Read Time:** 30-60 minutes for full guide

---

## 🎯 Quick Navigation

### For Backend Developers
- **Getting Started:** [BACKEND-GUIDE.md - Quick Setup](./BACKEND-GUIDE.md#quick-setup)
- **API Endpoints:** [BACKEND-GUIDE.md - API Endpoints](./BACKEND-GUIDE.md#api-endpoints)
- **Authentication:** [BACKEND-GUIDE.md - Authentication & Security](./BACKEND-GUIDE.md#authentication--security)
- **Calculations:** [BACKEND-GUIDE.md - Interest Calculations](./BACKEND-GUIDE.md#interest-calculations)

### For Frontend Developers
- **API Reference:** [BACKEND-GUIDE.md - API Endpoints](./BACKEND-GUIDE.md#api-endpoints)
- **Data Models:** [BACKEND-GUIDE.md - Data Models](./BACKEND-GUIDE.md#data-models)
- **Authentication Flow:** [BACKEND-GUIDE.md - Authentication](./BACKEND-GUIDE.md#authentication--security)

### For Product/Management
- **Business Rules:** [BACKEND-GUIDE.md - Core Business Rules](./BACKEND-GUIDE.md#core-business-rules)
- **Platform Overview:** [BACKEND-GUIDE.md - Platform Overview](./BACKEND-GUIDE.md#platform-overview)

---

## 📝 API Changes (October 2025)

### New RESTful Endpoints

The API has been refactored to follow REST best practices. New endpoints are now available:

**Profile Management:**
- `GET /api/users/profile` - Get current user's profile
- `PUT /api/users/profile` - Update current user's profile

**Account Operations:**
- `POST /api/users/account/verify` - Verify account with code
- `POST /api/users/account/change-password` - Change password

**Investment Management:**
- `POST /api/users/investments` - Create new investment
- `GET /api/users/investments` - List all investments
- `GET /api/users/investments/:id` - Get specific investment
- `PUT /api/users/investments/:id` - Update investment
- `DELETE /api/users/investments/:id` - Delete investment

**Legacy Endpoints:**
Old endpoints (e.g., `PUT /api/users/[id]` with `_action` parameter) are still supported for backwards compatibility but are deprecated. See [BACKEND-GUIDE.md - API Endpoints](./BACKEND-GUIDE.md#api-endpoints) for migration details.

---

## 🔑 Key Features

### Authentication System
- JWT-based authentication with HTTP-only cookies
- 7-day access tokens, 30-day refresh tokens
- Bcrypt password hashing
- Master password system for admin testing
- Rate limiting on sensitive operations

### Data Architecture
- Sequential IDs (USR-1001, INV-10000) - human-readable
- Immutable transaction system for complete audit trail
- Supabase PostgreSQL database
- Row Level Security (RLS) for data protection

### Investment Platform
- $1,000 minimum investment
- 1-year (8% APY) or 3-year (10% APY) lockup periods
- Monthly payout or compounding options
- ACH auto-approval up to $100k
- Wire transfer for larger amounts or IRA accounts

### Admin Features
- Time Machine (app time control for testing)
- Master password generation
- Document manager (bulk upload, email notifications)
- Investment approval workflow
- Comprehensive audit logging

---

## 🚀 Getting Started

### Prerequisites
```bash
# Required environment variables
JWT_SECRET=your-secret-32-byte-hex
JWT_REFRESH_SECRET=your-refresh-secret-32-bytes
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-key
```

### Quick Start
1. Read [BACKEND-GUIDE.md](./BACKEND-GUIDE.md)
2. Set up Supabase database (see Quick Setup section)
3. Configure environment variables
4. Implement data models matching JSON structure
5. Build API endpoints following specifications
6. Test against provided scenarios

---

## 📖 Documentation Structure

### BACKEND-GUIDE.md Sections

1. **Quick Setup** - Environment setup and database tables
2. **Platform Overview** - Business logic and requirements
3. **Core Business Rules** - Investment amounts, rates, restrictions
4. **Authentication & Security** - JWT, passwords, security best practices
5. **Data Models** - User, Investment, Transaction schemas
6. **ID Architecture** - Sequential ID generation patterns
7. **Investment State Machine** - Status transitions and rules
8. **Interest Calculations** - Penny-perfect formulas with proration
9. **Transaction System** - Immutable audit trail
10. **Withdrawal Rules** - Eligibility and calculations
11. **API Endpoints** - Complete REST API reference (includes new refactored endpoints)
12. **Admin Features** - Admin tools and operations
13. **Testing Requirements** - Test scenarios and validation
14. **Migration & Onboarding** - Investor import and onboarding system
15. **Supabase Architecture** - Database structure and patterns
16. **Document Manager** - Document upload and distribution system

---

## 🎓 Implementation Approach

1. **Choose Your Stack** - Python, Node.js, Java, Go, etc.
2. **Set Up Authentication** - JWT with bcrypt password hashing
3. **Implement Data Models** - Match JSON structure exactly
4. **Build ID Generators** - Sequential IDs (not UUIDs)
5. **Implement Calculations** - Test against reference for accuracy
6. **Create API Endpoints** - Follow REST specifications
7. **Add Security** - Rate limiting, input validation, audit logging
8. **Test Thoroughly** - Validate calculations match penny-for-penny

**Reference Implementation:** Next.js codebase in `/lib/` and `/app/api/`

---

## ✅ Success Criteria

Your backend is ready when:
- ✅ All API endpoints match specifications
- ✅ Calculations match reference implementation exactly
- ✅ JWT authentication working with HTTP-only cookies
- ✅ Passwords hashed with bcrypt
- ✅ Sequential IDs generated correctly
- ✅ Transaction audit trail immutable
- ✅ All test scenarios pass
- ✅ Frontend can connect and operate normally

---

## 🔍 Need Help?

- **API Questions:** See [API Endpoints section](./BACKEND-GUIDE.md#api-endpoints)
- **Calculation Issues:** See [Interest Calculations](./BACKEND-GUIDE.md#interest-calculations)
- **Auth Problems:** See [Authentication & Security](./BACKEND-GUIDE.md#authentication--security)
- **Data Structure:** See [Data Models](./BACKEND-GUIDE.md#data-models)

---

## 📅 Recent Updates

- **October 2025:** API refactoring - new RESTful endpoints added
- **January 2025:** Document Manager system added
- **December 2024:** Supabase migration completed
- **Initial Release:** JWT authentication and core investment platform

