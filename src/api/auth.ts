import { http } from "./http";

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
