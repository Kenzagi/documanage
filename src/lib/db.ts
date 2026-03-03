/**
 * Database Connection Module
 * 
 * Provides a singleton Prisma client instance for database operations.
 * Implements the recommended Prisma pattern for Next.js applications
 * to prevent multiple database connections during development hot-reloads.
 * 
 * Why Singleton Pattern?
 * In development, Next.js hot-reloads can create multiple PrismaClient
 * instances, exhausting database connections. This pattern stores the
 * client on the global object, reusing the same instance across reloads.
 * 
 * @module lib/db
 * @see https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 */

import { PrismaClient } from '@prisma/client';

/**
 * Global type extension for Prisma client singleton.
 * Uses 'unknown' for safer type casting while maintaining the singleton pattern.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma client instance.
 * 
 * Creation Logic:
 * 1. If a client already exists on global object, reuse it
 * 2. Otherwise, create a new PrismaClient instance
 * 3. Store the instance on global object for development hot-reloads
 * 
 * Configuration:
 * - log: ['query'] - Logs all database queries (useful for debugging)
 *   Remove in production for better performance
 * 
 * @example
 * // Import and use in any server-side code
 * import { db } from '@/lib/db';
 * 
 * const users = await db.user.findMany();
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Log all queries in development for debugging
    // Remove or change to ['error'] in production
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

/**
 * Store the client on global object in development.
 * This prevents creating new connections on every hot-reload.
 * In production, this is unnecessary as the module is not reloaded.
 */
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Export default for convenience imports.
 * @example
 * import db from '@/lib/db';
 */
export default db;
