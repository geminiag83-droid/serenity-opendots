const TOKEN_KEY = 'opendots-token';
const REMEMBER_KEY = 'opendots-remembered-token';
function readStoredToken() {
  try {
    return (
      localStorage.getItem(REMEMBER_KEY) ??
      sessionStorage.getItem(TOKEN_KEY) ??
      ''
    );
  } catch {
    return '';
  }
}
let token = readStoredToken();
export function setToken(value: string, remember = false) {
  token = value;
  // Remove both copies on logout, including credentials saved by an earlier login.
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Storage unavailable. */
  }
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* Storage unavailable. */
  }
  if (!value) return;
  if (remember) {
    try {
      localStorage.setItem(REMEMBER_KEY, value);
    } catch {
      throw new Error(
        'Il browser non consente di ricordare l’accesso. Deseleziona Ricordami e riprova.',
      );
    }
  } else {
    try {
      sessionStorage.setItem(TOKEN_KEY, value);
    } catch {
      /* Memory-only login. */
    }
  }
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(['GET', 'HEAD'].includes(method)
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await response
    .json()
    .catch(() => ({ error: 'Server returned an unreadable response.' }))) as {
    error?: string;
  };
  if (!response.ok)
    throw new ApiError(
      data.error ?? `Request failed (${response.status}).`,
      response.status,
    );
  return data as T;
}
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
