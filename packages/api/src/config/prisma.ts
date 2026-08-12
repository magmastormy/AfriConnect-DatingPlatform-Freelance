import { PrismaClient } from '@prisma/client';

/** Single Prisma instance shared across the API (pooled by the driver). */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
