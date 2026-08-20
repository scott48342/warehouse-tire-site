/**
 * Better Auth Server Configuration
 * 
 * Authentication foundation for WTD customer accounts.
 * Uses existing PostgreSQL database via Drizzle adapter.
 * 
 * Features enabled:
 * - Email/password authentication
 * - Email verification (via Resend)
 * - Password reset (via Resend)
 * - Secure session management
 * - Rate limiting
 * - CSRF protection
 * 
 * @created 2026-08-20
 */

import { betterAuth, type User } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Resend } from "resend";
import * as authSchema from "./auth-schema";

// ============================================================================
// Database Connection
// ============================================================================

function getPostgresUrl(): string {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("Missing POSTGRES_URL environment variable");
  }
  return url;
}

// Create connection pool (same pattern as src/lib/fitment-db/db.ts)
const pool = new Pool({
  connectionString: getPostgresUrl(),
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === "production" || process.env.VERCEL
    ? { rejectUnauthorized: false }
    : (getPostgresUrl().includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined),
});

const db = drizzle(pool, { schema: authSchema });

// ============================================================================
// Email Service (Resend)
// ============================================================================

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[auth] RESEND_API_KEY not configured - emails will be logged only");
    return null;
  }
  return new Resend(apiKey);
}

const resend = getResend();

// Email sender configuration
const EMAIL_FROM = process.env.AUTH_EMAIL_FROM || "Warehouse Tire Direct <noreply@warehousetiredirect.com>";

// ============================================================================
// Better Auth Configuration
// ============================================================================

// Auth secret for signing tokens (required by Better Auth)
function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    // In development, use a default secret (NOT for production)
    if (process.env.NODE_ENV === "development") {
      console.warn("[auth] BETTER_AUTH_SECRET not set - using development default. DO NOT use in production!");
      return "wtd-dev-secret-change-me-in-production-32chars";
    }
    throw new Error("BETTER_AUTH_SECRET environment variable is required in production");
  }
  return secret;
}

