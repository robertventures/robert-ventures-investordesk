# Robert Ventures Investor Desk

A minimalist investment platform for Robert Ventures investors.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
