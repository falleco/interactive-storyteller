import Constants from 'expo-constants';

const DEFAULT_API_PORT = 4000;

export function resolveApiBaseURL(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) {
    return fromEnv;
  }

  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    const url = `http://${host}:${DEFAULT_API_PORT}`;
    return url;
  }
  return `http://localhost:${DEFAULT_API_PORT}`;
}
