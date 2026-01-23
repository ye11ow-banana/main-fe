import { authHttp, http } from "./http";

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
    refresh_token: string;
  };
};

export function signIn(body: SignInRequest) {
  return http<SignInResponse>("/auth/sign-in", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type RefreshTokenRequest = {
  refresh_token: string;
};

export type RefreshTokenResponse = SignInResponse;

export function refreshToken(body: RefreshTokenRequest) {
  return http<RefreshTokenResponse>("/auth/refresh-token", {
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
  avatar_url: string | null;
};

export function getMe() {
  return authHttp<ResponseDTO<UserInfo>>("/auth/me", {
    method: "GET",
  });
}

export function getUsers() {
  return authHttp<ResponseDTO<UserInfo[]>>("/auth/users", {
    method: "GET",
  });
}

export function signUp(body: SignUpRequest) {
  return http<ResponseDTO<UserInfo>>("/auth/sign-up", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function sendEmailVerificationCode() {
  return authHttp<ResponseDTO<{ success?: boolean }>>("/auth/email/verification-code", {
    method: "POST",
  });
}

export function verifyEmail(body: { code: number }) {
  return authHttp<ResponseDTO<{ success?: boolean }>>("/auth/email/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
