import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is required to initialize PrismaClient');
  }

  return url;
}

export function createPrismaClientOptions(): ConstructorParameters<
  typeof PrismaClient
>[0] {
  return {
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  };
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient(createPrismaClientOptions());
}
