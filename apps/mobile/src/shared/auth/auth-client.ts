import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { resolveApiBaseURL } from '~/shared/api/base-url';

const baseURL = resolveApiBaseURL();
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
