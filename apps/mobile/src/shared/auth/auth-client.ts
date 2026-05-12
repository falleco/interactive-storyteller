import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

function resolveBaseURL(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    return `http://${host}:4000`;
  }

  return 'http://localhost:4000';
}

const baseURL = resolveBaseURL();
console.log('[auth] auth client baseURL:', baseURL);

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: 'wondertales',
      storagePrefix: 'wondertales',
      storage: SecureStore,
    }),
  ],
});

export type AuthClient = typeof authClient;
