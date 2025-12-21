import { http } from "./http";

type ResponseDTO<T> = {
  data: T;
};

export type SignInRequest = {
  username: string;
  password: string;
};

export type SignInResponse = {
  data: {
    access_token: string;
    token_type: string; // e.g. "bearer"
  };
};

export function signIn(body: SignInRequest) {
  return http<SignInResponse>("/auth/sign-in", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type SignUpRequest = {
  username: string;
  email: string;
  password: string;
  repeat_password: string;
};

export type UserInfo = {
  id: string;
  username: string;
  email: string;
  is_verified: boolean;
  created_at: string;
};

export function getMe() {
  const auth = getAuthHeader();
  return http<ResponseDTO<UserInfo>>("/auth/me", {
    method: "GET",
    headers: auth ? { Authorization: auth } : {},
  });
}

export function signUp(body: SignUpRequest) {
  return http<ResponseDTO<UserInfo>>("/auth/sign-up", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function getAuthHeader(): string | null {
  return localStorage.getItem("access_token");
}

export function sendEmailVerificationCode() {
  const auth = getAuthHeader();
  return http<ResponseDTO<{ success?: boolean }>>("/auth/email/verification-code", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  });
}

export function verifyEmail(body: { code: number }) {
  const auth = getAuthHeader();
  return http<ResponseDTO<{ success?: boolean }>>("/auth/email/verify", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify(body),
  });
}
