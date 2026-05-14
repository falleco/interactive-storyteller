import * as AppleAuthentication from 'expo-apple-authentication';
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { Platform } from 'react-native';
import { resolveApiBaseURL } from '~/shared/api/base-url';
import { authClient } from '~/shared/auth/auth-client';

/**
 * Probe the API root with a plain `fetch` before kicking off Better
 * Auth's social flow — Better Auth's "network request failed" error
 * doesn't include the URL it tried, so without this we can't tell if
 * the issue is reachability vs. the OAuth handshake itself.
 */
async function probeApi(label: string) {
  const baseURL = resolveApiBaseURL();
  const probeUrl = `${baseURL}/api/auth/ok`;
  console.log(`[auth/${label}] probing API at`, probeUrl);
  try {
    const started = Date.now();
    const res = await fetch(probeUrl);
    console.log(
      `[auth/${label}] probe response:`,
      res.status,
      `(${Date.now() - started}ms)`,
    );
  } catch (e) {
    console.error(
      `[auth/${label}] probe FAILED — device cannot reach ${baseURL}.`,
      'Check the .env / hostUri.',
      e,
    );
  }
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  bearerToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toAuthUser(input: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified: boolean;
}): AuthUser {
  return {
    id: input.id,
    email: input.email,
    name: input.name ?? '',
    image: input.image ?? null,
    emailVerified: input.emailVerified,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending, refetch } = authClient.useSession();
  const user = data?.user ? toAuthUser(data.user) : null;
  const bearerToken = data?.session?.token ?? null;

  const signInWithGoogle = useCallback(async () => {
    console.log('[auth] signInWithGoogle: start, platform=', Platform.OS);
    await probeApi('google');
    try {
      console.log('[auth] signInWithGoogle: calling signIn.social');
      const { data, error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: 'wondertales://',
      });
      if (error) {
        console.error(
          '[auth] Google sign-in error (Better Auth):',
          JSON.stringify(error, null, 2),
        );
        throw new Error(
          error.message ?? `Google sign-in failed (status ${error.status})`,
        );
      }
      console.log('[auth] signInWithGoogle: response', data);
    } catch (e) {
      // Catch + re-throw so we surface fetch failures from Better Auth's
      // internals (which only show the generic "Network request failed").
      console.error('[auth] signInWithGoogle: threw', {
        name: e instanceof Error ? e.name : typeof e,
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      throw e;
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    console.log('[auth] signInWithApple: start, platform=', Platform.OS);
    await probeApi('apple');
    if (Platform.OS === 'ios') {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple Sign In returned no identityToken');
      }

      try {
        const [, base64Payload] = credential.identityToken.split('.');
        const padded = base64Payload
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(
            base64Payload.length + ((4 - (base64Payload.length % 4)) % 4),
            '=',
          );
        const claims = JSON.parse(atob(padded)) as {
          iss?: string;
          aud?: string;
          sub?: string;
          email?: string;
          exp?: number;
        };
        console.log('[auth] Apple identityToken claims:', {
          iss: claims.iss,
          aud: claims.aud,
          sub: claims.sub,
          email: claims.email,
          expSeconds: claims.exp,
        });
      } catch (decodeError) {
        console.warn(
          '[auth] could not decode identityToken claims:',
          decodeError,
        );
      }

      const { error } = await authClient.signIn.social({
        provider: 'apple',
        idToken: { token: credential.identityToken },
      });
      if (error) {
        console.error('[auth] Apple sign-in error:', error);
        throw new Error(
          error.message ?? `Apple sign-in failed (status ${error.status})`,
        );
      }
      await refetch();
      return;
    }

    try {
      console.log(
        '[auth] signInWithApple: non-iOS, calling signIn.social (web flow)',
      );
      const { error } = await authClient.signIn.social({
        provider: 'apple',
        callbackURL: 'wondertales://',
      });
      if (error) {
        console.error(
          '[auth] Apple sign-in error (Better Auth):',
          JSON.stringify(error, null, 2),
        );
        throw new Error(
          error.message ?? `Apple sign-in failed (status ${error.status})`,
        );
      }
    } catch (e) {
      console.error('[auth] signInWithApple: threw', {
        name: e instanceof Error ? e.name : typeof e,
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      throw e;
    }
  }, [refetch]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    await refetch();
  }, [refetch]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading: isPending,
      bearerToken,
      signInWithGoogle,
      signInWithApple,
      signOut,
      refetch: async () => {
        await refetch();
      },
    }),
    [
      user,
      isPending,
      bearerToken,
      signInWithGoogle,
      signInWithApple,
      signOut,
      refetch,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
