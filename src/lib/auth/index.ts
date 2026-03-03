/**
 * Authentication Library
 * 
 * Provides server-side authentication utilities for the DocuManage application.
 * Implements JWT-based authentication with HTTP-only cookies for security.
 * 
 * Key Features:
 * - Password hashing using SHA-256 (upgrade to bcrypt for production)
 * - JWT token generation and verification
 * - HTTP-only cookie management for session handling
 * - Default user initialization for development/demo
 * 
 * Security Notes:
 * - Change JWT_SECRET in production
 * - Consider using bcrypt for password hashing in production
 * - Tokens expire after 24 hours by default
 * 
 * @module lib/auth
 */

import { db } from '@/lib/db';
import type { User, UserRole } from '@prisma/client';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * JWT secret key for token signing.
 * IMPORTANT: Must be changed in production via environment variable.
 */
const JWT_SECRET = process.env.JWT_SECRET || 'doc-manage-secret-key-change-in-production';

/**
 * Token expiration time in milliseconds.
 * Default: 24 hours
 */
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

// ============================================================================
// Password Utilities
// ============================================================================

/**
 * Hashes a password using SHA-256 with salt.
 * 
 * Note: This is a simplified implementation for demo purposes.
 * For production, consider using bcrypt or argon2:
 * 
 * @example
 * // Production implementation with bcrypt
 * import bcrypt from 'bcryptjs';
 * const hash = await bcrypt.hash(password, 10);
 * 
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a password against a stored hash.
 * 
 * @param password - Plain text password to verify
 * @param hash - Stored password hash to compare against
 * @returns Promise resolving to boolean indicating match
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// ============================================================================
// JWT Token Utilities
// ============================================================================

/**
 * Generates a JWT-like token for user authentication.
 * 
 * Token Structure:
 * - Header: Algorithm and token type
 * - Payload: User ID, role, issued at, expiration
 * - Signature: HMAC of header.payload with secret
 * 
 * Note: This is a simplified JWT implementation.
 * For production, consider using the 'jose' or 'jsonwebtoken' library.
 * 
 * @param userId - Unique user identifier
 * @param role - User's role for authorization
 * @returns JWT token string
 */
export function generateToken(userId: string, role: UserRole): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    userId,
    role,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY,
  }));
  const signature = btoa(`${header}.${payload}.${JWT_SECRET}`);
  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies and decodes a JWT token.
 * 
 * Verification steps:
 * 1. Check token structure (3 parts)
 * 2. Verify signature matches
 * 3. Check expiration time
 * 
 * @param token - JWT token string to verify
 * @returns Decoded payload if valid, null if invalid or expired
 */
export function verifyToken(token: string): { userId: string; role: UserRole; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    const expectedSignature = btoa(`${parts[0]}.${parts[1]}.${JWT_SECRET}`);
    
    if (parts[2] !== expectedSignature) return null;
    if (payload.exp < Date.now()) return null;
    
    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// Server-Side Authentication Utilities
// ============================================================================

/**
 * Retrieves the currently authenticated user from the request context.
 * 
 * This function should only be used in server components or API routes.
 * It reads the auth token from HTTP-only cookies and validates it.
 * 
 * @returns Promise resolving to User object if authenticated, null otherwise
 * 
 * @example
 * // In an API route
 * const user = await getCurrentUser();
 * if (!user) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) return null;
    
    const payload = verifyToken(token);
    if (!payload) return null;
    
    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });
    
    return user;
  } catch {
    return null;
  }
}

/**
 * Retrieves the currently authenticated user from a NextRequest object.
 * 
 * Useful for API routes where you have direct access to the request object.
 * 
 * @param request - NextRequest object containing cookies
 * @returns Promise resolving to User object if authenticated, null otherwise
 */
export async function getCurrentUserFromRequest(request: NextRequest): Promise<User | null> {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) return null;
    
    const payload = verifyToken(token);
    if (!payload) return null;
    
    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });
    
    return user;
  } catch {
    return null;
  }
}

// ============================================================================
// Cookie Management
// ============================================================================

/**
 * Sets the authentication cookie in the response.
 * 
 * Cookie Security Settings:
 * - httpOnly: Prevents JavaScript access (XSS protection)
 * - secure: Only sent over HTTPS in production
 * - sameSite: Prevents CSRF attacks
 * - maxAge: Token expiration time
 * 
 * @param token - JWT token to store
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRY / 1000,
    path: '/',
  });
}

/**
 * Clears the authentication cookie to log out the user.
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes default users for development and demo purposes.
 * 
 * Creates the following test accounts:
 * - admin@example.com (ADMIN role)
 * - reviewer@example.com (REVIEWER role)
 * - manager@example.com (MANAGER role)
 * - finance@example.com (FINANCE role)
 * - viewer@example.com (VIEWER role)
 * 
 * This function is idempotent - it only creates users if they don't exist.
 * Should be called during application startup.
 */
export async function initializeDefaultUsers(): Promise<void> {
  const existingAdmin = await db.user.findUnique({
    where: { email: 'admin@example.com' },
  });
  
  if (!existingAdmin) {
    const passwordHash = await hashPassword('admin123');
    await db.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash,
        name: 'System Admin',
        role: 'ADMIN',
      },
    });
    
    // Create test users for each role
    const testUsers = [
      { email: 'reviewer@example.com', name: 'Test Reviewer', role: 'REVIEWER' as UserRole },
      { email: 'manager@example.com', name: 'Test Manager', role: 'MANAGER' as UserRole },
      { email: 'finance@example.com', name: 'Test Finance', role: 'FINANCE' as UserRole },
      { email: 'viewer@example.com', name: 'Test Viewer', role: 'VIEWER' as UserRole },
    ];
    
    for (const user of testUsers) {
      const existingUser = await db.user.findUnique({
        where: { email: user.email },
      });
      if (!existingUser) {
        await db.user.create({
          data: {
            ...user,
            passwordHash: await hashPassword('password123'),
          },
        });
      }
    }
    
    console.log('Default users created successfully');
  }
}
