# Email Setup Guide

This guide covers configuring SMTP email for the Warehouse Tire platform. Email is required for:
- Order confirmation emails
- Abandoned cart recovery emails
- Contact form notifications
- Password reset emails

---

## GoDaddy Microsoft 365 Email

If your email is hosted through GoDaddy's Microsoft 365 (Business Professional, etc.), follow these steps.

### Step 1: Disable Security Defaults

Microsoft 365 "Security Defaults" blocks SMTP authentication by default. You must disable it.

1. **Log into GoDaddy**
   - Go to https://productivity.godaddy.com/settings

2. **Navigate to Security Settings**
   - Top menu → **Admin** → **Security Settings**
   - Or go directly to: `https://productivity.godaddy.com/#/admin/securitysettings`

3. **Find "Protect Your Email With Security Defaults"**
   - Click the **Manage** button

4. **Disable Security Defaults**
   - Select your domain from the dropdown
   - **Uncheck** "Enable security defaults"
   - Click **Save**
   - Wait for confirmation: "Security default settings updated"

### Step 2: Enable SMTP Authentication

1. **Go to Email & Office Overview**
   - https://productivity.godaddy.com/

2. **Click on the email account** you want to use for sending

3. **Scroll down to "Advanced Settings"**
   - If collapsed, click to expand

4. **Enable SMTP Authentication**
   - Toggle "SMTP Authentication" to **ON**

### Step 3: Set/Reset Email Password

If you haven't already, set a password for the email account:

1. On the mailbox settings page, click **Password** under "Manage"
2. Enter a new password
3. Save it - you'll need this for the admin settings

### Step 4: Configure in Admin Panel

Go to your site's admin panel → Settings → Email Configuration:

| Setting | Value |
|---------|-------|
| SMTP Host | `smtp.office365.com` |
| SMTP Port | `587` |
| SMTP Security | `STARTTLS` |
| SMTP Username | Your full email (e.g., `orders@yourdomain.com`) |
| SMTP Password | The password you set in Step 3 |
| From Email | Same as username |
| From Name | Your business name |

Click **Test Email** to verify the configuration.

### Troubleshooting

**Error: "Authentication unsuccessful, user is locked by your organization's security defaults policy"**
- Security Defaults is still enabled. Repeat Step 1.

**Error: "Invalid login" or "Authentication failed"**
- Double-check username (must be full email address)
- Reset the password and try again
- Verify SMTP Authentication is enabled (Step 2)

**Error: "Connection timeout"**
- Check firewall isn't blocking port 587
- Verify SMTP host is exactly `smtp.office365.com`

---

## Gmail / Google Workspace

For Gmail or Google Workspace accounts, you need an App Password (regular passwords won't work).

### Step 1: Enable 2-Factor Authentication

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** if not already enabled

### Step 2: Generate App Password

1. Go to https://myaccount.google.com/apppasswords
2. Select app: **Mail**
3. Select device: **Other** (enter "Warehouse Tire" or similar)
4. Click **Generate**
5. Copy the 16-character password (spaces don't matter)

### Step 3: Configure in Admin Panel

| Setting | Value |
|---------|-------|
| SMTP Host | `smtp.gmail.com` |
| SMTP Port | `587` |
| SMTP Security | `STARTTLS` |
| SMTP Username | Your full Gmail address |
| SMTP Password | The 16-character App Password |
| From Email | Same as username |
| From Name | Your business name |

---

## Generic SMTP (SendGrid, Mailgun, etc.)

For transactional email services:

### SendGrid

| Setting | Value |
|---------|-------|
| SMTP Host | `smtp.sendgrid.net` |
| SMTP Port | `587` |
| SMTP Security | `STARTTLS` |
| SMTP Username | `apikey` |
| SMTP Password | Your SendGrid API key |

### Mailgun

| Setting | Value |
|---------|-------|
| SMTP Host | `smtp.mailgun.org` |
| SMTP Port | `587` |
| SMTP Security | `STARTTLS` |
| SMTP Username | Your Mailgun SMTP username |
| SMTP Password | Your Mailgun SMTP password |

### Amazon SES

| Setting | Value |
|---------|-------|
| SMTP Host | `email-smtp.{region}.amazonaws.com` |
| SMTP Port | `587` |
| SMTP Security | `STARTTLS` |
| SMTP Username | Your SES SMTP username |
| SMTP Password | Your SES SMTP password |

---

## Testing

After configuration, always send a test email:

1. Go to Admin → Settings → Email Configuration
2. Click **Test Email**
3. Check your inbox for the test message
4. If it fails, check the error message and refer to Troubleshooting above

## Email Deliverability Tips

1. **Use a real domain email** - Avoid gmail.com for business emails; use your own domain
2. **Set up SPF records** - Your hosting provider should help with this
3. **Set up DKIM** - Improves deliverability and prevents spoofing
4. **Monitor spam folders** - Ask customers to check spam if they don't receive emails
5. **Use consistent From address** - Don't change it frequently
