import { resolveApiBaseURL } from './base-url';

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;

  constructor(status: number, message: string, body: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body' | 'headers'> {
  bearerToken?: string | null;
  headers?: Record<string, string>;
  json?: unknown;
}

function isErrorBody(
  value: unknown,
): value is { message?: string; code?: string } {
  return typeof value === 'object' && value !== null;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const baseURL = resolveApiBaseURL();
  const url = path.startsWith('http') ? path : `${baseURL}${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.bearerToken) {
    headers.Authorization = `Bearer ${options.bearerToken}`;
  }

  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  const text = await response.text();
  const parsed: unknown = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message = isErrorBody(parsed)
      ? (parsed.message ?? `Request failed with status ${response.status}`)
      : `Request failed with status ${response.status}`;
    const code = isErrorBody(parsed) ? parsed.code : undefined;
    throw new ApiError(response.status, message, parsed, code);
  }

  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
