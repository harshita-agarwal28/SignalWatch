import { PrismaClient } from '@prisma/client'

// A single shared Prisma client for the process. Prisma manages its own
// connection pool internally, so one instance is all a Node process needs.
export const prisma = new PrismaClient()
