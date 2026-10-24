// The only file that talks to our own API (apps/api). The session lives in an
// HttpOnly cookie, so every request sends credentials and nothing here holds a
// token.

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API answered ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(API_URL + path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data);
  }
  return data as T;
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

// Human-readable lines from an API error body: the rig validator's `errors`,
// zod's `issues`, or the plain `message`.
export function errorMessages(error: unknown): string[] {
  if (!(error instanceof ApiError)) {
    return [error instanceof Error ? error.message : 'Something went wrong'];
  }
  const body = (error.body ?? {}) as { errors?: unknown; issues?: unknown; message?: unknown };
  if (Array.isArray(body.errors)) {
    return body.errors.map(String);
  }
  if (Array.isArray(body.issues)) {
    return body.issues.map((issue: { path?: unknown[]; message?: string }) =>
      [issue.path?.join('.'), issue.message].filter(Boolean).join(': '),
    );
  }
  return [typeof body.message === 'string' ? body.message : error.message];
}
