import { expo } from '@better-auth/expo';
import { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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
});

export type AuthApi = typeof auth;
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
