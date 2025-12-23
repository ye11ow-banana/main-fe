import { http } from "./http";

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

function getAuthHeader(): string | null {
  return localStorage.getItem("access_token");
}

export function getApps() {
  const auth = getAuthHeader();
  return http<ResponseDTO<AppDTO>>("/apps", {
    method: "GET",
    headers: auth ? { Authorization: auth } : {},
  });
}