export const auth = betterAuth({
  // Auth secret for signing tokens
  secret: getAuthSecret(),

  // Database adapter
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authSchema.authUsers,
      session: authSchema.authSessions,
      account: authSchema.authAccounts,
      verification: authSchema.authVerifications,
    },
  }),

  // Base URL for auth callbacks
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : "http://localhost:3000",

  // ══════════════════════════════════════════════════════════════════════════
  // Email & Password Authentication
  // ══════════════════════════════════════════════════════════════════════════
  emailAndPassword: {
    enabled: true,
    
    // Require email verification before login
    requireEmailVerification: true,
    
    // Revoke all other sessions when password is reset (security best practice)
    revokeSessionsOnPasswordReset: true,
    
    // Send verification email on signup
    sendVerificationEmail: async (
      data: { user: User; url: string; token: string },
      _request?: Request
    ) => {
      const { user, url, token } = data;
      console.log(`[auth] Sending verification email to ${user.email}`);
      
      if (!resend) {
        console.log(`[auth] [DEV] Verification URL: ${url}`);
        console.log(`[auth] [DEV] Token: ${token}`);
        return;
      }
      
      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: user.email,
          subject: "Verify your email - Warehouse Tire Direct",
          html: buildVerificationEmail(user.name || "Customer", url),
        });
        console.log(`[auth] Verification email sent to ${user.email}`);
      } catch (err) {
        console.error(`[auth] Failed to send verification email:`, err);
        // Don't throw - Better Auth handles this gracefully
      }
    },
    
    // Send password reset email
    sendResetPassword: async (
      data: { user: User; url: string; token: string },
      _request?: Request
    ) => {
      const { user, url, token } = data;
      console.log(`[auth] Sending password reset email to ${user.email}`);
      
      if (!resend) {
        console.log(`[auth] [DEV] Reset URL: ${url}`);
        console.log(`[auth] [DEV] Token: ${token}`);
        return;
      }
      
      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: user.email,
          subject: "Reset your password - Warehouse Tire Direct",
          html: buildPasswordResetEmail(user.name || "Customer", url),
        });
        console.log(`[auth] Password reset email sent to ${user.email}`);
      } catch (err) {
        console.error(`[auth] Failed to send password reset email:`, err);
      }
    },
    
    // Callback after password reset completes
    onPasswordReset: async (
      data: { user: User },
      _request?: Request
    ) => {
      const { user } = data;
      console.log(`[auth] Password reset completed for user ${user.id} (${user.email})`);
      // Future: could trigger security notification email here
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Session Configuration
  // ══════════════════════════════════════════════════════════════════════════
  session: {
    // Session duration: 30 days
    expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
    
    // Refresh session when accessed within last 7 days of expiry
    updateAge: 7 * 24 * 60 * 60, // 7 days in seconds
    
    // Cookie configuration
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes cache
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Rate Limiting (Production Security)
  // ══════════════════════════════════════════════════════════════════════════
  rateLimit: {
    enabled: true,
    
    // Global rate limit per IP
    window: 60, // 1 minute window
    max: 100, // 100 requests per minute per IP
    
    // Custom limits for sensitive endpoints
    customRules: {
      // Sign up: 5 per 10 minutes (prevent account enumeration/spam)
      "/sign-up/*": {
        window: 10 * 60,
        max: 5,
      },
      // Sign in: 10 per 5 minutes (prevent brute force)
      "/sign-in/*": {
        window: 5 * 60,
        max: 10,
      },
      // Password reset: 3 per 15 minutes
      "/forgot-password": {
        window: 15 * 60,
        max: 3,
      },
      // Email verification: 5 per 15 minutes
      "/verify-email": {
        window: 15 * 60,
        max: 5,
      },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Advanced Configuration
  // ══════════════════════════════════════════════════════════════════════════
  advanced: {
    // Use database for session storage (not JWT)
    useSecureCookies: process.env.NODE_ENV === "production",
    
    // Cookie name prefix
    cookiePrefix: "wtd_auth",
    
    // Generate IDs using UUIDs (consistent with existing WTD schema)
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Trusted Origins (CSRF Protection)
  // ══════════════════════════════════════════════════════════════════════════
  trustedOrigins: [
    "https://shop.warehousetiredirect.com",
    "https://shop.warehousetire.net",
    "https://pos.warehousetiredirect.com",
    // Vercel preview URLs
    "https://*.vercel.app",
  ],
});

// ============================================================================
// Email Templates
// ============================================================================

function buildVerificationEmail(name: string, url: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background-color: #dc2626; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Warehouse Tire Direct</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">Verify Your Email</h2>
      <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px 0;">
        Hi ${name},
      </p>
      <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px 0;">
        Thanks for creating an account with Warehouse Tire Direct. Please verify your email address by clicking the button below:
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${url}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Verify Email Address
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
        This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
      </p>
      
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        If the button doesn't work, copy and paste this URL into your browser:<br>
        <a href="${url}" style="color: #dc2626; word-break: break-all;">${url}</a>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 16px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        &copy; ${new Date().getFullYear()} Warehouse Tire Direct. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;
}

function buildPasswordResetEmail(name: string, url: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background-color: #dc2626; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Warehouse Tire Direct</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">Reset Your Password</h2>
      <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px 0;">
        Hi ${name},
      </p>
      <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px 0;">
        We received a request to reset your password. Click the button below to choose a new password:
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${url}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Reset Password
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
        This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
      
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        If the button doesn't work, copy and paste this URL into your browser:<br>
        <a href="${url}" style="color: #dc2626; word-break: break-all;">${url}</a>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 16px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        &copy; ${new Date().getFullYear()} Warehouse Tire Direct. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;
}

// Export type for use in other files
export type Auth = typeof auth;
