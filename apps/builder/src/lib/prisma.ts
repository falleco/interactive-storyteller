import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';

const globalForPrisma = globalThis as unknown as {
  wonderTalesBuilderPrisma?: PrismaClient;
};

function getDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    loadDotenv({
      path: path.resolve(process.cwd(), '../api/.env'),
      quiet: true,
    });
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for the builder app');
  }
  return url;
}

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.wonderTalesBuilderPrisma) {
    globalForPrisma.wonderTalesBuilderPrisma = createClient();
  }
  return globalForPrisma.wonderTalesBuilderPrisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
