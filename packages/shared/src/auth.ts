import type { PublicUser } from './user';

export type SocialProvider = 'google' | 'apple';

export interface Session {
  id: string;
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuthSession {
  session: Session;
  user: PublicUser;
}
