/**
 * Better Auth API Route Handler
 * 
 * Handles all authentication API requests at /api/auth/*
 * 
 * Endpoints provided by Better Auth:
 * - POST /api/auth/sign-up/email - Create account
 * - POST /api/auth/sign-in/email - Login
 * - POST /api/auth/sign-out - Logout
 * - GET  /api/auth/session - Get current session
 * - POST /api/auth/verify-email - Verify email token
 * - POST /api/auth/forgot-password - Request password reset
 * - POST /api/auth/reset-password - Reset password with token
 * - POST /api/auth/send-verification-email - Resend verification
 * 
 * @created 2026-08-20
 */

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Export handlers for Next.js App Router
export const { GET, POST } = toNextJsHandler(auth.handler);

// Ensure this route uses Node.js runtime for crypto operations
export const runtime = "nodejs";

// Don't cache auth responses
export const dynamic = "force-dynamic";
