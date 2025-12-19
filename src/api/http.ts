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
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const text = await res.text();
  const data: ApiErrorPayload = text ? safeJson(text) : null;

  if (!res.ok) {
    const message = extractErrorMessage(data) ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message, data);
  }

  return data as T;
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
