import { ApiError } from "./http";

type FieldErrors = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getFieldFromLoc(loc: unknown): string | null {
  if (!Array.isArray(loc) || loc.length === 0) return null;
  const last = loc[loc.length - 1];
  return typeof last === "string" ? last : null;
}

export function parseApiError(err: ApiError): {
  formError: string | null;
  fieldErrors: FieldErrors;
} {
  const fieldErrors: FieldErrors = {};
  let formError: string | null = null;

  const payload = err.payload;
  if (!isRecord(payload)) {
    return { formError: err.message, fieldErrors };
  }

  // Custom shape: { error: { field, message } }
  const maybeError = payload["error"];
  if (isRecord(maybeError)) {
    const field = getString(maybeError["field"]);
    const message = getString(maybeError["message"]) ?? err.message;
    if (field) {
      fieldErrors[field] = message;
      return { formError, fieldErrors };
    }
    formError = message;
    return { formError, fieldErrors };
  }

  // FastAPI HTTPException shape: { detail: "..." }
  const detail = payload["detail"];
  const detailStr = getString(detail);
  if (detailStr) {
    formError = detailStr;
    return { formError, fieldErrors };
  }

  // FastAPI / Pydantic validation errors (422):
  // { detail: [ { loc: ["body","field"], msg: "...", type: "..." }, ... ] }
  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (!isRecord(item)) continue;
      const field = getFieldFromLoc(item["loc"]);
      const msg = getString(item["msg"]);
      if (field && msg && fieldErrors[field] == null) {
        fieldErrors[field] = msg;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { formError, fieldErrors };
    }
  }

  // Generic shape: { message: "..." }
  const msg = getString(payload["message"]);
  formError = msg ?? err.message;
  return { formError, fieldErrors };
}
