# Robert Ventures Investor Desk

A minimalist investment platform for Robert Ventures investors.

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Environment Setup

**IMPORTANT:** Never commit real API keys or secrets to git!

#### Copy the example environment file:
```bash
cp .env.example .env.local
```

#### Configure your `.env.local` file:

Open `.env.local` and update the following values:

**JWT Secrets (REQUIRED - CRITICAL FOR SECURITY):**

🔒 **IMPORTANT:** The application will **refuse to start** in production without proper JWT secrets!

These secrets protect ALL user authentication. Without them, attackers can forge login tokens and access any account.

Generate strong random secrets (run this command twice):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Security Requirements:**
- ✅ Minimum 32 characters long
- ✅ Cryptographically random (use the command above)
- ✅ Different for development and production
- ✅ Never commit to git or share publicly
- ✅ Rotate periodically (every 90 days recommended)

**Email Service (Required for investor imports and notifications):**
- Sign up for a free account at [Resend.com](https://resend.com)
- Get your API key from https://resend.com/api-keys
- Add your API key to `RESEND_API_KEY`
- For development, use `EMAIL_FROM=onboarding@resend.dev`
- For production, verify your domain and use your own email

**Application URL:**
- Development: `http://localhost:3000` (or your dev port)
- Production: Your actual domain (e.g., `https://investors.robertventures.com`)

**Example `.env.local`:**
```bash
# JWT Authentication (REQUIRED)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
JWT_REFRESH_SECRET=z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4

# Email Service
RESEND_API_KEY=re_YourActualAPIKeyHere
EMAIL_FROM=onboarding@resend.dev

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Security Checklist:**
- ✅ `.env.local` is already in `.gitignore`
- ✅ Never share your `.env.local` file
- ✅ Use different secrets for development and production
- ✅ Rotate secrets if they are ever exposed

### 3. Run the development server
```bash
npm run dev
```

### 4. Open your browser
Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

- `app/page.js` - Homepage with signup form
- `app/components/Header.js` - Header component with Robert Ventures branding
- `app/components/SignupForm.js` - Email signup form with human verification
- `app/globals.css` - Global styles and wireframe utilities

## Design Philosophy

This app follows a wireframe-style minimalist design with:
- Grayscale color palette
- Simple borders and layouts
- Scoped CSS using styled-jsx for component-specific styles
- Global CSS for shared utilities and base styles

## Features

### Investor Portal
- Email input validation
- Human verification checkbox
- Responsive design
- Wireframe-style aesthetics
- Investment management
- Transaction history
- Document access

### Admin Dashboard
- User account management
- Investment approval workflow
- Withdrawal processing
- Tax reporting and compliance
- Time machine (date simulation for testing)
- **Investor Import System** - Migrate investors from Wealthblock or other platforms
- **Master Password Generator** - Temporary access to any investor account for testing (30-minute expiration)

## Investor Import & Migration

The platform includes a comprehensive import system for migrating investors from external platforms like Wealthblock.

**Key Features:**
- CSV/Excel file upload with field mapping
- Interactive data preview and editing
- Bulk import with validation
- Automated welcome email sending with password setup links
- Support for complete investor profiles, investments, and transaction history

**Setup & Usage:**
See [docs/INVESTOR-IMPORT-SETUP.md](docs/INVESTOR-IMPORT-SETUP.md) for detailed setup instructions including:
- Resend email service configuration
- CSV format requirements
- Field mapping guide
- Testing procedures

**Environment Variables Required:**
```bash
RESEND_API_KEY=your_api_key
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Authentication & Security

The platform uses JWT (JSON Web Tokens) for secure authentication:

- **HTTP-only cookies** - Tokens stored securely, protected from XSS attacks
- **Bcrypt password hashing** - All passwords are hashed with industry-standard bcrypt (10 salt rounds)
- **Token expiration** - Access tokens expire after 7 days, refresh tokens after 30 days
- **Seamless password migration** - Plain-text passwords are automatically hashed on first login
- **Server-side validation** - All protected routes verify JWT tokens on the backend

### Admin Testing Features

**Master Password Generator:**
Admins can generate a temporary master password from the Operations tab that:
- Allows login to ANY investor account using the master password
- Expires automatically after 30 minutes
- Is cryptographically secure (16 characters, high entropy)
- Enables thorough testing from the investor's perspective

**Usage:**
1. Go to Admin Dashboard → Operations tab
2. Click "Generate Master Password"
3. Copy the displayed password
4. Open a new browser window/incognito session
5. Login to any investor account using their email + the master password
6. Test the investor experience directly

### Security Best Practices

- Always use strong, unique values for `JWT_SECRET` and `JWT_REFRESH_SECRET` in production
- Never commit `.env.local` to version control
- Rotate JWT secrets periodically
- Use the master password feature only for testing, not for production account access
- Master passwords automatically expire - no manual cleanup needed
