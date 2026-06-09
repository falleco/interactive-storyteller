import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { bearer } from 'better-auth/plugins';
import jwt from 'jsonwebtoken';
import { createPrismaClient } from '../prisma/create-prisma-client';
import {
  getUserEventsQueue,
  type UserCreatedJobData,
  UserEventJobName,
} from '../queue/user-events.queue';

const prisma = createPrismaClient();

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const trustedOrigins = [
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  'https://appleid.apple.com',
];

function buildAppleClientSecret(): string {
  const teamId = readEnv('APPLE_TEAM_ID');
  const keyId = readEnv('APPLE_KEY_ID');
  const clientId = readEnv('APPLE_CLIENT_ID');
  const privateKey = readEnv('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n');

  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    issuer: teamId,
    subject: clientId,
    audience: 'https://appleid.apple.com',
    expiresIn: '180d',
    keyid: keyId,
  });
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: readEnv('BETTER_AUTH_SECRET'),
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: readEnv('GOOGLE_CLIENT_ID'),
      clientSecret: readEnv('GOOGLE_CLIENT_SECRET'),
    },
    apple: {
      clientId: readEnv('APPLE_CLIENT_ID'),
      clientSecret: buildAppleClientSecret(),
      appBundleIdentifier: process.env.APPLE_BUNDLE_IDENTIFIER,
      // In dev we also accept Expo Go's bundle id so Sign In With Apple works
      // before the dev/standalone build is installed. Never enable in prod —
      // it would let any Expo Go session impersonate this app.
      audience:
        process.env.NODE_ENV === 'production'
          ? undefined
          : [readEnv('APPLE_BUNDLE_IDENTIFIER'), 'host.exp.Exponent'],
    },
  },
  trustedOrigins,
  plugins: [expo(), bearer()],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const payload: UserCreatedJobData = {
              userId: user.id,
              email: user.email,
              name: user.name ?? null,
              image: user.image ?? null,
              emailVerified: Boolean(user.emailVerified),
              createdAt:
                user.createdAt instanceof Date
                  ? user.createdAt.toISOString()
                  : new Date().toISOString(),
            };
            await getUserEventsQueue().add(UserEventJobName.Created, payload, {
              attempts: 5,
              backoff: { type: 'exponential', delay: 1_000 },
              removeOnComplete: { age: 60 * 60 * 24, count: 1_000 },
              removeOnFail: { age: 60 * 60 * 24 * 7 },
            });
          } catch (error) {
            // Do not block sign-up if the queue is unreachable — just log.
            console.error('[auth] Failed to enqueue user.created job:', error);
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { active: true },
          });

          if (!user) {
            throw new APIError('UNAUTHORIZED', {
              message: 'User not found',
            });
          }

          if (!user.active) {
            throw new APIError('FORBIDDEN', {
              message: 'This account has been deactivated',
              code: 'ACCOUNT_INACTIVE',
            });
          }
        },
      },
    },
  },
});

export type AuthApi = typeof auth;
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
