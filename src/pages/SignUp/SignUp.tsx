import { useState } from "react";
import "../SignIn/SignIn.css";
import { sendEmailVerificationCode, signIn, signUp } from "../../api/auth";
import { ApiError } from "../../api/http";
import { parseApiError } from "../../api/errorParsing";

type FieldErrors = Record<string, string>;

function validate(values: {
  username: string;
  email: string;
  password: string;
  repeat_password: string;
}): {
  fieldErrors: FieldErrors;
  formError: string | null;
} {
  const fieldErrors: FieldErrors = {};

  const username = values.username.trim();
  if (username.length < 3) fieldErrors.username = "String should have at least 3 characters";
  if (username.length > 30) fieldErrors.username = "String should have at most 30 characters";
  if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) {
    fieldErrors.username = "Username has invalid symbols";
  }

  const email = values.email.trim();
  if (!email) {
    fieldErrors.email = "Email is required";
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    // Close enough to backend EmailStr for basic UX (backend remains source of truth)
    fieldErrors.email = "Invalid email address";
  }

  if (values.password.length < 6) {
    fieldErrors.password = "String should have at least 6 characters";
  }

  if (values.repeat_password !== values.password) {
    fieldErrors.repeat_password = "Passwords do not match";
  }

  return { fieldErrors, formError: null };
}

function storeToken(tokenType: string, accessToken: string) {
  const authHeaderValue = `${tokenType} ${accessToken}`;
  localStorage.setItem("access_token", authHeaderValue);
}

import { useTheme } from "../../context/ThemeContext";
import { ThemeToggle } from "../../components/ThemeToggle/ThemeToggle";

export function SignUp() {
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const local = validate({
      username,
      email,
      password,
      repeat_password: repeatPassword,
    });
    if (Object.keys(local.fieldErrors).length > 0) {
      setFieldErrors(local.fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      await signUp({
        username,
        email,
        password,
        repeat_password: repeatPassword,
      });

      // After success, user must be signed in in the background
      const signInRes = await signIn({ username: email, password });
      storeToken(signInRes.data.token_type, signInRes.data.access_token);
      localStorage.setItem("pending_email", email);

      // Then send request to send verification code
      await sendEmailVerificationCode();

      // Then redirect to verify-email.html (mapped to /verify-email)
      window.location.href = "/verify-email";
    } catch (err) {
      if (err instanceof ApiError) {
        const parsed = parseApiError(err);
        setError(parsed.formError);
        setFieldErrors(parsed.fieldErrors);
      } else {
        setError("Unexpected error");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={`auth-page theme-${theme}`}>
      <div 
        className="theme-toggle-wrapper" 
        style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 1000
        }}
      >
        <ThemeToggle />
      </div>
      <div className="auth-wrapper">
        <div className="auth-card">
          <header className="auth-header">
            <div className="auth-logo" />
            <div>
              <h1 className="auth-heading">Sign up</h1>
              <p className="auth-subtitle">Create a new Cube account.</p>
            </div>
          </header>

          <form className="auth-form" onSubmit={onSubmit}>
            {error && (
              <div style={{ fontSize: 13, color: "crimson" }}>{error}</div>
            )}

            <div className="field-group">
              <label className="field-label" htmlFor="username">
                Username
              </label>
              <div className="field-input-wrapper">
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="field-input"
                  placeholder="Choose a username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              {fieldErrors.username && (
                <div style={{ fontSize: 12, color: "crimson" }}>
                  {fieldErrors.username}
                </div>
              )}
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <div className="field-input-wrapper">
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="field-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              {fieldErrors.email && (
                <div style={{ fontSize: 12, color: "crimson" }}>{fieldErrors.email}</div>
              )}
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <div className="field-input-wrapper">
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="field-input"
                  placeholder="Create a password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              {fieldErrors.password && (
                <div style={{ fontSize: 12, color: "crimson" }}>
                  {fieldErrors.password}
                </div>
              )}
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="password-confirm">
                Confirm password
              </label>
              <div className="field-input-wrapper">
                <input
                  id="password-confirm"
                  name="password_confirm"
                  type="password"
                  className="field-input"
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              {fieldErrors.repeat_password && (
                <div style={{ fontSize: 12, color: "crimson" }}>
                  {fieldErrors.repeat_password}
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? "Signing up..." : "Sign up"}
            </button>
          </form>

          <p className="auth-footer-text">
            Already have an account?{" "}
            <a href="/sign-in" className="link-inline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
