import { PrismaClient, Prisma } from '@prisma/client';

// Production logging configuration
const prismaOptions: Prisma.PrismaClientOptions = {
  log: [
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
};

// For development environment only
if (process.env.NODE_ENV === 'development') {
  prismaOptions.log?.push(
    { level: 'query', emit: 'stdout' },
    { level: 'info', emit: 'stdout' }
  );
}

// Prevent multiple instances in development
declare global {
  var prisma: PrismaClient | undefined;
}

const prismaClient = global.prisma || new PrismaClient(prismaOptions);

if (process.env.NODE_ENV === 'development') {
  global.prisma = prismaClient;
}

export const prisma = prismaClient;

// Export commonly used types
export type {
  Prisma,
  User,
  Address,
  Session,
} from '@prisma/client';

export default prisma;
