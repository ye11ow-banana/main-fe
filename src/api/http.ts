const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type ApiErrorPayload =
  | { error?: { message?: string; field?: string } } // your 401/422 shapes
  | { message?: string }                             // generic
  | unknown;

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload;

  constructor(status: number, message: string, payload: ApiErrorPayload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function http<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  const data: ApiErrorPayload = text ? safeJson(text) : null;

  if (!res.ok) {
    const message = extractErrorMessage(data) ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

(window as any).authHttp = authHttp;

function getAccessTokenHeader(): string | null {
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

function setTokens(payload: { access_token: string; token_type: string; refresh_token?: string | null }) {
  const authHeaderValue = `${payload.token_type} ${payload.access_token}`;
  localStorage.setItem("access_token", authHeaderValue);

  if (typeof payload.refresh_token === "string") {
    localStorage.setItem("refresh_token", payload.refresh_token);
  }
}

function clearSessionAndRedirectToSignIn() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("pending_email");

  // Avoid infinite loops if we're already on auth pages.
  const path = window.location?.pathname ?? "";
  if (!/^\/sign-in\b/.test(path)) {
    window.location.href = "/sign-in";
  }
}

type RefreshResponse = {
  data: {
    access_token: string;
    token_type: string;
    refresh_token?: string;
  };
};

let refreshInFlight: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSessionAndRedirectToSignIn();
      throw new Error("No refresh token");
    }

    try {
      const res = await http<RefreshResponse>("/auth/refresh-token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      setTokens(res.data);
    } catch (err) {
      // Refresh token expired/invalid → logout.
      clearSessionAndRedirectToSignIn();
      throw err;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * HTTP helper for endpoints that require Authorization.
 *
 * - Adds Authorization header from localStorage.
 * - On 401, attempts a single refresh-token flow and retries once.
 * - If refresh fails/expired, clears session and redirects to /sign-in.
 */
export async function authHttp<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const doRequest = () => {
    const auth = getAccessTokenHeader();
    const headers: HeadersInit = {
      ...(options.headers ?? {}),
      ...(auth ? { Authorization: auth } : {}),
    };

    return http<T>(path, {
      ...options,
      headers,
    });
  };

  try {
    return await doRequest();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await refreshAccessToken();
      return doRequest();
    }
    throw err;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text; // sometimes backend returns plain text
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractErrorMessage(payload: ApiErrorPayload): string | null {
  if (!isRecord(payload)) return null;

  // payload.error.message
  const err = payload["error"];
  if (isRecord(err)) {
    const msg = err["message"];
    if (typeof msg === "string") return msg;
  }

  // payload.message
  const msg = payload["message"];
  if (typeof msg === "string") return msg;

  return null;
}
