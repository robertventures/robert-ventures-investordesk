/**
 * Email Service - Resend Integration
 * 
 * Handles sending emails for investor onboarding, password resets, and notifications
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const fromEmail = process.env.EMAIL_FROM || 'noreply@robertventures.com'
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Send welcome email to newly imported investor with password setup link
 */
export async function sendWelcomeEmail({ email, firstName, lastName, resetToken }) {
  const resetLink = `${appUrl}/reset-password?token=${resetToken}`
  
  const subject = 'Welcome to Robert Ventures Investor Portal'
  const html = generateWelcomeEmailHTML({ firstName, lastName, resetLink })
  const text = generateWelcomeEmailText({ firstName, lastName, resetLink })

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html,
      text
    })

    console.log(`Welcome email sent to ${email}:`, result)
    return { success: true, messageId: result.id }
  } catch (error) {
    console.error(`Failed to send welcome email to ${email}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({ email, resetToken }) {
  const resetLink = `${appUrl}/reset-password?token=${resetToken}`
  
  const subject = 'Reset Your Password - Robert Ventures'
  const html = generatePasswordResetHTML({ resetLink })
  const text = generatePasswordResetText({ resetLink })

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html,
      text
    })

    console.log(`Password reset email sent to ${email}:`, result)
    return { success: true, messageId: result.id }
  } catch (error) {
    console.error(`Failed to send password reset email to ${email}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Send bulk welcome emails to multiple investors
 */
export async function sendBulkWelcomeEmails(investors) {
  const results = []
  
  for (const investor of investors) {
    const result = await sendWelcomeEmail(investor)
    results.push({
      email: investor.email,
      ...result
    })
    
    // Small delay to avoid rate limiting (50ms between emails)
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  return results
}

// ============================================================================
// Email Templates
// ============================================================================

function generateWelcomeEmailHTML({ firstName, lastName, resetLink }) {
  // Use onboarding link instead of direct password reset
  const onboardingLink = resetLink.replace('/reset-password', '/onboarding')
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Robert Ventures</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f8f9fa;
      padding: 30px 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: 600;
    }
    .steps {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .step {
      padding: 12px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .step:last-child {
      border-bottom: none;
    }
    .step-number {
      display: inline-block;
      background: #667eea;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      margin-right: 10px;
      font-weight: bold;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Welcome to Robert Ventures</h1>
  </div>
  <div class="content">
    <p>Hello ${firstName} ${lastName},</p>
    
    <p>Welcome to the Robert Ventures Investor Portal! We've migrated your investor account from Wealthblock to our new platform.</p>
    
    <p>To complete your account setup, please click the button below:</p>
    
    <div style="text-align: center;">
      <a href="${onboardingLink}" class="button">Complete Account Setup</a>
    </div>
    
    <p>This link will expire in 24 hours for security purposes.</p>
    
    <p><strong>What to Expect:</strong></p>
    <div class="steps">
      <div class="step">
        <span class="step-number">1</span>
        <strong>Set Your Password</strong> - Create a secure password for your account
      </div>
      <div class="step">
        <span class="step-number">2</span>
        <strong>Verify Your SSN</strong> - Required for tax compliance (IRS Form 1099)
      </div>
      <div class="step">
        <span class="step-number">3</span>
        <strong>Link Bank Account</strong> - Add your bank details to receive distributions
      </div>
    </div>
    
    <p><strong>After Setup:</strong></p>
    <ul>
      <li>View your complete investment portfolio</li>
      <li>Access your transaction history</li>
      <li>Review distributions and statements</li>
      <li>Manage your account preferences</li>
    </ul>
    
    <p>If you didn't expect this email or have any questions, please contact our support team.</p>
    
    <p>Best regards,<br>The Robert Ventures Team</p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Robert Ventures. All rights reserved.</p>
    <p>If the button above doesn't work, copy and paste this link into your browser:<br>
    <a href="${onboardingLink}">${onboardingLink}</a></p>
  </div>
</body>
</html>
  `
}

function generateWelcomeEmailText({ firstName, lastName, resetLink }) {
  return `
Welcome to Robert Ventures

Hello ${firstName} ${lastName},

Welcome to the Robert Ventures Investor Portal! We've migrated your investor account from Wealthblock to our new platform.

To get started, please set up your password by visiting this link:
${resetLink}

This link will expire in 24 hours for security purposes.

What's Next?
- Set up your password using the link above
- Log in to view your investment portfolio
- Access your complete transaction history
- Review distributions and statements

If you didn't expect this email or have any questions, please contact our support team.

Best regards,
The Robert Ventures Team

© ${new Date().getFullYear()} Robert Ventures. All rights reserved.
  `
}

function generatePasswordResetHTML({ resetLink }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f8f9fa;
      padding: 30px 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Reset Your Password</h1>
  </div>
  <div class="content">
    <p>You requested to reset your password for your Robert Ventures account.</p>
    
    <p>Click the button below to reset your password:</p>
    
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    
    <p>This link will expire in 24 hours for security purposes.</p>
    
    <p>If you didn't request a password reset, you can safely ignore this email.</p>
    
    <p>Best regards,<br>The Robert Ventures Team</p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Robert Ventures. All rights reserved.</p>
    <p>If the button above doesn't work, copy and paste this link into your browser:<br>
    <a href="${resetLink}">${resetLink}</a></p>
  </div>
</body>
</html>
  `
}

function generatePasswordResetText({ resetLink }) {
  return `
Reset Your Password

You requested to reset your password for your Robert Ventures account.

Visit this link to reset your password:
${resetLink}

This link will expire in 24 hours for security purposes.

If you didn't request a password reset, you can safely ignore this email.

Best regards,
The Robert Ventures Team

© ${new Date().getFullYear()} Robert Ventures. All rights reserved.
  `
}

