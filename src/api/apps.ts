import { authHttp } from "./http";

const API_BASE_URL = "/api";

type ResponseDTO<T> = {
  data: T | T[];
};

export type AppDTO = {
  id: string;
  name: string;
  image?: string | null;
  description: string;
  is_active: boolean;
  created_at: string;
};

export function resolveAppImageUrl(image: string): string {
  const trimmed = image.trim();
  if (!trimmed) return "";

  // Absolute URL (http/https/data/blob) — keep as-is.
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;

  // If API returns a relative path (e.g. "/media/x.png"), prefix API base URL.
  if (trimmed.startsWith("/")) return `${API_BASE_URL}${trimmed}`;

  return trimmed;
}

export function getApps() {
  return authHttp<ResponseDTO<AppDTO>>("/apps", {
    method: "GET",
  });
}
